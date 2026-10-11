// Kitty terminal detection (text UI works everywhere; this only tunes
// markers and hints). No image rendering — ymusix is CLI-first.
let graphicsProbeCache = null;

export function isKitty() {
  if (process.env.KITTY_WINDOW_ID) return true;
  const term = process.env.TERM ?? '';
  if (term === 'xterm-kitty') return true;
  if ((process.env.TERM_PROGRAM ?? '').toLowerCase().includes('kitty')) return true;
  return false;
}

// Best-effort probe. True inside Kitty; false elsewhere
// (dumb CI terminals, tmux without passthrough, etc.). Cached.
export function supportsKittyGraphics() {
  if (graphicsProbeCache !== null) return graphicsProbeCache;
  if (process.env.YMUSIX_NO_GRAPHICS === '1') {
    graphicsProbeCache = false;
    return false;
  }
  graphicsProbeCache = isKitty();
  return graphicsProbeCache;
}
