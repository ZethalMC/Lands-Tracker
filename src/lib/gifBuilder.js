import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { findTownPolygons } from "./townData.js";
import { min3d, max3d } from "./bounds.js";
import { renderFrame, fetchBackgroundFor, BORDER } from "./render.js";

const FALLBACK_COLOR = "#FFFFFF";
const FRAME_DELAY_MS = 1000;

/**
 * Builds an animated GIF across a date range for one or more towns.
 * Mirrors Bot.py::TownGif, including its quirk of coloring every frame
 * using only the last successfully-found date's fillColor list (town
 * colors rarely change, so this is preserved rather than "fixed").
 * Returns a GIF Buffer, or null if no date in the range had matching data.
 */
export async function buildTownGif(townNames, sourceId, isoDates) {
  const frames = [];
  let lastFillColor = [FALLBACK_COLOR];

  for (const isoDate of isoDates) {
    const polygons = await findTownPolygons(townNames, sourceId, isoDate);
    if (!polygons) continue;
    lastFillColor = polygons.fillColor;
    frames.push({ x: polygons.x, z: polygons.z, label: isoDate });
  }

  if (frames.length === 0) return null;

  const offsetX = min3d(frames.map((f) => f.x)) - 16;
  const offsetZ = min3d(frames.map((f) => f.z)) - 16;

  const shiftedFrames = frames.map((f) => ({
    x: f.x.map((row) => row.map((v) => v - offsetX)),
    z: f.z.map((row) => row.map((v) => v - offsetZ)),
    label: f.label,
  }));

  const width = max3d(shiftedFrames.map((f) => f.x));
  const height = max3d(shiftedFrames.map((f) => f.z));

  // Fetched once and reused for every frame — the town's location doesn't
  // move between dates, only its claim shape, and refetching per-frame
  // would multiply tile requests by the number of dates in the range.
  const background = await fetchBackgroundFor(sourceId, offsetX, offsetZ, width + BORDER, height + BORDER);

  const gif = GIFEncoder();
  for (const frame of shiftedFrames) {
    const fillColors = frame.x.map((_, i) => lastFillColor[i] ?? lastFillColor[0] ?? FALLBACK_COLOR);
    const canvas = renderFrame({
      townX: frame.x,
      townZ: frame.z,
      width,
      height,
      label: frame.label,
      fillColors,
      background,
    });

    const ctx = canvas.getContext("2d");
    const { data, width: w, height: h } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay: FRAME_DELAY_MS, repeat: 0 });
  }
  gif.finish();

  return Buffer.from(gif.bytes());
}
