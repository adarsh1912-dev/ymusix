import { Box, Text } from 'ink';
import { COLORS } from '../ui/theme.js';

// Legacy header kept for compatibility; App now prefers TopBar + Sidebar.
// Restyled to the cinematic palette so standalone uses still match.
export function Header() {
  return (
    <Box paddingX={1} justifyContent="center">
      <Text bold color={COLORS.PINK_SOFT}>♪ YMUSIX</Text>
      <Text color={COLORS.MUTED}> · cinematic</Text>
    </Box>
  );
}
