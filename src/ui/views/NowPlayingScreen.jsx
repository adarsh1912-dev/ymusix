import { Box, Text } from 'ink';
import { COLORS, truncate } from '../theme.js';
import { Artwork } from '../artwork.js';
import { useLayout } from '../components/TrackRow.jsx';

// Immersive Now Playing: big artwork marker, title/artist, lyric-ambient
// placeholder (no lyrics backend exists — atmospheric lines, never fake
// synced lyrics), progress + transport.
export function NowPlayingScreen({ song, source, isPlaying, position, duration, volume, muted, shuffle, repeatMode }) {
  const { mode } = useLayout();
  if (!song) {
    return (
      <Box flexDirection="column" alignItems="center" paddingY={2}>
        <Text color={COLORS.MUTED}>Nothing playing — pick a track and press Enter.</Text>
      </Box>
    );
  }
  const dur = duration || song.duration || 0;
  const frac = dur > 0 ? Math.min(1, Math.max(0, position / dur)) : 0;
  const barW = mode === 'small' ? 24 : 44;
  const filled = Math.round(frac * barW);
  const bar = '━'.repeat(filled) + '○' + '─'.repeat(Math.max(0, barW - filled - 1));
  const mm = (s) => {
    if (!Number.isFinite(s) || s < 0) return '00:00';
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Text bold color={COLORS.PINK_SOFT}>NOW PLAYING</Text>
      <Box paddingY={1}>
        <Artwork songPath={song.path} size="lg" source={source} />
      </Box>
      <Text bold color={COLORS.TEXT}>{truncate(song.title, 40)}</Text>
      <Text color={COLORS.TEXT2}>{truncate(song.artist, 40)}</Text>
      <Text color={COLORS.PINK}>♡</Text>
      <Box paddingY={1} flexDirection="column" alignItems="center">
        <Text color={COLORS.MUTED}>─── ♪ ambient mix ♪ ───</Text>
        <Text color={COLORS.TEXT2}>late night · neon glow · volume {muted ? 'muted' : `${volume}%`}</Text>
      </Box>
      <Text><Text color={COLORS.MUTED}>{mm(position)} </Text><Text color={COLORS.PINK}>{bar}</Text><Text color={COLORS.MUTED}> {mm(dur)}</Text></Text>
      <Box paddingTop={1}>
        <Text color={COLORS.TEXT2}>◀  {isPlaying ? '❚❚' : '▶'}  ▶   ·  {shuffle ? '🔀 on' : '🔀 off'} · 🔁 {repeatMode?.toUpperCase() ?? 'OFF'}</Text>
      </Box>
    </Box>
  );
}
