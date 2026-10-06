import { execFile } from 'node:child_process';

export const MPV_INSTALL_HINT = `mpv was not found.

Ymusix requires mpv for audio playback.

Install it with:
  Arch:           sudo pacman -S mpv
  Debian/Ubuntu:  sudo apt install mpv
  Fedora:         sudo dnf install mpv`;

export function checkMpv() {
  return new Promise((resolve) => {
    execFile('mpv', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ ok: false, hint: MPV_INSTALL_HINT });
        return;
      }
      const firstLine = String(stdout).split('\n')[0]?.trim() ?? 'mpv';
      resolve({ ok: true, version: firstLine });
    });
  });
}
