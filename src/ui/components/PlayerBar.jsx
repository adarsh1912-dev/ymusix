import { Box, Text, useStdout } from 'ink';
import { formatTime } from '../../utils/formatTime.js';
import { COLORS, layoutMode, truncate } from '../theme.js';
import { Artwork } from '../artwork.js';

// Persistent bottom player. Same props as the legacy NowPlaying so App.jsx
// needs no logic changes — purely presentational.
// Shows: artwork | title/artist | progress | controls | volume.
export function PlayerBar({
  song, isPlaying, position, duration, volume, muted, shuffle, repeatMode, source, resolving,
}) {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? 80;
  const mode = layoutMode(columns);

  if (resolving) {
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1}>
        <Text color={COLORS.PINK_SOFT}>⠋ Resolving YouTube stream…</Text>
      </Box>
    );
  }
  if (!song) {
    return (
      <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1}>
        <Text color={COLORS.MUTED}>Stopped — select a song and press Enter</Text>
      </Box>
    );
  }

  const dur = duration || song.duration || 0;
  const frac = dur > 0 ? Math.min(1, Math.max(0, position / dur)) : 0;
  const barW = Math.max(10, Math.min(48, columns - (mode === 'small' ? 40 : 64)));
  const filled = Math.round(frac * barW);
  const bar = '━'.repeat(filled) + '○' + '─'.repeat(Math.max(0, barW - filled - 1));
  const volW = 8;
  const vf = Math.round(((muted ? 0 : volume) / 100) * volW);
  const volBar = '━'.repeat(vf) + '─'.repeat(Math.max(0, volW - vf));
  const titleW = mode === 'small' ? 22 : 34;

  return (
    <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1} flexDirection="column">
      <Box>
        {mode !== 'small' && (
          <Artwork songPath={song.path} size="sm" source={source} />
        )}
        <Box flexDirection="column" paddingLeft={mode === 'small' ? 0 : 1} flexGrow={1}>
          <Text>
            <Text color={isPlaying ? COLORS.PINK : COLORS.TEXT2}>{isPlaying ? '▶ ' : '❚❚ '}</Text>
            <Text bold color={COLORS.TEXT}>{truncate(song.title, titleW)}</Text>
            <Text color={COLORS.MUTED}> — {truncate(song.artist, 20)} </Text>
            {source === 'youtube' ? <Text color={COLORS.RED}>● YouTube</Text> : <Text color={COLORS.GREEN}>● Local</Text>}
          </Text>
          <Text>
            <Text color={COLORS.MUTED}>{formatTime(position)} </Text>
            <Text color={COLORS.PINK}>{bar}</Text>
            <Text color={COLORS.MUTED}> {formatTime(dur)}</Text>
          </Text>
          {mode !== 'small' && (
            <Text color={COLORS.MUTED}>
              {muted ? '🔇' : '🔊'} {volBar} {muted ? 'muted' : `${volume}%`} · {shuffle ? '🔀 Shuffle ON' : '🔀 off'} · 🔁 {repeatMode === 'all' ? 'ALL' : repeatMode === 'one' ? 'ONE' : 'OFF'}
              {' · ◀ p · Space · n ▶ · ←/→ 5s'}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
