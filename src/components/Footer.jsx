import { Box, Text } from 'ink';

export function Footer() {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text dimColor>↑↓/jk move · Enter play · Space pause · ←/→ seek · n/p next/prev</Text>
      <Text dimColor>+/- vol · m mute · s shuffle · r repeat · a queue · d remove/dl · / search</Text>
      <Text dimColor>l library · c queue/fav/recent · f favorite · x cancel dl · q quit</Text>
    </Box>
  );
}
