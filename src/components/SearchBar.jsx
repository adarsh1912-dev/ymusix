import { Box, Text } from 'ink';

export function SearchBar({ query, count }) {
  return (
    <Box>
      <Text>
        Search: <Text bold>{query}</Text>
        <Text inverse> </Text>
        <Text dimColor>
          {' '}
          ({count} match{count === 1 ? '' : 'es'} · Enter play · Esc close)
        </Text>
      </Text>
    </Box>
  );
}
