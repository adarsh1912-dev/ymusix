import { Box, Text } from 'ink';
import { COLORS } from '../ui/theme.js';

export function SearchBar({ query, count }) {
  return (
    <Box>
      <Text>
        <Text color={COLORS.PINK}>🔍 </Text>Search songs, artists, albums…{' '}
        <Text bold color={COLORS.TEXT}>{query}</Text>
        <Text inverse> </Text>
        <Text color={COLORS.MUTED}>
          {' '}
          ({count} match{count === 1 ? '' : 'es'} · Enter play · Esc close)
        </Text>
      </Text>
    </Box>
  );
}
