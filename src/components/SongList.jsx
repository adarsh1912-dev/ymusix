import { memo } from 'react';
import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../utils/formatTime.js';
import { COLORS, truncate as truncateTheme, fitRows } from '../ui/theme.js';

export const LIST_WINDOW = 15;

function truncate(str, max) {
  return truncateTheme(str, max);
}

// Memoized: list props are stable across progress ticks, so the list never
// re-executes while the player bar updates. Windowing also guarantees the
// frame fits the terminal, so Ink updates in place instead of appending
// duplicate frames to the scrollback.
export const SongList = memo(function SongList({ songs, selected, favorites }) {
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;
  const window = Math.min(LIST_WINDOW, fitRows({ height, reserved: 18, min: 5, max: LIST_WINDOW }));

  const half = Math.floor(window / 2);
  let start = Math.max(0, selected - half);
  start = Math.min(start, Math.max(0, songs.length - window));
  const visible = songs.slice(start, start + window);

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
          <Text key={key} color={active ? COLORS.PINK_SOFT : undefined} bold={active}>
            {active ? '❯ ' : '  '}
            {String(idx + 1).padStart(numW, ' ')}  {fav ? <Text color={COLORS.PINK}>♥ </Text> : '  '}
            {truncate(song.title, titleW).padEnd(titleW, ' ')}  {truncate(song.artist, artistW).padEnd(artistW, ' ')}  {formatTime(song.duration)}
            {song.source === 'youtube' ? <Text color={COLORS.RED}> ●YT</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
});
