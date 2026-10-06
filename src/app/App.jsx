import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { existsSync } from 'node:fs';
import { Header } from '../components/Header.jsx';
import { Footer } from '../components/Footer.jsx';
import { SongList } from '../components/SongList.jsx';
import { NowPlaying } from '../components/NowPlaying.jsx';
import { SearchBar } from '../components/SearchBar.jsx';
import { YouTubeResults } from '../components/YouTubeResults.jsx';
import { DownloadProgress } from '../components/DownloadProgress.jsx';
import { QueueView } from '../components/Queue.jsx';
import { scanLibraryCached } from '../library/library.js';
import { musicDir } from '../utils/paths.js';
import { Player } from '../player/Player.js';
import { filterSongs, buildShuffleOrder, indexOfPath, trackKey } from '../queue/queue.js';
import { searchYouTube } from '../online/YouTubeSearch.js';
import { YouTubeDownloader } from '../downloader/YouTubeDownloader.js';
import {
  closeDatabase,
  entryKey,
  getFavoriteEntries,
  getRecentEntries,
  getSetting,
  openDatabase,
  pushRecentEntry,
  setSetting,
  toggleFavoriteEntry,
} from '../database/database.js';

export function App() {
  const { exit } = useApp();
  const [phase, setPhase] = useState('loading');
  const [songs, setSongs] = useState([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentYt, setCurrentYt] = useState(null); // YouTube track object or null
  const [resolving, setResolving] = useState(false);
  const [notice, setNotice] = useState(''); // transient, auto-clears
  const noticeTimerRef = useRef(null);

  const flashNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(''), 3000);
    noticeTimerRef.current.unref?.();
  }, []);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [shuffleOrder, setShuffleOrder] = useState([]);
  const [repeatMode, setRepeatMode] = useState('off');
  const [view, setView] = useState('library'); // library | queue | favorites | recent
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSource, setSearchSource] = useState('local'); // local | youtube
  const [ytResults, setYtResults] = useState([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [ytSelected, setYtSelected] = useState(0);
  const [download, setDownload] = useState(null); // {id,title,status,pct,...}
  const [queueTracks, setQueueTracks] = useState([]); // track objects, local or youtube
  const [favEntries, setFavEntries] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);

  const playerRef = useRef(null);
  const downloaderRef = useRef(null);
  const dbRef = useRef(null);
  const ytRequestRef = useRef(0);
  const songsRef = useRef([]);
  songsRef.current = songs;
  const currentRef = useRef(-1);
  currentRef.current = currentIndex;
  const currentYtRef = useRef(null);
  currentYtRef.current = currentYt;
  const positionRef = useRef(0);
  positionRef.current = position;
  const queueRef = useRef([]);
  queueRef.current = queueTracks;
  const volumeRef = useRef(80);
  volumeRef.current = volume;
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const repeatRef = useRef('off');
  repeatRef.current = repeatMode;
  const orderRef = useRef([]);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;

  const order = useMemo(() => {
    if (shuffle && shuffleOrder.length === songs.length && songs.length > 0) {
      return shuffleOrder;
    }
    return songs.map((_, i) => i);
  }, [shuffle, shuffleOrder, songs]);
  orderRef.current = order;

  const visible = useMemo(
    () => (searchActive || searchQuery ? filterSongs(songs, searchQuery) : songs),
    [songs, searchQuery, searchActive],
  );

  const favKeys = useMemo(() => new Set(favEntries.map(entryKey)), [favEntries]);

  // Favorites view: local songs (library order preserved via added_at desc)
  // interleaved with YouTube tracks, newest first.
  const favList = useMemo(() => {
    const byPath = new Map(songs.map((s) => [s.path, s]));
    const out = [];
    for (const e of favEntries) {
      if (e.source === 'youtube') {
        out.push({
          source: 'youtube',
          id: e.videoId,
          title: e.title || e.videoId,
          artist: e.artist || 'Unknown channel',
          channel: e.artist || 'Unknown channel',
          duration: e.duration || 0,
          url: e.url,
          thumbnail: e.thumbnail,
        });
      } else {
        const s = byPath.get(e.path);
        if (s) out.push(s);
      }
    }
    return out;
  }, [favEntries, songs]);

  const recentList = useMemo(() => {
    const byPath = new Map(songs.map((s) => [s.path, s]));
    const out = [];
    for (const e of recentEntries) {
      if (e.source === 'youtube') {
        out.push({
          source: 'youtube',
          id: e.videoId,
          title: e.title || e.videoId,
          artist: e.artist || 'Unknown channel',
          channel: e.artist || 'Unknown channel',
          duration: e.duration || 0,
          url: e.url,
          thumbnail: e.thumbnail,
        });
      } else {
        const s = byPath.get(e.path);
        if (s) out.push(s);
      }
    }
    return out;
  }, [recentEntries, songs]);

  // The list that selection/Enter/f operate on in the current view.
  const activeList = view === 'favorites' ? favList : view === 'recent' ? recentList : visible;

  const explicitTracks = useMemo(
    () =>
      queueTracks.filter((t) =>
        t.source === 'youtube' ? true : indexOfPath(songs, t.path) >= 0,
      ),
    [queueTracks, songs],
  );

  const upNext = useMemo(() => {
    const pos = order.indexOf(currentIndex);
    if (pos < 0) return [];
    return order
      .slice(pos + 1, pos + 11)
      .map((i) => songs[i])
      .filter(Boolean);
  }, [order, currentIndex, songs]);

  const getPlayer = () => {
    if (!playerRef.current) {
      const p = new Player({ volume: volumeRef.current, muted: mutedRef.current });
      p.on('fatal', () => setIsPlaying(false));
      p.on('pause-change', (paused) => setIsPlaying(!paused));
      p.on('volume', (v) => setVolume(v));
      p.on('mute', (m) => setMuted(m));
      // mpv reports WHY a file ended. Only natural ends ('eof') and real
      // failures ('error') should advance. Our own loadfile/stop commands
      // report 'stop' — advancing on those hijacks manual track switches
      // (pick a song → it immediately skips to the next one).
      p.on('ended', (reason) => {
        if (reason === 'stop' || reason === 'quit' || reason === 'redirect') return;
        if (reason === 'error') {
          const cur = currentYtRef.current ?? songsRef.current[currentRef.current];
          flashNotice(`Couldn't play ${cur?.title ?? 'that track'}, skipping…`);
        }
        void advanceAuto(reason);
      });
      playerRef.current = p;
    }
    return playerRef.current;
  };

  const playIndex = useCallback(async (i) => {
    const list = songsRef.current;
    if (!Number.isInteger(i) || i < 0 || i >= list.length) return false;
    setPlayerError('');
    try {
      await getPlayer().play(list[i].path);
      setCurrentYt(null);
      setCurrentIndex(i);
      setSelected(i);
      setIsPlaying(true);
      setPosition(0);
      if (dbRef.current) {
        try {
          const s = list[i];
          pushRecentEntry(dbRef.current, {
            source: 'local',
            path: s.path,
            title: s.title,
            artist: s.artist,
            duration: s.duration,
          });
          setRecentEntries(getRecentEntries(dbRef.current));
        } catch {
          // recent tracking must not break playback
        }
      }
      return true;
    } catch (err) {
      setPlayerError(err.hint ?? err?.message ?? String(err));
      setIsPlaying(false);
      return false;
    }
  }, []);

  // Stream a YouTube track. Local state stays index-based; the YouTube
  // track rides alongside until a local song (or queued track) takes over.
  // Unavailable videos surface as an inline error, never a crash.
  const playYtTrack = useCallback(async (track) => {
    if (!track) return false;
    setPlayerError('');
    setResolving(true);
    try {
      await getPlayer().play(track);
      setCurrentYt(track);
      setCurrentIndex(-1);
      setIsPlaying(true);
      setPosition(0);
      if (dbRef.current) {
        try {
          pushRecentEntry(dbRef.current, {
            source: 'youtube',
            videoId: track.id,
            title: track.title,
            artist: track.channel,
            url: track.url,
            thumbnail: track.thumbnail,
            duration: track.duration,
          });
          setRecentEntries(getRecentEntries(dbRef.current));
        } catch {
          // recent tracking must not break playback
        }
      }
      return true;
    } catch (err) {
      setPlayerError(err.hint ?? err.message ?? String(err));
      setIsPlaying(false);
      return false;
    } finally {
      setResolving(false);
    }
  }, []);

  // Play any track object (local song or YouTube result).
  const playTrack = useCallback(
    async (track) => {
      if (!track) return false;
      if (track.source === 'youtube') return playYtTrack(track);
      return playIndex(indexOfPath(songsRef.current, track.path));
    },
    [playIndex, playYtTrack],
  );

  // Add a track to the explicit queue (no duplicates).
  const enqueueTrack = useCallback((track) => {
    if (!track) return;
    const key = trackKey(track);
    setQueueTracks((q) => (q.some((t) => trackKey(t) === key) ? q : [...q, track]));
  }, []);

  // Rescan ~/Music (metadata cache makes this cheap) and keep selection valid.
  const rescanLibrary = useCallback(async () => {
    try {
      const { songs: found } = await scanLibraryCached(musicDir(), dbRef.current);
      setSongs(found);
      setSelected((s) => Math.min(s, Math.max(0, found.length - 1)));
    } catch {
      // keep the old list on failure
    }
  }, []);

  const getDownloader = () => {
    if (!downloaderRef.current) {
      const dl = new YouTubeDownloader();
      dl.on('progress', (p) =>
        setDownload((d) => (d && d.id === p.id ? { ...d, ...p, status: 'active' } : d)),
      );
      dl.on('done', (info) => {
        setDownload({ id: info.id, title: info.title, status: 'done' });
        void rescanLibrary();
      });
      dl.on('error', (e) =>
        setDownload({ id: e.id, title: e.title, status: 'error', message: e.message }),
      );
      dl.on('cancelled', (info) =>
        setDownload({ id: info.id, title: info.title, status: 'cancelled' }),
      );
      downloaderRef.current = dl;
    }
    return downloaderRef.current;
  };

  const startDownload = useCallback(
    async (track) => {
      if (!track || track.source !== 'youtube') return;
      const dl = getDownloader();
      if (dl.isBusy()) {
        setPlayerError('A download is already in progress.');
        return;
      }
      setPlayerError('');
      setDownload({ id: track.id, title: track.title, status: 'active', pct: 0 });
      try {
        await dl.download(track);
      } catch (err) {
        if (err.code === 'missing' || err.code === 'ffmpeg-missing') {
          setPlayerError(err.hint ?? err.message);
          setDownload(null);
        }
        // progress/done/error/cancelled states arrive via events
      }
    },
    [rescanLibrary],
  );

  // Automatic advance on natural end ('eof') or failure ('error').
  // Repeat ONE replays on 'eof' only — replaying on 'error' would loop a
  // broken file forever.
  const advanceAuto = useCallback(async (reason = 'eof') => {
    const list = songsRef.current;
    if (list.length === 0 && queueRef.current.length === 0) return;
    if (
      repeatRef.current === 'one' &&
      reason !== 'error' &&
      (currentRef.current >= 0 || currentYtRef.current)
    ) {
      if (currentYtRef.current) {
        await playYtTrack(currentYtRef.current);
      } else {
        await playIndex(currentRef.current);
      }
      return;
    }
    const q = [...queueRef.current];
    while (q.length > 0) {
      const next = q.shift();
      setQueueTracks(q);
      if (next.source === 'youtube') {
        await playYtTrack(next);
        return;
      }
      const idx = indexOfPath(list, next.path);
      if (idx >= 0) {
        await playIndex(idx);
        return;
      }
    }
    const ord = orderRef.current;
    const pos = ord.indexOf(currentRef.current);
    if (pos < 0) {
      await playIndex(ord[0] ?? 0);
      return;
    }
    if (pos + 1 < ord.length) {
      await playIndex(ord[pos + 1]);
    } else if (repeatRef.current === 'all' || shuffleRef.current) {
      // Shuffle exhausts its order then reshuffles for a fresh cycle.
      if (shuffleRef.current) {
        const fresh = buildShuffleOrder(list.length, ord[pos]);
        setShuffleOrder(fresh);
        await playIndex(fresh[1 % fresh.length] ?? fresh[0]);
      } else {
        await playIndex(ord[0]);
      }
    } else {
      setIsPlaying(false);
    }
  }, [playIndex, playYtTrack]);

  const playNextManual = useCallback(async () => {
    const list = songsRef.current;
    if (list.length === 0 && queueRef.current.length === 0) return;
    const q = [...queueRef.current];
    while (q.length > 0) {
      const next = q.shift();
      setQueueTracks(q);
      if (next.source === 'youtube') {
        await playYtTrack(next);
        return;
      }
      const idx = indexOfPath(list, next.path);
      if (idx >= 0) {
        await playIndex(idx);
        return;
      }
    }
    const ord = orderRef.current;
    const pos = ord.indexOf(currentRef.current);
    if (pos < 0) {
      await playIndex(ord[0] ?? 0);
      return;
    }
    await playIndex(ord[(pos + 1) % ord.length]);
  }, [playIndex, playYtTrack]);

  const playPrevManual = useCallback(async () => {
    const list = songsRef.current;
    if (list.length === 0) return;
    if (positionRef.current > 3) {
      try {
        await getPlayer().seekTo(0);
      } catch {
        // ignore
      }
      return;
    }
    const ord = orderRef.current;
    const pos = ord.indexOf(currentRef.current);
    if (pos < 0) {
      await playIndex(ord[0] ?? 0);
      return;
    }
    const prev = pos - 1;
    await playIndex(prev < 0 ? (repeatRef.current === 'all' ? ord[ord.length - 1] : ord[0]) : ord[prev]);
  }, [playIndex]);

  const toggle = useCallback(async () => {
    try {
      if (currentRef.current < 0 && !currentYtRef.current) {
        const list = songsRef.current;
        if (list.length > 0) await playIndex(0);
        return;
      }
      const paused = await getPlayer().toggle();
      setIsPlaying(!paused);
    } catch (err) {
      setPlayerError(err.hint ?? err?.message ?? String(err));
    }
  }, [playIndex]);

  const toggleShuffle = useCallback(() => {
    const list = songsRef.current;
    setShuffle((s) => {
      if (!s && list.length > 0) {
        setShuffleOrder(buildShuffleOrder(list.length, currentRef.current));
      }
      return !s;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  // Progress polling: ~2 updates/sec.
  useEffect(() => {
    if (currentIndex < 0 && !currentYt) {
      setPosition(0);
      setDuration(0);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const player = playerRef.current;
        if (!player) return;
        const [t, d] = await Promise.all([player.getTime(), player.getDuration()]);
        if (alive) {
          setPosition(t);
          setDuration(d);
        }
      } catch {
        // transient IPC failure; next tick retries
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [currentIndex, currentYt]);

  // Graceful shutdown: stop downloads, stop mpv, remove socket, exit.
  // Idempotent; safe from exit/signal handlers.
  useEffect(() => {
    let quitting = false;
    const shutdown = async () => {
      if (quitting) return;
      quitting = true;
      try {
        await downloaderRef.current?.quit();
      } catch {
        // ignore
      }
      try {
        await playerRef.current?.quit();
      } catch {
        // ignore
      }
      exit();
      setTimeout(() => process.exit(0), 50).unref?.();
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
    // Pty hangup (e.g. terminal closed, timeout kills): without this the
    // Node process dies instantly and mpv is orphaned with a stale socket.
    process.once('SIGHUP', () => void shutdown());
    return () => {
      void downloaderRef.current?.quit();
      void playerRef.current?.quit();
    };
  }, [exit]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Local persistence is best-effort: the player works without it.
        try {
          const database = openDatabase();
          dbRef.current = database;
          const vol = parseInt(getSetting(database, 'volume', '80'), 10);
          if (Number.isFinite(vol)) {
            volumeRef.current = Math.max(0, Math.min(100, vol));
            setVolume(volumeRef.current);
          }
          if (getSetting(database, 'shuffle', 'off') === 'on') setShuffle(true);
          const repeat = getSetting(database, 'repeat', 'off');
          if (['off', 'all', 'one'].includes(repeat)) setRepeatMode(repeat);
          setFavEntries(getFavoriteEntries(database));
          setRecentEntries(getRecentEntries(database));
        } catch {
          dbRef.current = null;
        }

        if (!existsSync(musicDir())) {
          if (!cancelled) setPhase('missing');
          return;
        }
        const { songs: found } = await scanLibraryCached(musicDir(), dbRef.current);
        if (cancelled) return;
        setSongs(found);
        // Preselect (not autoplay) the last played song.
        let startAt = 0;
        try {
          if (dbRef.current) {
            const last = getSetting(dbRef.current, 'last_song', '');
            const idx = found.findIndex((s) => s.path === last);
            if (idx >= 0) startAt = idx;
          }
        } catch {
          // ignore
        }
        setSelected(startAt);
        setPhase('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err?.message ?? String(err));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      closeDatabase();
      dbRef.current = null;
    };
  }, []);

  // Persist playback preferences (best-effort).
  useEffect(() => {
    try {
      if (dbRef.current) setSetting(dbRef.current, 'volume', String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  useEffect(() => {
    try {
      if (dbRef.current) setSetting(dbRef.current, 'shuffle', shuffle ? 'on' : 'off');
    } catch {
      // ignore
    }
  }, [shuffle]);

  useEffect(() => {
    try {
      if (dbRef.current) setSetting(dbRef.current, 'repeat', repeatMode);
    } catch {
      // ignore
    }
  }, [repeatMode]);

  useEffect(() => {
    try {
      if (dbRef.current && currentIndex >= 0 && songs[currentIndex]) {
        setSetting(dbRef.current, 'last_song', songs[currentIndex].path);
      }
    } catch {
      // ignore
    }
  }, [currentIndex, songs]);

  const switchView = (v) => {
    setView(v);
    setSelected(0);
  };

  const toggleFavorite = useCallback(() => {
    const list = view === 'favorites' ? favList : view === 'recent' ? recentList : visible;
    if (list.length === 0) return;
    const item = list[Math.min(selected, list.length - 1)];
    if (!item || !dbRef.current) return;
    try {
      const entry =
        item.source === 'youtube'
          ? {
              source: 'youtube',
              videoId: item.id,
              title: item.title,
              artist: item.channel,
              url: item.url,
              thumbnail: item.thumbnail,
              duration: item.duration,
            }
          : { source: 'local', path: item.path };
      toggleFavoriteEntry(dbRef.current, entry);
      setFavEntries(getFavoriteEntries(dbRef.current));
    } catch {
      // ignore
    }
  }, [view, favList, recentList, visible, selected]);

  // Favorite a YouTube search result directly (f in results list mode).
  const favoriteYtResult = useCallback(
    (track) => {
      if (!track || !dbRef.current) return;
      try {
        toggleFavoriteEntry(dbRef.current, {
          source: 'youtube',
          videoId: track.id,
          title: track.title,
          artist: track.channel,
          url: track.url,
          thumbnail: track.thumbnail,
          duration: track.duration,
        });
        setFavEntries(getFavoriteEntries(dbRef.current));
      } catch {
        // ignore
      }
    },
    [],
  );

  // YouTube search submit (Enter while source=youtube). Stale responses are
  // discarded via request id so fast re-searches can't show old results.
  const submitYtSearch = useCallback(async (query) => {
    const q = query.trim();
    if (!q) return;
    const req = ++ytRequestRef.current;
    setYtLoading(true);
    setYtError('');
    setYtResults([]);
    setYtSelected(0);
    try {
      const { results } = await searchYouTube(q, { limit: 10 });
      if (ytRequestRef.current !== req) return;
      setYtResults(results);
      setYtSelected(0);
      if (results.length === 0) setYtError('No results.');
    } catch (err) {
      if (ytRequestRef.current !== req) return;
      if (err.code === 'missing') {
        setYtError(err.hint ?? 'yt-dlp is not installed.');
      } else {
        setYtError(err.message);
      }
    } finally {
      if (ytRequestRef.current === req) setYtLoading(false);
    }
  }, []);

  // Ink may deliver several typed characters in one `input` string when they
  // arrive together (paste/fast typing), so single-char commands are processed
  // per character. Special keys (arrows/return/escape) are handled once.
  const isPrintable = (ch) => ch >= ' ' && ch !== '\x7f';

  useInput((input, key) => {
    const chars = [...(input ?? '')].filter(isPrintable);

    if (chars.includes('q') || (key.ctrl && (input ?? '').includes('c'))) {
      void (async () => {
        try {
          await downloaderRef.current?.quit();
        } catch {
          // ignore
        }
        try {
          await playerRef.current?.quit();
        } catch {
          // ignore
        }
        exit();
        setTimeout(() => process.exit(0), 50).unref?.();
      })();
      return;
    }

    // Search overlay captures most keys.
    if (searchActive) {
      if (key.escape) {
        setSearchActive(false);
        setSearchQuery('');
        setSelected(0);
        setYtResults([]);
        setYtError('');
        setYtSelected(0);
        return;
      }
      if (key.tab || (input ?? '').includes('\t')) {
        setSearchSource((s) => (s === 'local' ? 'youtube' : 'local'));
        setSelected(0);
        setYtSelected(0);
        setYtError('');
        // A burst like "<tab>starboy" should keep the text after Tab.
        const after = [...(input ?? '')].filter((c) => c !== '\t' && isPrintable(c)).join('');
        if (after) setSearchQuery((q) => q + after);
        return;
      }
      if (searchSource === 'youtube') {
        const inList = ytResults.length > 0;
        const single = chars.length === 1 ? chars[0] : '';
        if (key.leftArrow) {
          void getPlayer()
            .seekBy(-5)
            .catch((err) => flashNotice(err.message ?? 'Seek failed.'));
        } else if (key.rightArrow) {
          void getPlayer()
            .seekBy(5)
            .catch((err) => flashNotice(err.message ?? 'Seek failed.'));
        } else if (key.return) {
          if (!inList && !ytLoading) {
            void submitYtSearch(searchQuery);
          } else if (inList) {
            const track = ytResults[Math.min(ytSelected, ytResults.length - 1)];
            void playYtTrack(track);
          }
        } else if (key.upArrow || (inList && single === 'k')) {
          setYtSelected((s) => (s - 1 + Math.max(1, ytResults.length)) % Math.max(1, ytResults.length));
        } else if (key.downArrow || (inList && single === 'j')) {
          setYtSelected((s) => (s + 1) % Math.max(1, ytResults.length));
        } else if (inList && single === 'a') {
          enqueueTrack(ytResults[Math.min(ytSelected, ytResults.length - 1)]);
        } else if (inList && single === 'f') {
          favoriteYtResult(ytResults[Math.min(ytSelected, ytResults.length - 1)]);
        } else if (inList && single === 'x') {
          downloaderRef.current?.cancel();
        } else if (inList && single === 'd') {
          startDownload(ytResults[Math.min(ytSelected, ytResults.length - 1)]);
        } else if (key.backspace || key.delete) {
          // Refining: drop stale results and edit the query.
          setYtResults([]);
          setYtError('');
          setYtSelected(0);
          setSearchQuery((q) => q.slice(0, -1));
        } else if (!key.ctrl && !key.meta && chars.length > 0) {
          const text = chars.join('');
          if (inList) {
            // First refinement keystroke replaces stale results.
            setYtResults([]);
            setYtError('');
            setYtSelected(0);
          }
          setSearchQuery((q) => q + text);
        }
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setSelected(0);
      } else if (key.return) {
        if (visible.length > 0) {
          void playIndex(indexOfPath(songs, visible[Math.min(selected, visible.length - 1)].path));
          setSearchActive(false);
          setSearchQuery('');
          setSelected(0);
          setView('library');
        }
      } else if (key.upArrow) {
        setSelected((s) => (s - 1 + Math.max(1, visible.length)) % Math.max(1, visible.length));
      } else if (key.downArrow) {
        setSelected((s) => (s + 1) % Math.max(1, visible.length));
      } else if (!key.ctrl && !key.meta && chars.length > 0) {
        const text = chars.join('');
        setSearchQuery((q) => q + text);
        setSelected(0);
      }
      return;
    }

    if (key.escape && view !== 'library') {
      switchView('library');
      return;
    }
    if (key.return) {
      if (phase !== 'ready') return;
      if (view === 'queue') {
        void playQueueRow(selected);
      } else if (activeList.length > 0) {
        const item = activeList[Math.min(selected, activeList.length - 1)];
        if (item.source === 'youtube') {
          void playYtTrack(item);
        } else {
          void playIndex(indexOfPath(songs, item.path));
        }
      }
      return;
    }
    if (key.leftArrow) {
      if (currentIndex < 0 && !currentYt) return;
      void getPlayer()
        .seekBy(-5)
        .catch((err) => flashNotice(err.message ?? 'Seek failed.'));
      return;
    }
    if (key.rightArrow) {
      if (currentIndex < 0 && !currentYt) return;
      void getPlayer()
        .seekBy(5)
        .catch((err) => flashNotice(err.message ?? 'Seek failed.'));
      return;
    }
    if (key.upArrow) {
      if (phase === 'ready') setSelected((s) => clampSel(s - 1));
      return;
    }
    if (key.downArrow) {
      if (phase === 'ready') setSelected((s) => clampSel(s + 1));
      return;
    }

    // A burst like "/star" opens search and feeds the rest as the query.
    // A burst like "/<tab>star" additionally switches to YouTube search
    // (the raw input is checked because \t is filtered out of `chars`).
    // A trailing CR in the same burst (pasted "query<enter>") submits a
    // YouTube search immediately.
    const slashAt = chars.indexOf('/');
    if (slashAt >= 0) {
      if (view !== 'library') switchView('library');
      setSearchActive(true);
      setSelected(0);
      const toYt = (input ?? '').includes('\t') || searchSource === 'youtube';
      if ((input ?? '').includes('\t')) {
        setSearchSource('youtube');
        setYtSelected(0);
        setYtError('');
      }
      const rest = chars.slice(slashAt + 1).join('');
      setSearchQuery(rest);
      if (toYt && rest && (input ?? '').endsWith('\r')) {
        void submitYtSearch(rest);
      }
      return;
    }

    if (phase !== 'ready') return;
    void (async () => {
      // Sequential so burst keypresses (e.g. "nn") apply in order.
      for (const ch of chars) {
        if (ch === 'l') {
          switchView('library');
        } else if (ch === 'c') {
          // c opens the queue; pressing it again cycles queue → favorites → recent.
          setView((v) =>
            v === 'queue' ? 'favorites' : v === 'favorites' ? 'recent' : 'queue',
          );
          setSelected(0);
        } else if (ch === 'k') {
          setSelected((s) => clampSel(s - 1));
        } else if (ch === 'j') {
          setSelected((s) => clampSel(s + 1));
        } else if (ch === ' ') {
          await toggle();
        } else if (ch === 'n') {
          await playNextManual();
        } else if (ch === 'p') {
          await playPrevManual();
        } else if (ch === 's') {
          toggleShuffle();
        } else if (ch === 'r') {
          cycleRepeat();
        } else if (ch === 'a') {
          if (view !== 'queue' && activeList.length > 0) {
            const song = activeList[Math.min(selected, activeList.length - 1)];
            enqueueTrack(song);
          }
        } else if (ch === 'd') {
          if (view === 'queue' && explicitTracks.length > 0) {
            // selected 0 is "currently playing"; explicit rows follow.
            const explicitIdx = selected - 1;
            if (explicitIdx >= 0 && explicitIdx < explicitTracks.length) {
              const target = trackKey(explicitTracks[explicitIdx]);
              setQueueTracks((q) => q.filter((t) => trackKey(t) !== target));
              setSelected(0);
            }
          }
        } else if (ch === '+' || ch === '=') {
          const v = Math.max(0, Math.min(100, volumeRef.current + 5));
          volumeRef.current = v;
          setVolume(v);
          try {
            await getPlayer().setVolume(v);
          } catch {
            // mpv not started yet; value applies on first play
          }
        } else if (ch === '-' || ch === '_') {
          const v = Math.max(0, Math.min(100, volumeRef.current - 5));
          volumeRef.current = v;
          setVolume(v);
          try {
            await getPlayer().setVolume(v);
          } catch {
            // mpv not started yet; value applies on first play
          }
        } else if (ch === 'm') {
          const next = !mutedRef.current;
          mutedRef.current = next;
          setMuted(next);
          try {
            await getPlayer().setMuted(next);
          } catch {
            // mpv not started yet; value applies on first play
          }
        } else if (ch === 'f') {
          toggleFavorite();
        } else if (ch === 'x') {
          downloaderRef.current?.cancel();
        }
      }
    })();
  });

  const clampSel = (s) => {
    const listLen =
      view === 'queue' ? queueRowCount() : view === 'favorites' ? favList.length : view === 'recent' ? recentList.length : visible.length;
    return listLen === 0 ? 0 : (s + listLen) % listLen;
  };

  // Persist playback preferences (best-effort).
  useEffect(() => {
    try {
      dbRef.current && setSetting(dbRef.current, 'volume', String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  useEffect(() => {
    try {
      dbRef.current && setSetting(dbRef.current, 'shuffle', shuffle ? 'on' : 'off');
    } catch {
      // ignore
    }
  }, [shuffle]);

  useEffect(() => {
    try {
      dbRef.current && setSetting(dbRef.current, 'repeat', repeatMode);
    } catch {
      // ignore
    }
  }, [repeatMode]);

  useEffect(() => {
    try {
      if (dbRef.current && currentIndex >= 0 && songs[currentIndex]) {
        setSetting(dbRef.current, 'last_song', songs[currentIndex].path);
      }
    } catch {
      // ignore
    }
  }, [currentIndex, songs]);

  const queueRowCount = () => 1 + explicitTracks.length + upNext.length;

  const playQueueRow = async (row) => {
    if (row === 0 && (currentIndex >= 0 || currentYt)) {
      await toggle();
      return;
    }
    const explicitIdx = row - 1;
    if (explicitIdx >= 0 && explicitIdx < explicitTracks.length) {
      const target = explicitTracks[explicitIdx];
      const key = trackKey(target);
      setQueueTracks((q) => q.filter((t) => trackKey(t) !== key));
      await playTrack(target);
      return;
    }
    const upIdx = row - 1 - explicitTracks.length;
    if (upIdx >= 0 && upIdx < upNext.length) {
      await playIndex(indexOfPath(songs, upNext[upIdx].path));
    }
  };

  // Search overlay UI, shared by the library view (including an empty
  // library) and the missing-directory state so search — especially
  // YouTube search — always works.
  const renderSearch = () => (
    <>
      {searchSource === 'local' && (
        <Box flexDirection="column">
          <SearchBar query={searchQuery} count={visible.length} />
          <Text dimColor>Source: ❯ Local   YouTube (Tab to switch)</Text>
          {songs.length === 0 && (
            <Text dimColor>Library is empty — press Tab for YouTube.</Text>
          )}
        </Box>
      )}
      {searchSource === 'youtube' && (
        <Box flexDirection="column">
          <Text>
            Search:{' '}
            <Text bold>{searchQuery}</Text>
            <Text inverse> </Text>
          </Text>
          <Text dimColor>
            Source:   Local   ❯ YouTube (Tab to switch · Enter to search · Esc close)
          </Text>
          {ytLoading && <Text>⠋ Searching YouTube…</Text>}
          {ytError !== '' && <Text color="red">✗ {ytError}</Text>}
          {!ytLoading && ytError === '' && ytResults.length === 0 && (
            <Text dimColor>Type a query and press Enter to search YouTube.</Text>
          )}
          {ytResults.length > 0 && (
            <YouTubeResults
              results={ytResults}
              selected={Math.min(ytSelected, ytResults.length - 1)}
            />
          )}
        </Box>
      )}
    </>
  );

  const currentSong = currentIndex >= 0 ? songs[currentIndex] : null;
  // What Now Playing shows: the YouTube track wins while streaming; local
  // songs render with their artist, YouTube tracks with their channel.
  const displaySong = currentYt
    ? { title: currentYt.title, artist: currentYt.channel, duration: currentYt.duration }
    : currentSong;
  const displaySource = currentYt ? 'youtube' : currentSong ? 'local' : null;

  return (
    <Box flexDirection="column" width="100%" padding={1}>
      <Header />
      <Box paddingY={1} flexDirection="column">
        {phase === 'loading' && <Text>⠋ Scanning music library...</Text>}
        {phase === 'missing' && (
          <Box flexDirection="column">
            <Text>
              No Music directory found at {musicDir()}. Create it and add audio files, then restart.
            </Text>
            {searchActive && renderSearch()}
          </Box>
        )}
        {phase === 'error' && <Text color="red">Failed to scan library: {error}</Text>}
        {phase === 'ready' && view === 'library' && (
          <Box flexDirection="column">
            <Text dimColor>LIBRARY — {songs.length} songs</Text>
            {searchActive && renderSearch()}
            {!searchActive &&
              (songs.length === 0 ? (
                <Text>
                  No supported audio files in {musicDir()}. Supported: .mp3 .flac .wav .ogg
                  .m4a .aac — press / to search YouTube.
                </Text>
              ) : (
                <SongList
                  songs={songs}
                  selected={Math.min(selected, songs.length - 1)}
                  favorites={favKeys}
                />
              ))}
            {searchActive &&
              searchSource === 'local' &&
              songs.length > 0 &&
              (visible.length === 0 ? (
                <Text dimColor>No matches for “{searchQuery}”.</Text>
              ) : (
                <SongList
                  songs={visible}
                  selected={Math.min(selected, visible.length - 1)}
                  favorites={favKeys}
                />
              ))}
          </Box>
        )}
        {phase === 'ready' && view === 'queue' && (
          <Box flexDirection="column">
            <Text dimColor>QUEUE — Enter play · d remove · c more · Esc back</Text>
            <QueueView
              current={displaySong}
              currentSource={displaySource}
              explicit={explicitTracks}
              upNext={upNext}
              selected={Math.min(selected, Math.max(0, queueRowCount() - 1))}
            />
          </Box>
        )}
        {phase === 'ready' && view === 'favorites' && (
          <Box flexDirection="column">
            <Text dimColor>FAVORITES — Enter play · f unfavorite · c more · Esc back</Text>
            {favList.length === 0 ? (
              <Text dimColor>No favorites yet — press f on a song to add it here.</Text>
            ) : (
              <SongList
                songs={favList}
                selected={Math.min(selected, favList.length - 1)}
                favorites={favKeys}
              />
            )}
          </Box>
        )}
        {phase === 'ready' && view === 'recent' && (
          <Box flexDirection="column">
            <Text dimColor>RECENTLY PLAYED — Enter play · c more · Esc back</Text>
            {recentList.length === 0 ? (
              <Text dimColor>Nothing played yet.</Text>
            ) : (
              <SongList
                songs={recentList}
                selected={Math.min(selected, recentList.length - 1)}
                favorites={favKeys}
              />
            )}
          </Box>
        )}
      </Box>
      <DownloadProgress download={download} />
      <NowPlaying
        song={displaySong}
        source={displaySource}
        resolving={resolving}
        isPlaying={isPlaying}
        position={position}
        duration={duration}
        volume={volume}
        muted={muted}
        shuffle={shuffle}
        repeatMode={repeatMode}
      />
      {playerError !== '' && <Text color="red">✗ {playerError}</Text>}
      {playerError === '' && notice !== '' && <Text dimColor>{notice}</Text>}
      <Footer />
    </Box>
  );
}
