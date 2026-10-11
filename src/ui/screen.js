// Alternate-screen management. ymusix runs fullscreen like vim/htop: the
// TUI lives on a separate screen with no scrollback, so progress ticks and
// download updates can never append duplicate frames above the app, and
// scrolling simply doesn't interact with the UI. All functions are
// idempotent and no-op on non-TTY stdout (piped/CI).
let active = false;

function out() {
  return process.stdout;
}

export function isAltScreen() {
  return active;
}

export function enterAltScreen() {
  if (active) return;
  try {
    const s = out();
    if (!s || s.isTTY !== true) return;
    s.write('\x1b[?1049h\x1b[H');
    active = true;
  } catch {
    // ignore: app works inline without it
  }
}

export function leaveAltScreen() {
  if (!active) return;
  active = false;
  try {
    out().write('\x1b[?1049l');
  } catch {
    // ignore
  }
}
