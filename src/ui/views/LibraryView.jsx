import { Box, Text } from 'ink';
import { useState } from 'react';
import { COLORS } from '../theme.js';

// Library tabs: Songs | Albums | Artists | Playlists. Tabs re-slice the SAME
// song objects (no new fetching): albums/artists group by tag, playlists =
// Liked + Recent pseudo-playlists from the existing DB.
export const LIBRARY_TABS = ['Songs', 'Albums', 'Artists', 'Playlists'];

export function LibraryTabs({ active, onCycle }) {
  void onCycle;
  return (
    <Box>
      <Text color={COLORS.MUTED}>Library </Text>
      {LIBRARY_TABS.map((t) => {
        const on = t === active;
        return (
          <Text key={t} color={on ? COLORS.PINK_SOFT : COLORS.MUTED} bold={on}>
            {' '}[{on ? `● ${t}` : ` ${t} `}]{' '}
          </Text>
        );
      })}
    </Box>
  );
}

export function groupAlbums(songs) {
  const m = new Map();
  for (const s of songs) {
    const k = s.album || 'Singles';
    if (!m.has(k)) m.set(k, { name: k, artist: s.artist, songs: [] });
    m.get(k).songs.push(s);
  }
  return [...m.values()].slice(0, 30);
}

export function groupArtists(songs) {
  const m = new Map();
  for (const s of songs) {
    const k = s.artist || 'Unknown Artist';
    if (!m.has(k)) m.set(k, { name: k, songs: [] });
    m.get(k).songs.push(s);
  }
  return [...m.values()].slice(0, 30);
}

export function useLibraryTab() {
  const [tab, setTab] = useState('Songs');
  const cycle = () => setTab((t) => LIBRARY_TABS[(LIBRARY_TABS.indexOf(t) + 1) % LIBRARY_TABS.length]);
  return { tab, setTab, cycle };
}
