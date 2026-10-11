import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { statSync, unlinkSync, appendFileSync } from 'node:fs';
import { chmod, unlink, lstat } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { checkMpv } from './check.js';
import { resolveStreamUrl } from '../online/YouTubeService.js';

// Dedicated mpv backend. Single `mpv --idle` daemon controlled over JSON IPC.
// All writes are serialized through a queue so concurrent commands from the
// React UI can't interleave partial JSON lines.
export class Player extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.socketPath = `/tmp/ymusix-${process.pid}.sock`;
    this.mpv = null;
    this.ipc = null;
    this.buffer = '';
    this.nextId = 1;
    this.pending = new Map(); // request_id -> {resolve, reject}
    this.writeQueue = Promise.resolve();
    this.connected = false;
    this.started = false;
    this.starting = null;
    this.currentPath = null;
    this.paused = false;
    const v = Math.round(Number(opts.volume ?? 80));
    this.volume = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 80;
    this.muted = opts.muted === true;
    this.dead = false;
  }

  async ensureStarted() {
    if (this.started && this.connected) return;
    if (this.starting) {
      await this.starting;
      return;
    }
    this.starting = this.#spawn();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async #spawn() {
    const { ok, hint } = await checkMpv();
    if (!ok) {
      const err = new Error('mpv-not-found');
      err.hint = hint;
      throw err;
    }

    await this.#removeSocketIfOurs().catch(() => {});

    this.dead = false;
    this.mpv = spawn(
      'mpv',
      [
        '--idle=yes',
        '--no-video',
        '--no-terminal',
        '--audio-display=no',
        '--msg-level=all=no',
        `--input-ipc-server=${this.socketPath}`,
        `--volume=${this.volume}`,
        `--mute=${this.muted ? 'yes' : 'no'}`,
      ],
      { stdio: 'ignore' },
    );

    this.mpv.on('error', (err) => {
      this.connected = false;
      this.emit('fatal', err);
    });
    this.mpv.on('exit', (code) => {
      this.connected = false;
      if (!this.dead) this.emit('fatal', new Error(`mpv exited (code ${code ?? '?'})`));
    });

    await this.#connectIpc(50, 100);
    this.started = true;
    await chmod(this.socketPath, 0o600).catch(() => {});
    // Observe properties we keep in sync; time-pos is polled instead so the
    // UI isn't flooded with events.
    for (const prop of ['pause', 'volume', 'mute', 'duration']) {
      await this.send('observe_property', this.nextId++, prop).catch(() => {});
    }
  }

  #connectIpc(retries, delayMs) {
    return new Promise((resolve, reject) => {
      const attempt = (left) => {
        const sock = createConnection(this.socketPath);
        sock.once('connect', () => {
          this.ipc = sock;
          this.connected = true;
          sock.on('data', (chunk) => this.#onData(chunk));
          sock.on('error', () => {});
          sock.on('close', () => {
            this.connected = false;
          });
          resolve();
        });
        sock.once('error', () => {
          sock.destroy();
          if (left <= 0) {
            reject(new Error('could not connect to mpv IPC socket'));
          } else {
            setTimeout(() => attempt(left - 1), delayMs);
          }
        });
      };
      attempt(retries);
    });
  }

  #onData(chunk) {
    this.buffer += chunk.toString('utf8');
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      this.#onMessage(msg);
    }
  }

  #onMessage(msg) {
    if (process.env.YMUSIX_DEBUG_IPC) {
      try {
        appendFileSync(process.env.YMUSIX_DEBUG_IPC, JSON.stringify(msg) + '\n');
      } catch {
        // debug only
      }
    }
    if (msg.request_id && this.pending.has(msg.request_id)) {
      const { resolve, reject } = this.pending.get(msg.request_id);
      this.pending.delete(msg.request_id);
      if (msg.error && msg.error !== 'success') {
        reject(new Error(`mpv: ${msg.error}`));
      } else {
        resolve(msg.data);
      }
      return;
    }
    const event = msg.event;
    if (event === 'property-change') {
      if (msg.name === 'pause') {
        this.paused = msg.data === true;
        this.emit('pause-change', this.paused);
      } else if (msg.name === 'volume') {
        if (Number.isFinite(msg.data)) this.volume = Math.round(msg.data);
        this.emit('volume', this.volume);
      } else if (msg.name === 'mute') {
        this.muted = msg.data === true;
        this.emit('mute', this.muted);
      } else if (msg.name === 'duration') {
        this.emit('duration', Number.isFinite(msg.data) ? msg.data : 0);
      }
    } else if (event === 'end-file') {
      this.emit('ended', msg.reason ?? 'eof');
    }
  }

  send(command, ...args) {
    const id = this.nextId++;
    const payload = JSON.stringify({ command: [command, ...args], request_id: id }) + '\n';
    return new Promise((resolve, reject) => {
      this.writeQueue = this.writeQueue.then(
        () =>
          new Promise((res) => {
            if (!this.ipc || !this.connected) {
              reject(new Error('mpv is not connected'));
              res();
              return;
            }
            this.pending.set(id, { resolve, reject });
            this.ipc.write(payload, (err) => {
              if (err) {
                this.pending.delete(id);
                reject(err);
              }
              res();
            });
            setTimeout(() => {
              if (this.pending.has(id)) {
                this.pending.delete(id);
                reject(new Error('mpv command timed out'));
              }
            }, 5000).unref?.();
          }),
      );
    });
  }

  // Accepts a local path string (legacy), a local song object ({path,...}),
  // or a YouTube track ({source:'youtube', id, url, ...}). React never sees
  // mpv details — resolution of remote streams happens here.
  async play(source) {
    await this.ensureStarted();
    let target;
    if (source && source.source === 'youtube') {
      this.emit('resolving', source);
      target = await resolveStreamUrl(source);
      this.currentTrack = source;
      this.currentPath = null;
    } else {
      target = typeof source === 'string' ? source : source.path;
      this.currentPath = target;
      this.currentTrack = null;
    }
    await this.send('loadfile', target, 'replace');
    await this.send('set_property', 'pause', false).catch(() => {});
    this.paused = false;
  }

  async toggle() {
    await this.ensureStarted();
    const paused = !this.paused;
    await this.send('set_property', 'pause', paused);
    this.paused = paused;
    return paused;
  }

  async pause() {
    await this.send('set_property', 'pause', true);
    this.paused = true;
  }

  async resume() {
    await this.send('set_property', 'pause', false);
    this.paused = false;
  }

  async stop() {
    if (!this.connected) return;
    await this.send('stop').catch(() => {});
    this.currentPath = null;
  }

  async seekBy(seconds) {
    await this.#ensureSeekable();
    await this.send('seek', seconds, 'relative');
  }

  async seekTo(seconds) {
    await this.#ensureSeekable();
    await this.send('seek', Math.max(0, seconds), 'absolute');
  }

  // Remote streams load asynchronously: right after loadfile there is no
  // active file yet, so seek would fail with "error running command".
  // Wait (bounded) until the loaded file reports seekable instead.
  async #ensureSeekable(timeoutMs = 5000) {
    const start = Date.now();
    for (;;) {
      try {
        if ((await this.send('get_property', 'seekable')) === true) return;
      } catch {
        // no file loaded yet (or transient IPC failure) — keep waiting
      }
      if (Date.now() - start >= timeoutMs) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    const err = new Error('This stream does not support seeking right now.');
    err.code = 'unseekable';
    throw err;
  }

  async setVolume(value) {
    const v = Math.max(0, Math.min(100, Math.round(value)));
    await this.send('set_property', 'volume', v);
    this.volume = v;
    return v;
  }

  async setMuted(muted) {
    await this.send('set_property', 'mute', muted);
    this.muted = muted;
  }

  async getTime() {
    try {
      const data = await this.send('get_property', 'time-pos');
      return Number.isFinite(data) ? data : 0;
    } catch {
      return 0;
    }
  }

  async getDuration() {
    try {
      const data = await this.send('get_property', 'duration');
      return Number.isFinite(data) ? data : 0;
    } catch {
      return 0;
    }
  }

  async #removeSocketIfOurs() {
    try {
      const st = await lstat(this.socketPath);
      if (st.uid === process.getuid?.()) {
        await unlink(this.socketPath);
      }
    } catch {
      // missing socket or foreign owner -> leave alone
    }
  }

  // Idempotent: safe to call multiple times and from signal handlers.
  async quit() {
    if (this.dead) return;
    this.dead = true;
    for (const [, { reject }] of this.pending) {
      reject(new Error('player shutting down'));
    }
    this.pending.clear();
    try {
      if (this.ipc && this.connected) {
        this.ipc.write(JSON.stringify({ command: ['quit'] }) + '\n');
      }
    } catch {
      // ignore
    }
    try {
      this.ipc?.destroy();
    } catch {
      // ignore
    }
    this.ipc = null;
    this.connected = false;
    try {
      this.mpv?.kill('SIGTERM');
    } catch {
      // ignore
    }
    // Confirm death: a stream stuck in teardown can outlive SIGTERM past
    // our process.exit. Escalate to SIGKILL rather than orphaning mpv.
    if (this.mpv) {
      const child = this.mpv;
      await new Promise((res) => {
        if (child.exitCode !== null) return res();
        const t = setTimeout(() => {
          try {
            child.kill('SIGKILL');
          } catch {
            // already gone
          }
          res();
        }, 800);
        child.once('exit', () => {
          clearTimeout(t);
          res();
        });
      });
    }
    this.mpv = null;
    this.#removeSocketSync();
  }

  // Synchronous, ownership-checked removal so no stale socket survives
  // process exit. The async retry in spawn() covers crashes.
  #removeSocketSync() {
    try {
      const st = statSync(this.socketPath);
      if (st.uid === process.getuid?.()) {
        unlinkSync(this.socketPath);
      }
    } catch {
      // missing or foreign-owned -> leave alone
    }
  }
}
