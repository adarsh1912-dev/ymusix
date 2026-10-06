import { basename, extname } from 'node:path';
import { parseFile } from 'music-metadata';

const METADATA_TIMEOUT_MS = 15000;

// "03 - Let It Happen.mp3" -> "Let It Happen"; "04.Title.flac" -> "Title"
export function titleFromFilename(filePath) {
  const base = basename(filePath, extname(filePath)).trim();
  const m = base.match(/^(\d{1,3})\s*[-._\s]+\s*(.+)$/);
  return (m ? m[2] : base).trim() || base;
}

function firstString(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    const s = value.find((v) => typeof v === 'string' && v.trim());
    return s ? s.trim() : '';
  }
  return typeof value === 'string' ? value.trim() : '';
}

export async function readSong(filePath, fileStat = {}) {
  let meta = null;
  try {
    meta = await Promise.race([
      parseFile(filePath, { duration: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('metadata timeout')), METADATA_TIMEOUT_MS),
      ),
    ]);
  } catch {
    meta = null; // corrupt/unsupported content -> filename fallback below
  }

  const common = meta?.common ?? {};
  const format = meta?.format ?? {};
  const title = firstString(common.title) || titleFromFilename(filePath);

  return {
    source: 'local',
    id: filePath,
    path: filePath,
    title,
    artist: firstString(common.artist) || firstString(common.albumartist) || 'Unknown Artist',
    album: firstString(common.album),
    albumArtist: firstString(common.albumartist),
    duration: Number.isFinite(format.duration) ? Math.round(format.duration) : 0,
    track: common.track?.no ?? null,
    year: common.year ?? null,
    genre: firstString(common.genre),
    mtime: fileStat.mtime ?? 0,
    size: fileStat.size ?? 0,
  };
}
