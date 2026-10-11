// Ymusix cinematic design system — single source of truth for color,
// spacing, glyphs and responsive breakpoints. Ink has no CSS: every screen
// must import from here instead of scattering hex values.
export const COLORS = {
  BG: '#08070D',
  BG2: '#171026',
  SURFACE: '#1E1433',
  ACCENT: '#7C3AED',
  PINK: '#FF4FA3',
  PINK_SOFT: '#FF8CCB',
  BLUE: '#4DA6FF',
  CYAN: '#7DD3FC',
  TEXT: '#FFFFFF',
  TEXT2: '#C9C4D6',
  MUTED: '#777185',
  BORDER: '#3B2D5D',
  OVERLAY: '#0D0A18',
  GREEN: '#34D399',
  RED: '#F87171',
  YELLOW: '#FBBF24',
};

export const GLYPHS = {
  LOGO: '♪',
  CURSOR: '❯',
  HEART: '♥',
  HEART_EMPTY: '♡',
  PLAY: '▶',
  PAUSE: '❚❚',
  PREV: '◀',
  NEXT: '▶',
  SHUFFLE: '🔀',
  REPEAT: '🔁',
  VOL: '🔊',
  MUTED: '🔇',
  LOCAL_DOT: '●',
  SEARCH: '🔍',
  HOME: '⌂',
  QUEUE: '≡',
  GEAR: '⚙',
  QUIT: '⏻',
  ART: '♫',
  BAR_FILL: '━',
  BAR_EMPTY: '─',
  BAR_HEAD: '○',
  SPINNER_FRAMES: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

// Responsive breakpoints (terminal columns). Ink gives us
// useStdout().columns — every screen must adapt, never overflow.
export function layoutMode(columns) {
  const w = columns ?? 80;
  if (w < 80) return 'small';
  if (w <= 120) return 'medium';
  return 'large';
}

export function sidebarMode(columns) {
  const w = columns ?? 80;
  if (w < 90) return 'collapsed'; // icons only
  return 'full';
}

export function truncate(str, max) {
  const chars = [...(str ?? '')];
  if (chars.length <= max) return str ?? '';
  if (max <= 1) return '…';
  return chars.slice(0, max - 1).join('') + '…';
}

// Clamp a row count to the available height so large playlists / queues
// never push the player bar off-screen.
export function fitRows({ height, reserved = 14, min = 5, max = 20 }) {
  const h = height ?? 24;
  return Math.max(min, Math.min(max, h - reserved));
}

export const FOCUS = {
  // Neon focus state used by sidebar + cards.
  selectedColor: COLORS.PINK_SOFT,
  cursorColor: COLORS.PINK,
};
