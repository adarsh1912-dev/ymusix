import { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { COLORS } from '../ui/theme.js';

// Memoized static keymap: never re-executes on progress ticks.
export const Footer = memo(function Footer() {
  const { stdout } = useStdout();
  const small = (stdout?.columns ?? 80) < 90;
  if (small) {
    return (
      <Box paddingX={1}>
        <Text color={COLORS.MUTED}>↑↓ move · Enter play · Space · / search · h home · v now · q quit</Text>
      </Box>
    );
  }
  return (
    <Box paddingX={1} flexDirection="column">
      <Text color={COLORS.MUTED}>↑↓/jk move · Enter play · Space pause · ←/→ seek · n/p next/prev · h home · v now playing</Text>
      <Text color={COLORS.MUTED}>+/- vol · m mute · s shuffle · r repeat · a queue · d remove/dl · / search · Tab local/YT</Text>
      <Text color={COLORS.MUTED}>l library · t tabs · c queue/liked/recent · f favorite · x cancel dl · q quit</Text>
    </Box>
  );
});
