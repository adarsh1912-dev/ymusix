import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function getVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // src/cli -> ../../package.json; bundled dist/cli.js -> ../package.json
    const candidates = [
      join(here, '..', 'package.json'),
      join(here, '..', '..', 'package.json'),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf8'));
        if (pkg.version) return pkg.version;
      } catch {
        // try next
      }
    }
  } catch {
    // ignore
  }
  return '0.1.0';
}
