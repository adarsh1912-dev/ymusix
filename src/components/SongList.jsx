import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../utils/formatTime.js';

export const LIST_WINDOW = 15;

function truncate(str, max) {
  const chars = [...(str ?? '')];
  if (chars.length <= max) return str ?? '';
  if (max <= 1) return '…';
  return chars.slice(0, max - 1).join('') + '…';
}

export function SongList({ songs, selected, favorites }) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;

  const half = Math.floor(LIST_WINDOW / 2);
  let start = Math.max(0, selected - half);
  start = Math.min(start, Math.max(0, songs.length - LIST_WINDOW));
  const visible = songs.slice(start, start + LIST_WINDOW);

  const numW = String(songs.length).length;
  const timeW = 8; // "01:02:15"
  const avail = Math.max(20, width - numW - timeW - 10);
  const titleW = Math.floor(avail * 0.52);
  const artistW = avail - titleW;

  return (
    <Box flexDirection="column">
      {visible.map((song, i) => {
        const idx = start + i;
        const active = idx === selected;
        const fav = favorites?.has(song.source === 'youtube' ? `yt:${song.id}` : song.path);
        const key = song.source === 'youtube' ? `yt:${song.id}` : song.path;
        return (
          <Text key={key} color={active ? 'green' : undefined} bold={active}>
            {active ? '❯ ' : '  '}
            {String(idx + 1).padStart(numW, ' ')}  {fav ? '♥ ' : '  '}
            {truncate(song.title, titleW).padEnd(titleW, ' ')}  {truncate(song.artist, artistW).padEnd(artistW, ' ')}  {formatTime(song.duration)}
          </Text>
        );
      })}
    </Box>
  );
}
