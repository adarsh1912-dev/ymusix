import { classifyYtDlpError } from './YouTubeService.js';
import { spawn } from 'node:child_process';

const cache = new Map(); // normalized query -> { at, results }
const CACHE_LIMIT = 20;
const CACHE_TTL_MS = 10 * 60 * 1000;

export function clearSearchCache() {
  cache.clear();
}

function runSearch(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try {
          child.kill('SIGTERM');
        } catch {
          // ignore
        }
        const err = new Error('Search timed out. Check your network connection.');
        err.code = 'timeout';
        reject(err);
      }
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (d) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (err?.code === 'ENOENT') {
        const missing = new Error('yt-dlp-missing');
        missing.code = 'missing';
        reject(missing);
      } else {
        reject(classifyYtDlpError(stderr));
      }
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(classifyYtDlpError(stderr));
      }
    });
  });
}

function normalizeEntry(entry) {
  if (!entry || typeof entry.id !== 'string') return null;
  const duration = Number(entry.duration);
  const thumbs = Array.isArray(entry.thumbnails) ? entry.thumbnails : [];
  const thumb = [...thumbs].reverse().find((t) => typeof t?.url === 'string')?.url ?? null;
  return {
    source: 'youtube',
    id: entry.id,
    title: typeof entry.title === 'string' && entry.title ? entry.title : entry.id,
    channel:
      (typeof entry.channel === 'string' && entry.channel) ||
      (typeof entry.uploader === 'string' && entry.uploader) ||
      'Unknown channel',
    duration: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0,
    viewCount: Number.isFinite(Number(entry.view_count)) ? Number(entry.view_count) : null,
    url:
      typeof entry.webpage_url === 'string' && entry.webpage_url
        ? entry.webpage_url
        : `https://www.youtube.com/watch?v=${entry.id}`,
    thumbnail: thumb,
  };
}

// Search YouTube via yt-dlp structured JSON. Returns { results, cached }.
// In-memory cache only; never persisted.
export async function searchYouTube(query, { limit = 10, timeoutMs = 30000 } = {}) {
  const q = String(query ?? '').trim();
  if (!q) return { results: [], cached: false };
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { results: hit.results, cached: true };
  }

  const n = Math.max(1, Math.min(25, Math.round(limit)));
  // The whole `ytsearchN:query` travels as ONE argv element — user input is
  // never shell-interpolated (spawn uses shell:false semantics by default).
  const { stdout } = await runSearch(
    [`ytsearch${n}:${q}`, '--flat-playlist', '--dump-single-json', '--no-warnings', '--socket-timeout', '10'],
    timeoutMs,
  );

  let entries = [];
  try {
    const parsed = JSON.parse(stdout);
    entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
  } catch {
    entries = [];
  }
  const results = entries.map(normalizeEntry).filter(Boolean).slice(0, n);

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), results });
  return { results, cached: false };
}
