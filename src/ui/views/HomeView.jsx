import { memo } from 'react';
import { Box, Text } from 'ink';
import { COLORS } from '../theme.js';
import { SectionTitle, useLayout, rowWidths, TrackRow } from '../components/TrackRow.jsx';

// Cinematic home dashboard: Continue Listening hero + Recently Played +
// Made For You (genre-derived pseudo-playlists). Pure presentation over the
// existing songs/recent/favorites data — no new data models.
function heroTrack(songs, recentList, currentSong) {
  return currentSong ?? recentList[0] ?? songs[0] ?? null;
}

export const HomeView = memo(function HomeView({ songs, recentList, favList, selected, favorites, onHint, maxRows = 24 }) {
  const { columns, mode } = useLayout();
  const hero = heroTrack(songs, recentList, null);
  // Tight terminals: fewer recents, no cards, no hero hint line, so the
  // frame fits and Ink updates in place instead of appending duplicates.
  // Budgets (frame ≈ chrome 17 + view): roomy ≥36 full, 27–35 compact,
  // <27 tight (TopBar greeting hidden too).
  const roomy = maxRows >= 36;
  const recent = recentList.slice(0, mode === 'small' || !roomy ? 3 : 5);
  const { numW, titleW, artistW } = rowWidths(columns, Math.max(1, recent.length));

  // "Made For You" derives from genres already in the DB — no new backend.
  const genres = [...new Set(songs.map((s) => s.genre).filter(Boolean))].slice(0, 3);
  const cards = genres.length > 0 ? genres : ['Late Night', 'Coding Vibes', 'Chill Mix'];

  return (
    <Box flexDirection="column">
      {hero && (
        <Box borderStyle="round" borderColor={COLORS.BORDER} paddingX={1} flexDirection="column">
          <Text color={COLORS.MUTED}>CONTINUE LISTENING</Text>
          <Text>
            <Text color={COLORS.PINK}>▶ </Text>
            <Text bold color={COLORS.TEXT}>{hero.title}</Text>
            <Text color={COLORS.TEXT2}> — {hero.artist}</Text>
          </Text>
          <Text color={COLORS.MUTED}>{roomy ? 'Enter plays · h home · / search · v now playing' : 'Enter plays'}</Text>
        </Box>
      )}

      <SectionTitle>Recently Played</SectionTitle>
      {recent.length === 0 ? (
        <Text color={COLORS.MUTED}>Nothing yet — play anything and it lands here.</Text>
      ) : (
        <Box flexDirection="column">
          {recent.map((t, i) => (
            <TrackRow
              key={t.source === 'youtube' ? `yt:${t.id}` : t.path}
              index={i} numWidth={numW} title={t.title} artist={t.artist ?? t.channel}
              duration={t.duration} active={i === selected} fav={favorites?.has(t.source === 'youtube' ? `yt:${t.id}` : t.path)}
              source={t.source} titleW={titleW} artistW={artistW}
            />
          ))}
        </Box>
      )}

      {roomy && (
        <>
          <SectionTitle>Made For You</SectionTitle>
          <Box>
            {cards.map((g, i) => (
              <Box key={String(g)} borderStyle="round" borderColor={i === 0 ? COLORS.PINK : COLORS.BORDER} paddingX={1} marginRight={1} flexDirection="column">
                <Text color={COLORS.PINK_SOFT}>◉</Text>
                <Text bold color={COLORS.TEXT}>{String(g).slice(0, 16)}</Text>
                <Text color={COLORS.MUTED}>{i === 0 ? `${songs.length} songs` : `${favList.length} liked`}</Text>
              </Box>
            ))}
          </Box>
        </>
      )}
      {mode === 'small' ? null : <Text color={COLORS.MUTED}>{onHint ?? ''}</Text>}
    </Box>
  );
});
