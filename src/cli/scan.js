import { existsSync, statSync } from 'node:fs';
import { scanLibraryCached } from '../library/library.js';
import { closeDatabase, openDatabase } from '../database/database.js';
import { musicDir } from '../utils/paths.js';
import { formatTime } from '../utils/formatTime.js';

export async function runScan() {
  const dir = musicDir();
  if (!existsSync(dir)) {
    process.stderr.write(`Music directory not found: ${dir}\n`);
    process.stderr.write('Create it and add audio files, e.g.:\n');
    process.stderr.write(`  mkdir -p ${dir}\n`);
    process.exitCode = 1;
    return;
  }
  const st = statSync(dir);
  if (!st.isDirectory()) {
    process.stderr.write(`Not a directory: ${dir}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Scanning ${dir} ...\n`);
  const started = Date.now();
  let database = null;
  try {
    database = openDatabase();
  } catch {
    database = null; // cache unavailable; scan still works
  }
  const { songs, failed, total, cached } = await scanLibraryCached(dir, database, {
    onProgress: (done, all) => {
      if (done === 1 || done === all || done % 50 === 0) {
        process.stdout.write(`\r  ${done}/${all} files...`);
      }
    },
  });
  closeDatabase();
  process.stdout.write('\r' + ' '.repeat(30) + '\r');

  const totalSecs = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  process.stdout.write(
    `✓ Found ${songs.length} song${songs.length === 1 ? '' : 's'} ` +
      `(${formatTime(totalSecs)} total) in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      (cached ? ` (${cached} from cache)` : '') +
      '\n',
  );
  if (failed.length > 0) {
    process.stdout.write(`  ${failed.length} file(s) unreadable (shown by filename where possible)\n`);
  }
  if (songs.length === 0 && total === 0) {
    process.stdout.write(`  No supported audio files found. Supported: .mp3 .flac .wav .ogg .m4a .aac\n`);
  }
}
