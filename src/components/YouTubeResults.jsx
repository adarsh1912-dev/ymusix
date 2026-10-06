import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../utils/formatTime.js';
import { formatViews } from '../utils/formatViews.js';

function truncate(str, max) {
  const chars = [...(str ?? '')];
  if (chars.length <= max) return str ?? '';
  if (max <= 1) return '…';
  return chars.slice(0, max - 1).join('') + '…';
}

export function YouTubeResults({ results, selected }) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const titleW = Math.max(20, width - 8);

  return (
    <Box flexDirection="column">
      <Text dimColor>YOUTUBE RESULTS — Enter stream · a queue · d download · Esc back</Text>
      {results.map((r, i) => {
        const active = i === selected;
        const views = r.viewCount != null ? ` · ${formatViews(r.viewCount)}` : '';
        return (
          <Box key={r.id} flexDirection="column">
            <Text color={active ? 'green' : undefined} bold={active}>
              {active ? '❯ ' : '  '}
              {truncate(r.title, titleW)}
            </Text>
            <Text dimColor>
              {'     '}
              {truncate(`${r.channel} · ${formatTime(r.duration)}${views}`, titleW)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
