import { readFile } from "node:fs/promises";
import { archiveFilePath } from "./archive.js";
import { getSource } from "./mapSources.js";

const TOOLTIP_NAME_RE = /<b>(.*?)<\/b>/;

/** Pulls a source's town marker set out of a parsed squaremap markers.json object (live-fetched or archived). */
export function extractTownyMarkers(data, markerSetId) {
  const set = Object.values(data).find((s) => s.id === markerSetId);
  return set?.markers ?? null;
}

export function extractName(marker) {
  return marker.tooltip?.match(TOOLTIP_NAME_RE)?.[1] ?? null;
}

const POPUP_PATTERNS = {
  nation: /<span[^>]*>[^<(]*?(?:\(([^)]*)\))?\s*<\/span>/,
  motto: /<i>(.*?)<\/i>/,
  mayor: /Mayor:\s*<b>(.*?)<\/b>/,
  councillors: /Councillors:\s*<b>(.*?)<\/b>/,
  founded: /Founded:\s*<b>(.*?)<\/b>/,
  pvp: /PVP:\s*<b>(.*?)<\/b>/,
  public: /Public:\s*<b>(.*?)<\/b>/,
  residentCount: /Residents:\s*<b>(\d+)<\/b>/,
};

/**
 * Parses the extra town metadata squaremap embeds as HTML inside a town
 * marker's `popup` field (nation, mayor, councillors, founding date,
 * PVP/public flags, resident count) — none of it is in a clean structured
 * field, so this is regex-extracted. Verified against every town in a real
 * live fetch (5187/5187 parsed with no missing core fields), including the
 * nationless-town case (no "(Nation)" suffix on the name span).
 */
export function parseTownDetails(marker) {
  const popup = marker.popup ?? "";
  return {
    nation: popup.match(POPUP_PATTERNS.nation)?.[1] ?? null,
    motto: popup.match(POPUP_PATTERNS.motto)?.[1]?.trim() || null,
    mayor: popup.match(POPUP_PATTERNS.mayor)?.[1] ?? null,
    councillors: popup.match(POPUP_PATTERNS.councillors)?.[1] ?? null,
    founded: popup.match(POPUP_PATTERNS.founded)?.[1] ?? null,
    pvp: popup.match(POPUP_PATTERNS.pvp)?.[1] ?? null,
    public: popup.match(POPUP_PATTERNS.public)?.[1] ?? null,
    residentCount: Number(popup.match(POPUP_PATTERNS.residentCount)?.[1]) || null,
    fillColor: marker.fillColor ?? null,
  };
}

/** Map of every polygon marker's town name to its parsed details — used for the claim-deletion watcher. */
export function listTownDetails(markers) {
  const towns = new Map();
  for (const marker of Object.values(markers)) {
    if (marker.type !== "polygon") continue;
    const name = extractName(marker);
    if (name) towns.set(name, parseTownDetails(marker));
  }
  return towns;
}

async function readTownyMarkers(sourceId, isoDate) {
  const markerSetId = getSource(sourceId).markerSetId;
  let data;
  try {
    data = JSON.parse(await readFile(archiveFilePath(sourceId, isoDate), "utf8"));
  } catch {
    return null;
  }
  return extractTownyMarkers(data, markerSetId);
}

/**
 * Flattens a squaremap polygon marker's nested points (shape -> ring -> point)
 * into a flat list of rings. Most towns have exactly one shape with one ring;
 * a small fraction have multiple shapes (disconnected outposts) or multiple
 * rings per shape (holes/enclaves) — both are rendered here as separate
 * filled rings rather than true multi-part/hole geometry, a minor visual
 * simplification rather than a proper polygon-with-holes cutout.
 */
function flattenRings(points) {
  const rings = [];
  for (const shape of points) {
    for (const ring of shape) {
      rings.push(ring);
    }
  }
  return rings;
}

/** Exact-name lookup of one or more towns' boundary polygons for a given date. */
export async function findTownPolygons(townNames, sourceId, isoDate) {
  const markers = await readTownyMarkers(sourceId, isoDate);
  if (!markers) return null;

  const x = [];
  const z = [];
  const fillColor = [];
  for (const town of townNames) {
    for (const marker of Object.values(markers)) {
      if (marker.type !== "polygon") continue;
      if (extractName(marker) !== town) continue;
      for (const ring of flattenRings(marker.points)) {
        x.push(ring.map((p) => Math.trunc(p.x)));
        z.push(ring.map((p) => Math.trunc(p.z)));
        fillColor.push(marker.fillColor ?? "#FFFFFF");
      }
    }
  }
  if (x.length === 0) return null;
  return { x, z, fillColor };
}

/** Prefix-name search across one or more query strings for a given date. */
export async function searchTownLabels(queries, sourceId, isoDate) {
  const markers = await readTownyMarkers(sourceId, isoDate);
  if (!markers) return [];

  const results = [];
  for (const query of queries) {
    for (const marker of Object.values(markers)) {
      if (marker.type !== "polygon") continue;
      const name = extractName(marker);
      if (name && name.startsWith(query)) results.push(name);
    }
  }
  return [...new Set(results)].sort();
}
