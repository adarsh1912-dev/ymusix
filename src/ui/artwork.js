// Local embedded artwork marker (text-only by design).
// - Embedded pictures are detected lazily via music-metadata (never blocks
//   playback); presence is shown as a neon framed marker.
// - <Artwork/> renders a stable framed marker so row heights never shift.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { parseFile } from 'music-metadata';
import { dataDir } from '../utils/paths.js';
import { COLORS } from './theme.js';
import { supportsKittyGraphics } from './kitty.js';

const memCache = new Map(); // path -> { thumbPath } | null (negative cache)

function artDir() {
  const d = path.join(dataDir(), 'art');
  try {
    mkdirSync(d, { recursive: true });
  } catch {
    // ignore
  }
  return d;
}

function hashPath(p) {
  return createHash('sha1').update(p).digest('hex').slice(0, 16);
}

export async function extractArtwork(songPath) {
  if (!songPath) return null;
  if (memCache.has(songPath)) return memCache.get(songPath);
  try {
    const meta = await parseFile(songPath, { duration: false });
    const pic = meta?.common?.picture?.[0];
    if (!pic?.data?.length) {
      memCache.set(songPath, null);
      return null;
    }
    const ext = (pic.format ?? '').includes('png') ? 'png' : 'jpg';
    const out = path.join(artDir(), `${hashPath(songPath)}.${ext}`);
    if (!existsSync(out)) {
      writeFileSync(out, Buffer.from(pic.data));
    }
    const info = { thumbPath: out };
    memCache.set(songPath, info);
    return info;
  } catch {
    memCache.set(songPath, null);
    return null;
  }
}

export function useArtwork(songPath) {
  const [art, setArt] = useState(() => memCache.get(songPath) ?? null);
  useEffect(() => {
    let alive = true;
    if (!songPath || memCache.has(songPath)) {
      setArt(memCache.get(songPath) ?? null);
      return;
    }
    void extractArtwork(songPath).then((a) => {
      if (alive) setArt(a);
    });
    return () => {
      alive = false;
    };
  }, [songPath]);
  return art;
}

function readThumbSize(thumbPath) {
  try {
    return readFileSync(thumbPath).length;
  } catch {
    return 0;
  }
}

// Small inline artwork marker. Local files with embedded pictures get a neon
// framed marker; YouTube tracks get the YT badge. Text-only by design.
export function Artwork({ songPath, size = 'md', source }) {
  const art = useArtwork(songPath);
  const w = size === 'lg' ? 22 : size === 'sm' ? 8 : 12;
  if (art?.thumbPath && supportsKittyGraphics() && readThumbSize(art.thumbPath) > 0) {
    // Marker only — pixel art is intentionally not rendered (CLI-first).
    return (
      <Box width={w} flexDirection="column">
        <Text color={COLORS.PINK_SOFT}>╭{'─'.repeat(Math.max(2, w - 2))}╮</Text>
        <Text color={COLORS.PINK_SOFT}>
          │<Text color={COLORS.PINK}>  ◉ ART  </Text>│
        </Text>
        <Text color={COLORS.PINK_SOFT}>╰{'─'.repeat(Math.max(2, w - 2))}╯</Text>
      </Box>
    );
  }
  if (source === 'youtube') {
    return (
      <Box width={w} justifyContent="center">
        <Text color={COLORS.RED}>▶ YT</Text>
      </Box>
    );
  }
  return (
    <Box width={w} justifyContent="center">
      <Text color={COLORS.ACCENT}>♫</Text>
    </Box>
  );
}
