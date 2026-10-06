export function helpText() {
  return `ymusix — a Spotify-inspired terminal music player (local-first, with optional YouTube)

Usage:
  ymusix              Open the interactive player
  ymusix play         Open the interactive player
  ymusix scan         Scan ~/Music for audio files
  ymusix doctor       Check mpv, yt-dlp, ffmpeg, ~/Music, database, network
  ymusix yt-search "<query>"
                       Search YouTube from the command line (diagnostic)
  ymusix --help       Show this help
  ymusix --version    Show version

Keys (in player):
  ↑/k, ↓/j    Move selection
  Enter       Play selected song / stream YouTube result
  Space       Play / pause
  ← / →       Seek backward / forward (5s)
  n / p       Next / previous song
  + / -       Volume up / down
  m           Mute / unmute
  s           Toggle shuffle
  r           Cycle repeat (OFF → ALL → ONE)
  a           Add to queue (local songs and YouTube results)
  d           Remove from queue — or download a YouTube result to ~/Music
  x           Cancel an active download
  f           Favorite / unfavorite (local songs and YouTube videos)
  /           Search — Tab switches Local / YouTube, Enter searches YouTube
  l           Library view
  c           Cycle queue → favorites → recently played
  Esc         Close search / back to library
  q           Quit

YouTube workflow: press /, Tab to YouTube, type a query, Enter to search,
then Enter streams, a queues, d downloads (MP3 into ~/Music, then rescanned
into the library). Only download content you are authorized to download/use.

Data is stored locally in ~/.local/share/ymusix/ymusix.db.
Requires mpv for audio playback; yt-dlp + ffmpeg enable YouTube features
(see: ymusix doctor).
`;
}
