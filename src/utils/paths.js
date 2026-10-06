import os from 'node:os';
import path from 'node:path';
import { existsSync, mkdirSync, renameSync, rmdirSync } from 'node:fs';

export function musicDir() {
  return path.join(os.homedir(), 'Music');
}

function legacyDataDir() {
  return path.join(os.homedir(), '.local', 'share', 'termify');
}

export function dataDir() {
  return path.join(os.homedir(), '.local', 'share', 'ymusix');
}

function legacyDbPath() {
  return path.join(legacyDataDir(), 'termify.db');
}

export function dbPath() {
  return path.join(dataDir(), 'ymusix.db');
}

// One-time migration from the pre-rename location. Moves the database FILE
// (not the directory) so users keep metadata cache, settings, favorites,
// and history. Any failure falls back to a fresh database — the app must
// never crash over a move.
export function migrateLegacyDataDir() {
  try {
    if (existsSync(dbPath())) return;
    // Pre-rename location, plus the same-named file already inside the new
    // directory (left by an earlier incomplete migration).
    const candidates = [legacyDbPath(), path.join(dataDir(), 'termify.db')];
    const found = candidates.find((p) => existsSync(p));
    if (!found) return;
    mkdirSync(dataDir(), { recursive: true });
    renameSync(found, dbPath());
    try {
      rmdirSync(legacyDataDir());
    } catch {
      // legacy dir not empty — leave it alone
    }
  } catch {
    // ignore: caller falls back to a fresh database
  }
}
