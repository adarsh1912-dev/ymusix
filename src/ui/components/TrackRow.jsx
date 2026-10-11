import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../../utils/formatTime.js';
import { COLORS, layoutMode, truncate } from '../theme.js';

// Single shared row: neon cursor + heart + artwork dot + dense info.
// Used by library / favorites / recent / queue-next lists.
export function TrackRow({ index, numWidth, title, artist, duration, active, fav, source, titleW, artistW }) {
  return (
    <Text color={active ? COLORS.PINK_SOFT : undefined} bold={active}>
      {active ? '❯ ' : '  '}
      {String(index + 1).padStart(numWidth, ' ')}  {fav ? <Text color={COLORS.PINK}>♥ </Text> : '  '}
      {truncate(title, titleW).padEnd(titleW, ' ')}  {truncate(artist, artistW).padEnd(artistW, ' ')}  {formatTime(duration)}
      {source === 'youtube' ? <Text color={COLORS.RED}> ●YT</Text> : null}
    </Text>
  );
}

export function rowWidths(columns, count) {
  const numW = String(count).length;
  const timeW = 8;
  const avail = Math.max(20, columns - numW - timeW - 12);
  const titleW = Math.floor(avail * 0.52);
  return { numW, titleW, artistW: avail - titleW };
}

export function SectionTitle({ children }) {
  return (
    <Box paddingTop={1}>
      <Text bold color={COLORS.TEXT}>{children}</Text>
    </Box>
  );
}

export function useColumns() {
  const { stdout } = useStdout();
  return stdout?.columns ?? 80;
}

export function useLayout() {
  const c = useColumns();
  return { columns: c, mode: layoutMode(c) };
}
