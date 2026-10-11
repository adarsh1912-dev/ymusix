import { memo } from 'react';
import { Box, Text } from 'ink';
import { COLORS, GLYPHS, sidebarMode } from '../theme.js';

const ITEMS = [
  { id: 'home', icon: '⌂', label: 'Home', hint: 'h' },
  { id: 'search', icon: '🔍', label: 'Search', hint: '/' },
  { id: 'library', icon: '♫', label: 'Library', hint: 'l' },
  { id: 'queue', icon: '≡', label: 'Queue', hint: 'c' },
  { id: 'favorites', icon: '♡', label: 'Liked', hint: 'c' },
  { id: 'recent', icon: '◷', label: 'Recent', hint: 'c' },
  { id: 'now', icon: '◉', label: 'Now', hint: 'v' },
];

// Minimal cinematic sidebar. Selection follows App `view` state; keyboard
// stays unchanged (h / / l / c / v). Collapses to icons under 90 columns.
// Memoized: selection follows view state, so this never re-executes on
// progress ticks.
export const Sidebar = memo(function Sidebar({ view, columns, searchActive }) {
  const mode = sidebarMode(columns);
  const activeId = searchActive ? 'search' : view === 'home' ? 'home' : view === 'now' ? 'now' : view;
  const width = mode === 'collapsed' ? 6 : 18;
  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      <Text bold color={COLORS.PINK_SOFT}>
        {mode === 'collapsed' ? GLYPHS.LOGO : `${GLYPHS.LOGO} Ymusix`}
      </Text>
      <Text color={COLORS.BORDER}>──────────────</Text>
      {ITEMS.map((it) => {
        const active = activeId === it.id || (it.id === 'queue' && ['queue', 'favorites', 'recent'].includes(activeId) && activeId === it.id);
        const isActive = activeId === it.id;
        return (
          <Text key={it.id} color={isActive ? COLORS.PINK_SOFT : COLORS.TEXT2} bold={isActive}>
            {isActive ? `${GLYPHS.CURSOR} ` : '  '}
            {it.icon}
            {mode === 'full' ? ` ${it.label}` : ''}
          </Text>
        );
      })}
      <Text color={COLORS.BORDER}>──────────────</Text>
      <Text color={COLORS.MUTED}>{mode === 'full' ? `${GLYPHS.GEAR} Settings` : GLYPHS.GEAR}</Text>
      <Text color={COLORS.MUTED}>{mode === 'full' ? `${GLYPHS.QUIT} Quit (q)` : GLYPHS.QUIT}</Text>
    </Box>
  );
});
