# 🎵 Ymusix

**A Spotify-inspired terminal music player — local-first, with optional YouTube.**

Browse and play your `~/Music` collection entirely in the terminal, with
search, queue, shuffle, repeat, favorites, and history. Optionally search
YouTube, stream results, and download them straight into your library.
No accounts, no telemetry, no servers — your data never leaves your machine.

![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)
![Platform: Linux](https://img.shields.io/badge/platform-linux-lightgrey)

```text
╭────────────────────────────────────────────────────────╮
│                       🎵 YMUSIX                        │
├────────────────────────────────────────────────────────┤
│  LIBRARY — 6 songs                                     │
│                                                        │
│  ❯ 1  ♥ Blinding Lights   The Weeknd          00:12   │
│    2    Starboy            The Weeknd          00:08   │
├────────────────────────────────────────────────────────┤
│  ▶ Blinding Lights — The Weeknd  ● Local              │
│  ━━━━━━━━━━━━━━●──────────────────  00:04 / 00:12     │
│  🔊 ━━━━━━━━━━━─ 90% · 🔀 Shuffle ON · 🔁 Repeat ALL  │
├────────────────────────────────────────────────────────┤
│  ↑↓ move · Enter play · Space pause · / search · q quit│
╰────────────────────────────────────────────────────────╯
```

## ✨ Features

- **Local library** — recursive `~/Music` scan (`.mp3 .flac .wav .ogg .m4a
  .aac`) with tag reading and filename fallback, plus a metadata cache for
  instant restarts
- **Full playback** — play/pause, next/previous, ±5s seek, volume/mute,
  live progress bar, all through an `mpv --idle` JSON-IPC backend
- **Queue, shuffle, repeat** — explicit queue mixed with true shuffle order
  and OFF → ALL → ONE repeat modes
- **Search** — instant local search (title/artist/album) plus YouTube search
  in the same overlay (`Tab` switches source)
- **YouTube** — stream results in place, queue them, or download as MP3
  (metadata + artwork embedded) into `~/Music` with progress and cancel
- **Favorites & history** — `♥` favorites and recently-played for both local
  songs and YouTube videos, persisted in local SQLite
- **Offline-first** — every local feature works with no network; YouTube is
  a strictly optional extension
- **`ymusix doctor`** — checks Node, mpv, yt-dlp, ffmpeg, `~/Music`,
  database, IPC socket, and connectivity, with install hints

## 📋 Requirements

| Dependency | Required for | Install (Arch / Debian / Fedora) |
|---|---|---|
| Node.js ≥ 22 | Everything | `node --version` to check |
| mpv | Audio playback (hard requirement) | `sudo pacman -S mpv` / `sudo apt install mpv` / `sudo dnf install mpv` |
| yt-dlp | YouTube search/stream/download | `sudo pacman -S yt-dlp` / `sudo apt install yt-dlp` / `sudo dnf install yt-dlp` |
| ffmpeg | YouTube downloads | `sudo pacman -S ffmpeg` / `sudo apt install ffmpeg` / `sudo dnf install ffmpeg` |

> Only download content you are authorized to download/use.

## 🚀 Install

```bash
npm install -g ymusix
```

Or from source:

```bash
git clone <repo-url> && cd ymusix
npm install
npm run build
npm install -g ./
```

Then verify your setup:

```bash
ymusix doctor
```

## 🎧 Usage

```bash
ymusix                  # open the interactive player
ymusix play             # same as above
ymusix scan             # scan ~/Music (uses a metadata cache after the first run)
ymusix doctor           # environment checks with install hints
ymusix yt-search "tame impala"   # YouTube search from the CLI
ymusix --help           # full key map
ymusix --version        # version
```

### YouTube workflow

1. Press `/`, then `Tab` to switch to **YouTube** search
2. Type a query, press `Enter` to search
3. On a result: `Enter` streams · `a` queues · `d` downloads (MP3 → `~/Music`)
4. Downloads rescan automatically into the library; `f` favorites videos

### ⌨️ Key map

| Key | Action |
|---|---|
| `↑`/`↓` or `k`/`j` | Move selection |
| `Enter` | Play song / stream YouTube result |
| `Space` | Play / pause |
| `←` / `→` | Seek ∓5s |
| `n` / `p` | Next / previous |
| `+` / `-`, `m` | Volume up/down, mute |
| `s` / `r` | Shuffle toggle / repeat OFF→ALL→ONE |
| `a` / `d` | Queue / remove — or download (YouTube) |
| `x` | Cancel active download |
| `f` | Favorite / unfavorite |
| `/` then `Tab` | Search, switch Local/YouTube |
| `l` / `c` | Library / cycle queue→favorites→recent |
| `Esc` / `q` | Back to library / quit (stops mpv, cleans up) |

## 🛠️ How it works

```text
Local Library ──→ SQLite/FS ──┐
                              ├──→ Queue ──→ Player Service ──→ mpv ──→ Audio
YouTube ──→ YouTubeService ───┘         (mpv JSON-IPC, /tmp/ymusix-<pid>.sock)
YouTube result ──→ Downloader (yt-dlp + ffmpeg) ──→ ~/Music ──→ rescanned
```

- `src/player/Player.js` — the **only** module that touches mpv; React never
  spawns processes. `play(track)` accepts local and YouTube tracks alike.
- `src/online/` — yt-dlp wrappers (argv arrays, never shell interpolation),
  in-memory caches, classified errors (no raw dumps in the UI).
- `src/downloader/` — event-driven downloads with progress, cancel
  (whole process group, so no orphan ffmpeg), and partial cleanup.
- `src/database/database.js` — `node:sqlite` at
  `~/.local/share/ymusix/ymusix.db`: metadata cache, settings, favorites,
  history. No server. Upgrading from the old `termify` name? Your database
  is moved automatically on first run.
- `src/app/App.jsx` + `src/components/` — Ink UI; search stays an overlay,
  footer always shows the keys.

Debug IPC traffic with `YMUSIX_DEBUG_IPC=/tmp/ipc.log ymusix`.

## 🔒 Data & privacy

Everything lives on your disk: songs in `~/Music`, state in
`~/.local/share/ymusix/ymusix.db`, socket in `/tmp`. The only network
traffic is YouTube search/stream/download when you explicitly use it.

## 🩺 Troubleshooting

Run `ymusix doctor` first — it reports exactly what's missing, e.g.:

```text
✓ Node.js 26.10.0 / ✓ mpv v0.41.0 / ✓ yt-dlp / ✓ ffmpeg
✓ Music directory / ✓ SQLite database / ✓ IPC socket / ✓ Network
```

- `✗ mpv was not found` → install mpv (see table above)
- `No Music directory` → `mkdir -p ~/Music` and add files
- Stream won't seek immediately → it buffers first; seek retries automatically
- `q` types instead of quitting while searching → `Esc`, then `q`
  (typing takes precedence inside the search box, like vim)

## 🤝 Contributing

```bash
npm install && npm run build   # dist/cli.js is the runnable bundle
node dist/cli.js doctor        # sanity check
```

Keep UI free of process/network logic (services live in `src/online/`,
`src/downloader/`, `src/player/`), spawn with argv arrays only, and verify
each feature in a real terminal before calling it done.

## 🎬 Cinematic UI (CLI-first)

- Design tokens live in `src/ui/theme.js` (palette `#08070D #171026 #7C3AED
  #FF4FA3 #FF8CCB #4DA6FF`, text `#FFFFFF #C9C4D6 #777185`).
- Layout: `Sidebar` + `TopBar` + view + persistent `PlayerBar`
  (`src/ui/components/`). Views in `src/ui/views/` (Home, Library tabs,
  Now Playing). Shared rows in `TrackRow.jsx`.
- Album art: `src/ui/artwork.js` detects embedded pictures lazily and shows
  a neon marker when present, `♫` otherwise. Text-only by design — no image
  rendering.
- New keys: `h` home · `v` now playing · `t` library tabs.
  All playback/search/queue keys unchanged (`ymusix --help`).
- Responsive: `<80` cols collapses sidebar + hides secondary info, `80–120`
  normal, `>120` full sidebar + richer home. Lists clamp to terminal height
  so the player bar never scrolls off.

## 📄 License

MIT — see [LICENSE](LICENSE).
