import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { dataDir, dbPath, migrateLegacyDataDir } from '../utils/paths.js';

const RECENT_LIMIT = 50;

let db = null;

export function openDatabase() {
  if (db) return db;
  migrateLegacyDataDir();
  mkdirSync(dataDir(), { recursive: true });
  db = new DatabaseSync(dbPath());
  db.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      path TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      artist TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT '',
      album_artist TEXT NOT NULL DEFAULT '',
      duration INTEGER NOT NULL DEFAULT 0,
      track INTEGER,
      year INTEGER,
      genre TEXT NOT NULL DEFAULT '',
      mtime REAL NOT NULL DEFAULT 0,
      size INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS favorites (
      path TEXT PRIMARY KEY,
      added_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recent (
      path TEXT PRIMARY KEY,
      played_at INTEGER NOT NULL DEFAULT 0
    );
  `);
  // Source-aware columns for YouTube favorites/history. Local rows keep
  // their filesystem path as key; YouTube rows use "yt:<videoId>".
  // Pre-existing rows get source='local' via the DEFAULT.
  for (const table of ['favorites', 'recent']) {
    for (const col of [
      "source TEXT NOT NULL DEFAULT 'local'",
      'video_id TEXT',
      'title TEXT NOT NULL DEFAULT ' + "''",
      'artist TEXT NOT NULL DEFAULT ' + "''",
      'url TEXT',
      'thumbnail TEXT',
      'duration INTEGER NOT NULL DEFAULT 0',
    ]) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`);
      } catch {
        // column already exists (or old SQLite); safe to ignore
      }
    }
  }
  return db;
}

export function closeDatabase() {
  try {
    db?.close();
  } catch {
    // ignore
  }
  db = null;
}

// --- song metadata cache ---

export function getCachedSongs(database) {
  const rows = database.prepare('SELECT * FROM songs').all();
  const map = new Map();
  for (const row of rows) map.set(row.path, row);
  return map;
}

export function upsertSong(database, song) {
  database
    .prepare(
      `INSERT INTO songs (path, title, artist, album, album_artist, duration, track, year, genre, mtime, size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         title=excluded.title, artist=excluded.artist, album=excluded.album,
         album_artist=excluded.album_artist, duration=excluded.duration,
         track=excluded.track, year=excluded.year, genre=excluded.genre,
         mtime=excluded.mtime, size=excluded.size`,
    )
    .run(
      song.path,
      song.title,
      song.artist,
      song.album ?? '',
      song.albumArtist ?? '',
      song.duration ?? 0,
      song.track,
      song.year,
      song.genre ?? '',
      song.mtime ?? 0,
      song.size ?? 0,
    );
}

export function pruneMissingSongs(database, presentPaths) {
  const present = new Set(presentPaths);
  const rows = database.prepare('SELECT path FROM songs').all();
  const del = database.prepare('DELETE FROM songs WHERE path = ?');
  for (const row of rows) {
    if (!present.has(row.path)) del.run(row.path);
  }
}

export function songFromCacheRow(row) {
  return {
    source: 'local',
    id: row.path,
    path: row.path,
    title: row.title,
    artist: row.artist,
    album: row.album,
    albumArtist: row.album_artist,
    duration: row.duration,
    track: row.track,
    year: row.year,
    genre: row.genre,
    mtime: row.mtime,
    size: row.size,
  };
}

// --- settings ---

export function getSetting(database, key, fallback = '') {
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(database, key, value) {
  database
    .prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    )
    .run(key, String(value));
}

// --- favorites (source-aware) ---

export function ytKey(videoId) {
  return `yt:${videoId}`;
}

export function entryKey(entry) {
  if (!entry) return '';
  return entry.source === 'youtube' ? ytKey(entry.videoId ?? entry.id) : entry.path;
}

// Full favorite entries, newest first. Local rows carry path; YouTube rows
// carry video_id/title/artist/url/thumbnail/duration.
export function getFavoriteEntries(database) {
  return database
    .prepare(
      'SELECT path, source, video_id, title, artist, url, thumbnail, duration, added_at FROM favorites ORDER BY added_at DESC',
    )
    .all()
    .map((r) => ({
      source: r.source === 'youtube' ? 'youtube' : 'local',
      path: r.source === 'youtube' ? null : r.path,
      videoId: r.video_id,
      title: r.title,
      artist: r.artist,
      url: r.url,
      thumbnail: r.thumbnail,
      duration: r.duration,
      addedAt: r.added_at,
    }));
}

// entry: { source:'local', path } or
//        { source:'youtube', videoId, title, artist, url, thumbnail, duration }.
// Returns true if now favorited, false if removed.
export function toggleFavoriteEntry(database, entry) {
  const key =
    entry.source === 'youtube' ? ytKey(entry.videoId ?? entry.id) : entry.path;
  const existing = database.prepare('SELECT path FROM favorites WHERE path = ?').get(key);
  if (existing) {
    database.prepare('DELETE FROM favorites WHERE path = ?').run(key);
    return false;
  }
  database
    .prepare(
      `INSERT INTO favorites (path, added_at, source, video_id, title, artist, url, thumbnail, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      key,
      Date.now(),
      entry.source === 'youtube' ? 'youtube' : 'local',
      entry.source === 'youtube' ? (entry.videoId ?? entry.id ?? null) : null,
      entry.title ?? '',
      entry.artist ?? entry.channel ?? '',
      entry.url ?? null,
      entry.thumbnail ?? null,
      entry.duration ?? 0,
    );
  return true;
}

// --- recently played (source-aware) ---

export function pushRecentEntry(database, entry) {
  const key =
    entry.source === 'youtube' ? ytKey(entry.videoId ?? entry.id) : entry.path;
  database
    .prepare(
      `INSERT INTO recent (path, played_at, source, video_id, title, artist, url, thumbnail, duration)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         played_at=excluded.played_at, source=excluded.source, video_id=excluded.video_id,
         title=excluded.title, artist=excluded.artist, url=excluded.url,
         thumbnail=excluded.thumbnail, duration=excluded.duration`,
    )
    .run(
      key,
      Date.now(),
      entry.source === 'youtube' ? 'youtube' : 'local',
      entry.source === 'youtube' ? (entry.videoId ?? entry.id ?? null) : null,
      entry.title ?? '',
      entry.artist ?? entry.channel ?? '',
      entry.url ?? null,
      entry.thumbnail ?? null,
      entry.duration ?? 0,
    );
  database
    .prepare(
      `DELETE FROM recent WHERE path NOT IN (SELECT path FROM recent ORDER BY played_at DESC LIMIT ?)`,
    )
    .run(RECENT_LIMIT);
}

export function getRecentEntries(database, limit = 30) {
  return database
    .prepare(
      'SELECT path, source, video_id, title, artist, url, thumbnail, duration, played_at FROM recent ORDER BY played_at DESC LIMIT ?',
    )
    .all(limit)
    .map((r) => ({
      source: r.source === 'youtube' ? 'youtube' : 'local',
      path: r.source === 'youtube' ? null : r.path,
      videoId: r.video_id,
      title: r.title,
      artist: r.artist,
      url: r.url,
      thumbnail: r.thumbnail,
      duration: r.duration,
      playedAt: r.played_at,
    }));
}
