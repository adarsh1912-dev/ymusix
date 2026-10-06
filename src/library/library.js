import { findAudioFiles } from './scanner.js';
import { readSong } from './metadata.js';
import {
  getCachedSongs,
  pruneMissingSongs,
  songFromCacheRow,
  upsertSong,
} from '../database/database.js';

// Full scan: discover files, read metadata (bounded concurrency), sort.
export async function scanLibrary(rootDir, { concurrency = 8, onProgress } = {}) {
  const { files, skipped } = await findAudioFiles(rootDir);
  const songs = [];
  const failed = [];
  let done = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (f) => {
        try {
          return await readSong(f.path, f);
        } catch (err) {
          failed.push({ path: f.path, error: err?.message ?? String(err) });
          return null;
        } finally {
          done += 1;
          onProgress?.(done, files.length);
        }
      }),
    );
    for (const song of results) {
      if (song) songs.push(song);
    }
  }

  songs.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) ||
      (a.album || '').localeCompare(b.album || '') ||
      (a.track ?? 0) - (b.track ?? 0) ||
      a.title.localeCompare(b.title),
  );

  return { songs, failed, skipped, total: files.length };
}

// Cached variant: reuses stored metadata for files whose mtime+size are
// unchanged, so repeat startups skip expensive parsing. Pass db = null to
// behave exactly like scanLibrary.
export async function scanLibraryCached(rootDir, database, { concurrency = 8, onProgress } = {}) {
  const { files, skipped } = await findAudioFiles(rootDir);
  const cache = database ? getCachedSongs(database) : new Map();
  const cachedHits = [];
  const toRead = [];

  for (const f of files) {
    const row = cache.get(f.path);
    if (row && row.mtime === f.mtime && row.size === f.size) {
      cachedHits.push(songFromCacheRow(row));
    } else {
      toRead.push(f);
    }
  }

  const songs = [...cachedHits];
  const failed = [];
  let done = files.length - toRead.length;
  onProgress?.(done, files.length);

  for (let i = 0; i < toRead.length; i += concurrency) {
    const batch = toRead.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (f) => {
        try {
          const song = await readSong(f.path, f);
          if (database) {
            try {
              upsertSong(database, song);
            } catch {
              // cache write failure must not break scanning
            }
          }
          return song;
        } catch (err) {
          failed.push({ path: f.path, error: err?.message ?? String(err) });
          return null;
        } finally {
          done += 1;
          onProgress?.(done, files.length);
        }
      }),
    );
    for (const song of results) {
      if (song) songs.push(song);
    }
  }

  if (database) {
    try {
      pruneMissingSongs(database, files.map((f) => f.path));
    } catch {
      // ignore
    }
  }

  songs.sort(
    (a, b) =>
      a.artist.localeCompare(b.artist) ||
      (a.album || '').localeCompare(b.album || '') ||
      (a.track ?? 0) - (b.track ?? 0) ||
      a.title.localeCompare(b.title),
  );

  return { songs, failed, skipped, total: files.length, cached: cachedHits.length };
}
