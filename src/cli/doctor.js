import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { unlink } from 'node:fs/promises';
import { get } from 'node:https';
import { checkMpv } from '../player/check.js';
import { checkFfmpeg, checkYtDlp } from '../online/YouTubeService.js';
import { dataDir, dbPath, musicDir } from '../utils/paths.js';

function canWrite(dir) {
  try {
    mkdirSync(dir, { recursive: true });
    accessSync(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function canCreateSocket() {
  const path = join(tmpdir(), `ymusix-doctor-${process.pid}.sock`);
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(path, () => {
      server.close(() => {
        unlink(path)
          .then(() => resolve(true))
          .catch(() => resolve(true));
      });
    });
  });
}

// Non-blocking connectivity probe. Failure is informational only — local
// playback never depends on the network.
function checkNetwork() {
  return new Promise((resolve) => {
    const req = get('https://www.youtube.com/generate_204', { timeout: 8000 }, (res) => {
      res.resume();
      resolve(res.statusCode < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

export async function runDoctor() {
  const results = [];
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  results.push({
    name: `Node.js ${process.versions.node} (>= 22 required)`,
    ok: nodeMajor >= 22,
  });

  const mpv = await checkMpv();
  results.push({ name: mpv.ok ? `${mpv.version}` : 'mpv installed and executable', ok: mpv.ok });

  const ytdlp = await checkYtDlp();
  results.push({
    name: ytdlp.ok ? `yt-dlp ${ytdlp.version} (YouTube search/stream/download)` : 'yt-dlp installed and executable',
    ok: ytdlp.ok,
    hint: ytdlp.hint,
    optional: true,
  });

  const ff = await checkFfmpeg();
  results.push({
    name: ff.ok ? `${ff.version.split('Copyright')[0].trim()} (download extraction)` : 'ffmpeg installed and executable',
    ok: ff.ok,
    hint: ff.hint,
    optional: true,
  });

  const music = musicDir();
  const musicOk = existsSync(music);
  results.push({ name: `Music directory ${music} exists`, ok: musicOk });
  if (musicOk) {
    try {
      accessSync(music, constants.R_OK);
      results.push({ name: 'Music directory is readable', ok: true });
    } catch {
      results.push({ name: 'Music directory is readable', ok: false });
    }
  }

  results.push({ name: `Data directory ${dataDir()} writable (db: ${dbPath()})`, ok: canWrite(dataDir()) });
  results.push({
    name: `SQLite database ${existsSync(dbPath()) ? 'present' : 'will be created on first run'}: ${dbPath()}`,
    ok: true,
  });
  results.push({ name: 'Can create IPC socket in /tmp', ok: await canCreateSocket() });
  const netOk = await checkNetwork();
  results.push({
    name: netOk ? 'Network connectivity (YouTube reachable)' : 'Network connectivity (YouTube unreachable — local playback unaffected)',
    ok: netOk,
    optional: true,
  });

  let fail = 0;
  for (const r of results) {
    const mark = r.ok ? '✓' : r.optional ? '○' : '✗';
    process.stdout.write(`${mark} ${r.name}\n`);
    if (!r.ok && !r.optional) fail += 1;
  }

  for (const r of results) {
    if (!r.ok && r.hint) process.stdout.write(`\n${r.hint}\n`);
  }
  if (fail > 0) {
    process.stdout.write(`\n${fail} required check(s) failed.\n`);
    process.exitCode = 1;
  } else if (results.some((r) => !r.ok)) {
    process.stdout.write('\nLocal checks passed (some optional online features unavailable).\n');
  } else {
    process.stdout.write('\nAll checks passed.\n');
  }
}
