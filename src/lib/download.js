import { archiveExists, writeArchive, todayIso, archiveFilePath } from "./archive.js";
import { getSource } from "./mapSources.js";
import { USER_AGENT } from "./userAgent.js";

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches a source's marker feed with bounded exponential-backoff retries.
 * Retries on a non-2xx status *and* on a 2xx response that isn't valid
 * JSON — squaremap (and Stoneworks' offline-map placeholder) serve an HTML
 * page instead of a 404 for unreachable paths, which would otherwise get
 * silently archived as if it were real data.
 */
async function fetchMarkers(source) {
  const url = `${source.baseUrl}/tiles/${source.worldName}/markers.json`;
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      const body = Buffer.from(await response.arrayBuffer());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      JSON.parse(body); // throws if this isn't real marker JSON
      return body;
    } catch (err) {
      lastError = err;
      const delay = INITIAL_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `[download] ${source.label}: fetch failed (${err.message}), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );
      await sleep(delay);
    }
  }
  throw new Error(`${source.label}: exceeded ${MAX_RETRIES} retries fetching marker data: ${lastError?.message}`);
}

/** Downloads today's marker JSON for a source if it isn't already archived. */
export async function downloadMarkers(sourceId) {
  const source = getSource(sourceId);
  const isoDate = todayIso();
  if (await archiveExists(sourceId, isoDate)) {
    return { downloaded: false, isoDate, filePath: archiveFilePath(sourceId, isoDate) };
  }

  try {
    const body = await fetchMarkers(source);
    await writeArchive(sourceId, isoDate, body);
    return { downloaded: true, isoDate, filePath: archiveFilePath(sourceId, isoDate) };
  } catch (err) {
    console.error(`[download] ${source.label}: failed to download marker data:`, err);
    return { downloaded: false, isoDate, filePath: null };
  }
}
