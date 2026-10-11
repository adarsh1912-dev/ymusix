import { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../utils/formatTime.js';
import { formatViews } from '../utils/formatViews.js';
import { COLORS, fitRows, truncate as truncateTheme } from '../ui/theme.js';

function truncate(str, max) {
  return truncateTheme(str, max);
}

function viewsSuffix(viewCount) {
  return viewCount != null ? ` · ${formatViews(viewCount)}` : '';
}

// Memoized + windowed: 2 lines per result, sliced to fit so the frame stays
// in-place updatable. Selection index stays global.
export const YouTubeResults = memo(function YouTubeResults({ results, selected }) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;
  const titleW = Math.max(20, width - 8);
  const perRow = 2;
  const count = Math.min(results.length, Math.max(2, Math.floor(Math.max(4, fitRows({ height, reserved: 18, min: 4, max: 20 })) / perRow)));
  const start = Math.max(0, Math.min(selected - 1, results.length - count));

  return (
    <Box flexDirection="column">
      <Text color={COLORS.MUTED}>YOUTUBE RESULTS — Enter stream · a queue · d download · Esc back</Text>
      {results.slice(start, start + count).map((r, k) => {
        const i = start + k;
        const active = i === selected;
        return (
          <Box key={r.id} flexDirection="column">
            <Text color={active ? COLORS.PINK_SOFT : undefined} bold={active}>
              {active ? '❯ ' : '  '}
              {String(i + 1).padStart(2, ' ')}  {truncate(r.title, titleW)}
            </Text>
            <Text color={COLORS.MUTED}>
              {'     '}
              {truncate(`${r.channel} · ${formatTime(r.duration)}${viewsSuffix(r.viewCount)}`, titleW)}
            </Text>
          </Box>
        );
      })}
      {results.length > count && (
        <Text color={COLORS.MUTED}>… {results.length - count} more — ↑↓ to scroll</Text>
      )}
    </Box>
  );
});
