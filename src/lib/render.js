import { createCanvas } from "@napi-rs/canvas";
import { min2d, max2d } from "./bounds.js";
import { fetchMapBackground } from "./mapTiles.js";

export const GRID_SIZE = 16;
export const BORDER = 17;

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(clean.slice(i, i + 2), 16));
  return [r, g, b];
}

function drawGrid(ctx, width, height, alpha) {
  ctx.strokeStyle = `rgba(128, 128, 128, ${alpha})`;
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let x = 0; x < width; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

/**
 * Fetches the real map terrain covering a shifted render's world-coordinate
 * bounds, pre-positioned in the shifted (canvas-pixel) space renderFrame
 * draws in. Returns null (falls back to a plain white background) if the
 * tiles can't be fetched.
 */
export async function fetchBackgroundFor(sourceId, offsetX, offsetZ, canvasWidth, canvasHeight) {
  const background = await fetchMapBackground(sourceId, offsetX, offsetZ, offsetX + canvasWidth, offsetZ + canvasHeight);
  if (!background) return null;
  return { canvas: background.canvas, x: background.originX - offsetX, z: background.originZ - offsetZ };
}

/**
 * Draws one frame: map background (or plain white if unavailable), chunk
 * grid, each town's filled+outlined polygon, and a date label box. Mirrors
 * Bot.py::TownRender/Grid.
 */
export function renderFrame({ townX, townZ, width, height, label, fillColors, background }) {
  const canvasWidth = width + BORDER;
  const canvasHeight = height + BORDER;
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  if (background) {
    ctx.drawImage(background.canvas, background.x, background.z);
  }
  drawGrid(ctx, canvasWidth, canvasHeight, background ? 0.35 : 1);

  for (let i = 0; i < townX.length; i++) {
    const points = townX[i].map((x, idx) => [x, townZ[i][idx]]);
    const [r, g, b] = hexToRgb(fillColors[i] ?? fillColors[0] ?? "#FFFFFF");

    ctx.beginPath();
    points.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${100 / 255})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(0, 0, 255, ${100 / 255})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = "rgb(0, 0, 255)";
    ctx.lineWidth = 2;
    for (let j = 0; j < points.length; j++) {
      const [x1, y1] = points[(j - 1 + points.length) % points.length];
      const [x2, y2] = points[j];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "white";
  ctx.fillRect(1, 1, 46, 14);
  ctx.fillStyle = `rgba(0, 0, 0, ${128 / 255})`;
  ctx.font = "11px sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(label, 4, 4);

  return canvas;
}

/** Single-date render: normalizes coordinates to a top/left border of 16px, returns a PNG Buffer. */
export async function renderTownPng(sourceId, { x, z, fillColor }, label) {
  const offsetX = min2d(x) - GRID_SIZE;
  const offsetZ = min2d(z) - GRID_SIZE;
  const shiftedX = x.map((row) => row.map((v) => v - offsetX));
  const shiftedZ = z.map((row) => row.map((v) => v - offsetZ));
  const width = max2d(shiftedX);
  const height = max2d(shiftedZ);

  const background = await fetchBackgroundFor(sourceId, offsetX, offsetZ, width + BORDER, height + BORDER);

  const canvas = renderFrame({
    townX: shiftedX,
    townZ: shiftedZ,
    width,
    height,
    label,
    fillColors: fillColor,
    background,
  });
  return canvas.toBuffer("image/png");
}
