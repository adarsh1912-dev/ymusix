import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { musicDir } from '../utils/paths.js';
import {
  checkFfmpeg,
  checkYtDlp,
  classifyYtDlpError,
  validateYouTubeUrl,
  watchUrl,
} from '../online/YouTubeService.js';

const PROGRESS_RE =
  /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+(\S+).*?at\s+(\S+).*?ETA\s+(\S+)/;

// Dedicated yt-dlp download service. Emits:
//   'progress' { id, title, pct, size, speed, eta }
//   'done'     { id, title, path }
//   'error'    { id, title, message }
//   'cancelled'{ id, title }
// One download at a time; callers check isBusy() first. Never touches React.
export class YouTubeDownloader extends EventEmitter {
  constructor() {
    super();
    this.child = null;
    this.current = null; // { id, title }
    this.dead = false;
  }

  isBusy() {
    return !!this.child;
  }

  async download(video) {
    if (this.child) {
      const err = new Error('A download is already in progress.');
      err.code = 'busy';
      throw err;
    }
    const yt = await checkYtDlp();
    if (!yt.ok) {
      const err = new Error('yt-dlp-missing');
      err.code = 'missing';
      err.hint = yt.hint;
      throw err;
    }
    const ff = await checkFfmpeg();
    if (!ff.ok) {
      const err = new Error('ffmpeg-missing');
      err.code = 'ffmpeg-missing';
      err.hint = ff.hint;
      throw err;
    }
    const pageUrl =
      video.url && validateYouTubeUrl(video.url) ? video.url : watchUrl(video.id);
    const dir = musicDir();
    mkdirSync(dir, { recursive: true });

    this.dead = false;
    this.current = { id: video.id, title: video.title };
    this.emit('start', { ...this.current });

    return new Promise((resolve, reject) => {
      // argv array, no shell: user-controlled title/url never interpolated.
      // detached:true makes the child a process-group leader so cancel can
      // also kill grandchildren (ffmpeg keeps downloading otherwise and
      // holds our pipes open, which would delay 'close' indefinitely).
      const child = spawn(
        'yt-dlp',
        [
          '-x',
          '--audio-format',
          'mp3',
          '--audio-quality',
          '0',
          '--embed-metadata',
          '--embed-thumbnail',
          '--no-playlist',
          '--newline',
          '--progress',
          '--no-warnings',
          '--print',
          'after_move:filepath',
          '-o',
          join(dir, '%(title)s [%(id)s].%(ext)s'),
          pageUrl,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
      );
      this.child = child;
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        this.child = null;
        fn(value);
      };

      child.stdout.on('data', (d) => {
        const text = d.toString('utf8');
        stdout += text;
        for (const line of text.split('\n')) {
          const m = line.match(PROGRESS_RE);
          if (m) {
            this.emit('progress', {
              id: video.id,
              title: video.title,
              pct: Math.min(100, parseFloat(m[1])),
              size: m[2],
              speed: m[3],
              eta: m[4],
            });
          }
        }
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString('utf8');
      });
      child.on('error', (err) => {
        this.cleanPartials(video.id);
        if (err?.code === 'ENOENT') {
          const missing = new Error('yt-dlp-missing');
          missing.code = 'missing';
          this.emit('error', { id: video.id, title: video.title, message: missing.message, code: 'missing' });
          finish(reject, missing);
        } else {
          const classified = classifyYtDlpError(stderr, { fallback: 'download' });
          this.emit('error', { id: video.id, title: video.title, message: classified.message, code: classified.code });
          finish(reject, classified);
        }
      });
      child.on('close', (code) => {
        if (this.dead) {
          this.cleanPartials(video.id);
          const info = { id: video.id, title: video.title };
          this.emit('cancelled', info);
          const err = new Error('Download cancelled.');
          err.code = 'cancelled';
          finish(reject, err);
          return;
        }
        if (code === 0) {
          const finalPath = this.findResult(dir, video.id, stdout);
          if (!finalPath) {
            const err = new Error('Download finished but the audio file was not found.');
            err.code = 'not-found';
            this.emit('error', { id: video.id, title: video.title, message: err.message, code: err.code });
            finish(reject, err);
            return;
          }
          const info = { id: video.id, title: video.title, path: finalPath };
          this.emit('done', info);
          finish(resolve, info);
        } else {
          this.cleanPartials(video.id);
          const classified = classifyYtDlpError(stderr, { fallback: 'download' });
          this.emit('error', { id: video.id, title: video.title, message: classified.message, code: classified.code });
          finish(reject, classified);
        }
      });
    });
  }

  // Preferred: the after_move:filepath print; fallback: newest "*[id].mp3".
  findResult(dir, videoId, stdout) {
    const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.endsWith('.mp3') && line.includes(videoId) && existsSync(line)) {
        return line;
      }
    }
    try {
      const entries = readdirSync(dir)
        .filter((f) => f.includes(videoId) && f.endsWith('.mp3'))
        .map((f) => join(dir, f));
      if (entries.length > 0) {
        entries.sort();
        return entries[entries.length - 1];
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Remove only partial/temp files — never a completed *.mp3, which could be
  // a previous successful download of the same video. Thumbnails (*.webp)
  // are safe: they are never library content and are re-fetched as needed.
  cleanPartials(videoId) {
    try {
      for (const f of readdirSync(musicDir())) {
        if (
          f.includes(videoId) &&
          (f.endsWith('.part') ||
            f.includes('.part-') ||
            f.endsWith('.ytdl') ||
            f.includes('.temp.') ||
            f.endsWith('.webp'))
        ) {
          try {
            unlinkSync(join(musicDir(), f));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Kill the whole process group (yt-dlp + ffmpeg), not just the child.
  killTree(signal) {
    const child = this.child;
    if (!child) return;
    try {
      if (process.platform !== 'win32' && child.pid) {
        process.kill(-child.pid, signal);
        return;
      }
      child.kill(signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // already gone
      }
    }
  }

  cancel() {
    if (!this.child) return false;
    this.dead = true;
    this.killTree('SIGTERM');
    setTimeout(() => {
      if (this.child) this.killTree('SIGKILL');
    }, 3000).unref?.();
    return true;
  }

  // Idempotent; safe from exit/signal handlers.
  async quit() {
    this.cancel();
  }
}
