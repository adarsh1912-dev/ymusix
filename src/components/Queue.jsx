import { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { COLORS, fitRows } from '../ui/theme.js';

function badge(source) {
  return source === 'youtube' ? '● YouTube' : '● Local';
}

function describe(track) {
  if (!track) return '';
  const artist = track.source === 'youtube' ? track.channel : track.artist;
  return `${track.title} — ${artist}`;
}

// Memoized + windowed: flattened rows are sliced to fit the terminal so the
// frame stays in-place updatable. Selection index stays global.
export const QueueView = memo(function QueueView({ current, currentSource, explicit, upNext, selected }) {
  const { stdout } = useStdout();
  const rows = [];
  if (current) {
    rows.push({ label: `▶ Currently Playing [${badge(currentSource)}]`, track: current, kind: 'current' });
  }
  for (const track of explicit) {
    rows.push({ label: `  Queued [${badge(track.source)}] (d removes)`, track, kind: 'explicit' });
  }
  for (const song of upNext) {
    rows.push({ label: `  Up next [${badge(song.source ?? 'local')}]`, track: song, kind: 'upnext' });
  }
  if (rows.length === 0) {
    return <Text color={COLORS.MUTED}>Queue is empty — press a on a song to add it.</Text>;
  }
  const height = stdout?.rows ?? 24;
  const count = Math.min(rows.length, fitRows({ height, reserved: 18, min: 4, max: rows.length }));
  const start = Math.max(0, Math.min(selected - 1, rows.length - count));
  const windowed = rows.slice(start, start + count);
  return (
    <Box flexDirection="column">
      {windowed.map((row, k) => {
        const i = start + k;
        const key = row.kind === 'current' ? 'current' : `${row.kind}-${row.track.source}-${row.track.source === 'youtube' ? row.track.id : row.track.path}`;
        const isCurrent = row.kind === 'current';
        return (
          <Text key={key} color={i === selected ? COLORS.PINK_SOFT : isCurrent ? COLORS.TEXT : undefined} bold={i === selected || isCurrent}>
            {i === selected ? '❯ ' : '  '}
            {isCurrent ? '▶ ' : ''}{row.label}: {describe(row.track)}
          </Text>
        );
      })}
      {rows.length > count && (
        <Text color={COLORS.MUTED}>… {rows.length - count} more — ↑↓ to scroll</Text>
      )}
    </Box>
  );
});
