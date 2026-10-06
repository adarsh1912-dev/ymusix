import { execFile, spawn } from 'node:child_process';

export const YTDLP_INSTALL_HINT = `yt-dlp is not installed.

Ymusix uses yt-dlp for YouTube search, streaming, and downloads.

Install it with:
  Arch:           sudo pacman -S yt-dlp
  Debian/Ubuntu:  sudo apt install yt-dlp
  Fedora:         sudo dnf install yt-dlp`;

export const FFMPEG_INSTALL_HINT = `ffmpeg is required for audio extraction.

Install it with:
  Arch:           sudo pacman -S ffmpeg
  Debian/Ubuntu:  sudo apt install ffmpeg
  Fedora:         sudo dnf install ffmpeg`;

export function checkYtDlp() {
  return new Promise((resolve) => {
    execFile('yt-dlp', ['--version'], { timeout: 8000 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, hint: YTDLP_INSTALL_HINT });
        return;
      }
      resolve({ ok: true, version: String(stdout).trim().split('\n')[0] });
    });
  });
}

export function checkFfmpeg() {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], { timeout: 8000 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, hint: FFMPEG_INSTALL_HINT });
        return;
      }
      resolve({ ok: true, version: String(stdout).split('\n')[0]?.trim() ?? 'ffmpeg' });
    });
  });
}

// Only allow genuine YouTube watch/share URLs through to yt-dlp.
export function validateYouTubeUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  if (host === 'youtu.be') {
    return /^\/[\w-]{6,}$/.test(parsed.pathname);
  }
  if (host === 'www.youtube.com' || host === 'youtube.com' || host === 'music.youtube.com') {
    return parsed.pathname === '/watch' && /^[\w-]{6,}$/.test(parsed.searchParams.get('v') ?? '');
  }
  return false;
}

export function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Classify raw yt-dlp failures into concise user-facing errors. Never leaks
// raw stderr dumps to the UI; callers use err.code/err.message.
export function classifyYtDlpError(stderr, { fallback = 'network' } = {}) {
  const text = String(stderr ?? '');
  if (/private video|video unavailable|has been removed|deleted/i.test(text)) {
    const err = new Error('This video is unavailable.');
    err.code = 'unavailable';
    return err;
  }
  if (/age|sign in|log in|cookies/i.test(text)) {
    const err = new Error('This video needs sign-in or is age-restricted.');
    err.code = 'auth';
    return err;
  }
  if (/timed out|timeout/i.test(text)) {
    const err = new Error('The request timed out. Check your network connection.');
    err.code = 'timeout';
    return err;
  }
  const err = new Error(
    fallback === 'download'
      ? 'Download failed. The video may be unavailable or the connection may have failed.'
      : 'Unable to reach YouTube. Check your network connection.',
  );
  err.code = fallback === 'download' ? 'download-failed' : 'network';
  return err;
}

function runYtDlp(args, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    // shell:false default for spawn with argv array — user input (the query)
    // travels as a single argv element, never interpolated.
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
        const err = new Error('The request timed out. Check your network connection.');
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
        missing.hint = YTDLP_INSTALL_HINT;
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

const streamCache = new Map(); // videoId -> { url, at }
const STREAM_TTL_MS = 2 * 60 * 60 * 1000;

export function clearStreamCache() {
  streamCache.clear();
}

// Resolve a direct audio stream URL for mpv. Cached (stream URLs expire).
export async function resolveStreamUrl(video) {
  const cached = streamCache.get(video.id);
  if (cached && Date.now() - cached.at < STREAM_TTL_MS) {
    return cached.url;
  }
  const pageUrl = video.url && validateYouTubeUrl(video.url) ? video.url : watchUrl(video.id);
  const { stdout, stderr } = await runYtDlp(
    ['-g', '-f', 'bestaudio/best', '--no-warnings', '--socket-timeout', '10', pageUrl],
    { timeoutMs: 45000 },
  ).catch((err) => {
    if (err.code === 'missing') throw err;
    throw classifyYtDlpError(stderr || err.message);
  });
  const url = stdout.trim().split('\n')[0]?.trim() ?? '';
  if (!/^https?:\/\//.test(url)) {
    const err = new Error('Could not resolve a playable stream for this video.');
    err.code = 'unresolvable';
    throw err;
  }
  if (streamCache.size >= 50) {
    const oldest = streamCache.keys().next();
    if (!oldest.done) streamCache.delete(oldest.value);
  }
  streamCache.set(video.id, { url, at: Date.now() });
  return url;
}
