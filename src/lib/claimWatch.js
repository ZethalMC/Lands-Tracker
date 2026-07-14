import { MAP_SOURCES } from "./mapSources.js";
import { extractTownyMarkers, listTownDetails } from "./townData.js";
import { getAllGuildConfigs } from "./guildConfig.js";
import { USER_AGENT } from "./userAgent.js";
import { buildClaimAlertResponse } from "./responseComponents.js";

const BODY_CHAR_LIMIT = 3500; // safely under Components V2's ~4000-char text-display limit

// In-memory only: sourceId -> Map<townName, details> from the most recent
// successful live fetch. A bot restart just re-establishes this on the next
// poll (see the "first poll" guard below) rather than notifying about
// anything — losing this on restart is an acceptable tradeoff for not
// persisting it.
const knownTowns = new Map();

async function fetchLiveTownDetails(source) {
  const url = `${source.baseUrl}/tiles/${source.worldName}/markers.json`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = JSON.parse(await response.text());
  const markers = extractTownyMarkers(data, source.markerSetId);
  if (!markers) throw new Error(`marker set "${source.markerSetId}" not found`);
  return listTownDetails(markers);
}

function toTemplateVars(town, details, mapLabel) {
  return {
    town,
    map: mapLabel,
    nation: details.nation ?? "None",
    mayor: details.mayor ?? "Unknown",
    councillors: details.councillors ?? "None",
    founded: details.founded ?? "Unknown",
    residentCount: details.residentCount ?? "?",
    pvp: details.pvp ?? "?",
    public: details.public ?? "?",
    motto: details.motto ?? "",
  };
}

function renderTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

/** Packs rendered per-town blocks into groups that each stay under `limit` characters. */
function chunkBlocks(blocks, limit) {
  const chunks = [];
  let current = [];
  let currentLen = 0;
  for (const block of blocks) {
    const addLen = block.length + (current.length ? 2 : 0); // +2 for the "\n\n" join
    if (currentLen + addLen > limit && current.length > 0) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(block);
    currentLen += addLen;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function notifyDeletedClaims(client, source, deletedEntries) {
  const guildConfigs = await getAllGuildConfigs();

  for (const [guildId, guildConfig] of Object.entries(guildConfigs)) {
    const { channelId, message, pingRoleIds } = guildConfig.claimAlerts;
    if (!channelId) continue;

    const blocks = deletedEntries.map(({ name, details }) =>
      renderTemplate(message, toTemplateVars(name, details, source.label))
    );
    const chunks = chunkBlocks(blocks, BODY_CHAR_LIMIT);

    try {
      const channel = await client.channels.fetch(channelId);
      if (!channel?.isTextBased()) continue;
      for (let i = 0; i < chunks.length; i++) {
        // Only ping on the first chunk of a batch — not once per chunk.
        const payload = buildClaimAlertResponse({
          source,
          blocks: chunks[i],
          pingRoleIds: i === 0 ? pingRoleIds : [],
          count: deletedEntries.length,
        });
        await channel.send(payload);
      }
    } catch (err) {
      console.error(`[claimWatch] failed to notify guild ${guildId}, channel ${channelId}:`, err);
    }
  }
}

/** Polls every map source's live marker data and notifies configured channels about any town that has disappeared since the last successful poll. */
export async function checkForDeletedClaims(client) {
  for (const source of Object.values(MAP_SOURCES)) {
    let currentTowns;
    try {
      currentTowns = await fetchLiveTownDetails(source);
    } catch (err) {
      console.warn(`[claimWatch] ${source.label}: failed to fetch live data, skipping this cycle:`, err.message);
      continue;
    }

    const previousTowns = knownTowns.get(source.id);
    knownTowns.set(source.id, currentTowns);

    if (!previousTowns) continue; // first successful poll for this source — establish baseline only

    const deletedEntries = [...previousTowns.entries()]
      .filter(([name]) => !currentTowns.has(name))
      .map(([name, details]) => ({ name, details }));

    if (deletedEntries.length > 0) {
      await notifyDeletedClaims(client, source, deletedEntries);
    }
  }
}
