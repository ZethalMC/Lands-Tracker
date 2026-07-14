import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getSource } from "./mapSources.js";
import { USER_AGENT } from "./userAgent.js";

// squaremap serves each live map's own tiles publicly, no auth required.
// Tile URL template and tileSize=512 confirmed from the map's frontend JS
// (js/modules/LayerControl.js::createTileLayer). At native (max) zoom, one
// tile pixel is exactly one block — the same 1:1 space renderFrame() already
// draws town polygons in, so tiles can be composited in directly with no
// extra scaling.
const TILE_SIZE = 512;
const MAX_TILES = 144; // 12x12 safety cap so an accidental huge/multi-nation render can't fire hundreds of tile requests

const zoomMaxCache = new Map();

async function getNativeZoom(source) {
  if (zoomMaxCache.has(source.id)) return zoomMaxCache.get(source.id);
  const response = await fetch(`${source.baseUrl}/tiles/${source.worldName}/settings.json`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching world settings`);
  const settings = await response.json();
  zoomMaxCache.set(source.id, settings.zoom.max);
  return settings.zoom.max;
}

async function fetchTileImage(source, zoom, tileX, tileZ) {
  try {
    const response = await fetch(`${source.baseUrl}/tiles/${source.worldName}/${zoom}/${tileX}_${tileZ}.png`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) return null;
    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Stitches a source's squaremap tiles covering a world-coordinate bounding
 * box into one canvas at native (1 block = 1 pixel) resolution. Returns
 * { canvas, originX, originZ } (originX/originZ is the world coordinate of
 * the canvas's top-left pixel), or null if the background couldn't be
 * fetched — callers should fall back to rendering without one.
 */
export async function fetchMapBackground(sourceId, minX, minZ, maxX, maxZ) {
  const source = getSource(sourceId);
  try {
    const zoom = await getNativeZoom(source);
    const tileXMin = Math.floor(minX / TILE_SIZE);
    const tileXMax = Math.floor(maxX / TILE_SIZE);
    const tileZMin = Math.floor(minZ / TILE_SIZE);
    const tileZMax = Math.floor(maxZ / TILE_SIZE);

    const cols = tileXMax - tileXMin + 1;
    const rows = tileZMax - tileZMin + 1;
    if (cols * rows > MAX_TILES) {
      console.warn(`[mapTiles] skipping background: ${cols}x${rows} tiles exceeds cap of ${MAX_TILES}`);
      return null;
    }

    const canvas = createCanvas(cols * TILE_SIZE, rows * TILE_SIZE);
    const ctx = canvas.getContext("2d");

    const fetches = [];
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      for (let tz = tileZMin; tz <= tileZMax; tz++) {
        fetches.push(
          fetchTileImage(source, zoom, tx, tz).then((image) => {
            if (image) ctx.drawImage(image, (tx - tileXMin) * TILE_SIZE, (tz - tileZMin) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          })
        );
      }
    }
    await Promise.all(fetches);

    return { canvas, originX: tileXMin * TILE_SIZE, originZ: tileZMin * TILE_SIZE };
  } catch (err) {
    console.warn(`[mapTiles] ${source.label}: failed to fetch map background:`, err.message);
    return null;
  }
}
