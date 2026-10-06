export function filterSongs(songs, query) {
  const q = query.trim().toLowerCase();
  if (!q) return songs;
  return songs.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      (s.album ?? '').toLowerCase().includes(q),
  );
}

// Fisher-Yates permutation of [0..n), rotated so currentIndex is first.
export function buildShuffleOrder(n, currentIndex) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (currentIndex >= 0 && currentIndex < n) {
    const at = order.indexOf(currentIndex);
    if (at > 0) {
      return [...order.slice(at), ...order.slice(0, at)];
    }
  }
  return order;
}

// Stable identity for dedupe/removal: local tracks by path, YouTube by id.
export function trackKey(track) {
  if (!track) return '';
  return track.source === 'youtube' ? `yt:${track.id}` : `local:${track.path}`;
}

// Resolve an explicit-queue path to a song index; -1 if gone.
export function indexOfPath(songs, path) {
  return songs.findIndex((s) => s.path === path);
}
