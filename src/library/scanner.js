import { readdir, stat } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { SUPPORTED_EXTENSIONS } from './formats.js';

// Recursively collect supported audio files. Never throws for bad files or
// unreadable dirs — those are skipped and counted.
export async function findAudioFiles(rootDir) {
  const files = [];
  const skipped = { dirs: 0, files: 0 };
  const seenDirs = new Set();

  async function walk(dir) {
    let real;
    try {
      const st = await stat(dir);
      if (!st.isDirectory()) return;
      // Cycle guard (symlinked dirs): key on dev:ino
      const key = `${st.dev}:${st.ino}`;
      if (seenDirs.has(key)) return;
      seenDirs.add(key);
      real = dir;
    } catch {
      skipped.dirs += 1;
      return;
    }

    let entries;
    try {
      entries = await readdir(real, { withFileTypes: true });
    } catch {
      skipped.dirs += 1;
      return;
    }

    for (const entry of entries) {
      const full = join(real, entry.name);
      try {
        if (entry.isSymbolicLink()) {
          const st = await stat(full);
          if (st.isDirectory()) {
            await walk(full);
          } else if (
            st.isFile() &&
            SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())
          ) {
            files.push({ path: resolve(full), mtime: st.mtimeMs, size: st.size });
          }
        } else if (entry.isDirectory()) {
          await walk(full);
        } else if (
          entry.isFile() &&
          SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())
        ) {
          const st = await stat(full);
          files.push({ path: resolve(full), mtime: st.mtimeMs, size: st.size });
        }
      } catch {
        skipped.files += 1;
      }
    }
  }

  await walk(resolve(rootDir));
  return { files, skipped };
}
