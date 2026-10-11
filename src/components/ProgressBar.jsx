import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../utils/formatTime.js';
import { COLORS } from '../ui/theme.js';

export function ProgressBar({ position, duration }) {
  const { stdout } = useStdout();
  const totalWidth = Math.max(40, (stdout?.columns ?? 80) - 8);
  const barWidth = Math.max(10, totalWidth - 20); // room for " 01:42 / 03:20"

  const frac = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const filled = Math.round(frac * barWidth);
  const bar =
    '━'.repeat(filled) + (filled < barWidth ? '○' + '─'.repeat(barWidth - filled - 1) : '○');

  return (
    <Box flexDirection="column">
      <Text color={COLORS.PINK}>{bar}</Text>
      <Text color={COLORS.MUTED}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>
    </Box>
  );
}
