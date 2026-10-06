import { Box, Text } from 'ink';

function badge(source) {
  return source === 'youtube' ? '● YouTube' : '● Local';
}

function describe(track) {
  if (!track) return '';
  const artist = track.source === 'youtube' ? track.channel : track.artist;
  return `${track.title} — ${artist}`;
}

export function QueueView({ current, currentSource, explicit, upNext, selected }) {
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
    return <Text dimColor>Queue is empty — press a on a song to add it.</Text>;
  }
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => {
        const key = row.kind === 'current' ? 'current' : `${row.kind}-${row.track.source}-${row.track.source === 'youtube' ? row.track.id : row.track.path}`;
        return (
          <Text key={key} color={i === selected ? 'green' : undefined} bold={i === selected}>
            {i === selected ? '❯ ' : '  '}
            {row.label}: {describe(row.track)}
          </Text>
        );
      })}
    </Box>
  );
}
