import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ARCHIVE_ROOT = path.join(process.cwd(), "data", "archive");

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function todayIso() {
  return toIsoDate(new Date());
}

/** Parses a user-supplied D.M.YY (leading zeros optional) date into an ISO YYYY-MM-DD string, or null if invalid. */
export function parseUserDate(input) {
  const parts = input.split(".");
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map((p) => Number.parseInt(p, 10));
  if (![d, m, y].every(Number.isInteger)) return null;
  const fullYear = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(fullYear, m - 1, d));
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return toIsoDate(date);
}

export function archiveFilePath(sourceId, isoDate) {
  return path.join(ARCHIVE_ROOT, sourceId, `${isoDate}.json`);
}

export async function archiveExists(sourceId, isoDate) {
  try {
    await access(archiveFilePath(sourceId, isoDate));
    return true;
  } catch {
    return false;
  }
}

export async function writeArchive(sourceId, isoDate, buffer) {
  const dir = path.join(ARCHIVE_ROOT, sourceId);
  await mkdir(dir, { recursive: true });
  await writeFile(archiveFilePath(sourceId, isoDate), buffer);
}

/** 14-day range starting at startIso, clamped to today (inclusive) — mirrors the original month_date(). */
export function monthDateRange(startIso) {
  const start = new Date(`${startIso}T00:00:00Z`);
  let end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 14);

  const today = new Date(`${todayIso()}T00:00:00Z`);
  if (end > today) {
    end = new Date(today);
    end.setUTCDate(end.getUTCDate() + 1);
  }

  const days = Math.round((end - start) / 86_400_000);
  const out = [];
  for (let n = 0; n < days; n++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + n);
    out.push(toIsoDate(d));
  }
  return out;
}
