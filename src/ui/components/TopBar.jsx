import { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { COLORS, layoutMode } from '../theme.js';

// Cinematic top bar: greeting + context + search/settings hints.
// Replaces the old boxed "YMUSIX" header with a breathable dashboard strip.
// Memoized: greeting/title only change on view/hour change, never on ticks.
// compact hides the greeting block so short terminals still fit the frame.
export const TopBar = memo(function TopBar({ view, songCount, searchActive, compact = false }) {
  const { stdout } = useStdout();
  const mode = layoutMode(stdout?.columns ?? 80);
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'GOOD NIGHT' : hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const title = view === 'home' ? 'Home' : view === 'now' ? 'Now Playing' : view === 'queue' ? 'Queue' : view === 'favorites' ? 'Liked' : view === 'recent' ? 'Recent' : searchActive ? 'Search' : 'Library';
  return (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold color={COLORS.TEXT}>
          ♪ Ymusix <Text color={COLORS.MUTED}>· {title}</Text>
        </Text>
        {mode !== 'small' && (
          <Text color={COLORS.MUTED}>
            Search <Text color={COLORS.TEXT2}>/</Text> · <Text color={COLORS.TEXT2}>⚙</Text>
          </Text>
        )}
      </Box>
      {view === 'home' && mode !== 'small' && !compact && (
        <Box flexDirection="column" paddingY={1}>
          <Text bold color={COLORS.TEXT}>{greeting}</Text>
          <Text color={COLORS.TEXT2}>
            {songCount} tracks in your universe
          </Text>
        </Box>
      )}
    </Box>
  );
});
