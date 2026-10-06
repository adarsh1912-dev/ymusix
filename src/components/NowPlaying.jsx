import { Box, Text } from 'ink';
import { ProgressBar } from './ProgressBar.jsx';

export function NowPlaying({
  song,
  isPlaying,
  position,
  duration,
  volume,
  muted,
  shuffle,
  repeatMode,
  source,
  resolving,
}) {
  if (resolving) {
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text>⠋ Resolving YouTube stream…</Text>
      </Box>
    );
  }
  if (!song) {
    return (
      <Box borderStyle="round" paddingX={1}>
        <Text dimColor>Stopped — select a song and press Enter</Text>
      </Box>
    );
  }
  const volBar = (w) => {
    const f = Math.round(((muted ? 0 : volume) / 100) * w);
    return '━'.repeat(f) + '─'.repeat(Math.max(0, w - f));
  };
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text>
        {isPlaying ? '▶' : '❚❚'} {song.title} — {song.artist}{' '}
        {source === 'youtube' ? (
          <Text color="red">● YouTube</Text>
        ) : (
          <Text color="green">● Local</Text>
        )}
      </Text>
      <ProgressBar position={position} duration={duration || song.duration || 0} />
      <Text dimColor>
        {muted ? '🔇' : '🔊'} {volBar(12)} {muted ? 'muted' : `${volume}%`} ·{' '}
        {shuffle ? '🔀 Shuffle ON' : '🔀 Shuffle off'} · 🔁 Repeat {repeatLabel(repeatMode)}
      </Text>
      <Text dimColor>◀◀ prev (p) · Space play/pause · next (n) ▶▶ · ←/→ seek 5s</Text>
    </Box>
  );
}

function repeatLabel(mode) {
  if (mode === 'all') return 'ALL';
  if (mode === 'one') return 'ONE';
  return 'OFF';
}
