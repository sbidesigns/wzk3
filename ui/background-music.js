/**
 * BackgroundMusic — Procedural synthwave / cyberpunk loop for WZK3
 * Warzone Kart: Neon Underground
 *
 * Layers: bass drone (sawtooth + LPF), pad (sine chord + LFO tremolo),
 * arpeggiator (square wave, Am pentatonic sequencer), hi-hat (noise + BPF)
 * Tempo: 120 BPM | Key: A minor | Master gain with 1s fade
 */

const NOTE = {
  A1: 55, A2: 110, A3: 220, C4: 261.63,
  D4: 293.66, E4: 329.63, G4: 392, A4: 440,
};
const ARP_NOTES   = [NOTE.A3, NOTE.C4, NOTE.D4, NOTE.E4, NOTE.G4];
const ARP_PATTERN = [0, 2, 4, 3, 1, 3, 4, 2];
const BPM         = 120;
const SIXTEENTH   = (60 / BPM) / 4;   // 0.125 s per step
const FADE_TIME   = 1;                // seconds

function createNoiseBuffer(ctx, duration = 2) {
  const len  = ctx.sampleRate * duration;
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

class BackgroundMusic {
  constructor() {
    this._ctx     = null;
    this._master  = null;
    this._prevVol = 0.6;
    this._volume  = 0.6;
    this._playing = false;
    this._muted   = false;
    this._nodes   = {};
    this._timers  = [];
    this._bound   = {};
  }

  /**
   * Create AudioContext + master gain; wire up race events.
   * Safe to call multiple times — no-ops if already initialised.
   */
  init() {
    if (this._ctx) return this;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      console.warn('[BGM] AudioContext unavailable');
      return this;
    }

    this._master = this._ctx.createGain();
    this._master.gain.value = 0;
    this._master.connect(this._ctx.destination);

    // Race bus listeners
    this._bound._onRaceGo  = () => this.start();
    this._bound._onRaceEnd = () => this.stop();
    const bus = window.__engine?.bus;
    if (bus) {
      bus.on('race:go',            this._bound._onRaceGo);
      bus.on('race:end',           this._bound._onRaceEnd);
      bus.on('mode:circuit:raceEnd', this._bound._onRaceEnd);
    }

    // Autoplay-policy resume on first user gesture
    const resume = () => {
      try { if (this._ctx.state === 'suspended') this._ctx.resume(); } catch (_) {}
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown',     resume, { once: true });

    return this;
  }

  /** Start the procedural loop with a 1 s fade-in. */
  start() {
    if (this._playing) return this;
    this.init();
    if (!this._ctx) return this;

    try {
      if (this._ctx.state === 'suspended') this._ctx.resume();
    } catch (_) {}

    this._playing = true;
    this._buildLayers();
    this._startSequencers();

    try {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(0, t);
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : this._volume, t + FADE_TIME
      );
    } catch (_) {}

    return this;
  }

  /** Fade out over 1 s then tear down all nodes. */
  stop() {
    if (!this._playing) return this;
    this._playing = false;

    try {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(this._master.gain.value, t);
      this._master.gain.linearRampToValueAtTime(0, t + FADE_TIME);
    } catch (_) {}

    setTimeout(() => this._teardown(), FADE_TIME * 1000 + 50);
    return this;
  }

  /** Set volume 0..1 (clamped). Stores value for unmute restore. */
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._muted) this._prevVol = this._volume;
    if (!this._playing) return this;
    try {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(this._master.gain.value, t);
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : this._volume, t + 0.05
      );
    } catch (_) {}
    return this;
  }

  /** Mute / unmute toggle. */
  setMuted(m) {
    this._muted = !!m;
    if (this._muted) this._prevVol = this._volume;
    if (!this._playing) return this;
    try {
      const t = this._ctx.currentTime;
      this._master.gain.cancelScheduledValues(t);
      this._master.gain.setValueAtTime(this._master.gain.value, t);
      this._master.gain.linearRampToValueAtTime(
        this._muted ? 0 : this._prevVol, t + 0.05
      );
    } catch (_) {}
    return this;
  }

  /* ── layer construction ───────────────────────────────────────── */

  _buildLayers() {
    const ctx  = this._ctx;
    const dest = this._master;

    // 1 ─ Bass drone: sawtooth A2 → LPF 220 Hz (Q 4) → gain 0.32
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = NOTE.A2;

    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 220;
    bassFilter.Q.value = 4;

    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.32;
    bassOsc.connect(bassFilter).connect(bassGain).connect(dest);
    bassOsc.start();
    this._nodes.bass = { osc: bassOsc, filter: bassFilter, gain: bassGain };

    // 2 ─ Pad: sine Am triad (A3, C4, E4) with slow LFO tremolo
    const padGain = ctx.createGain();
    padGain.gain.value = 0.12;
    padGain.connect(dest);

    const padOscs = [NOTE.A3, NOTE.C4, NOTE.E4].map(freq => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(padGain);
      o.start();
      return o;
    });

    const padLFO = ctx.createOscillator();
    padLFO.type = 'sine';
    padLFO.frequency.value = 0.4;
    const padLFOGain = ctx.createGain();
    padLFOGain.gain.value = 0.04;
    padLFO.connect(padLFOGain).connect(padGain.gain);
    padLFO.start();

    this._nodes.pad = { oscs: padOscs, gain: padGain, lfo: padLFO, lfoGain: padLFOGain };

    // 4 ─ Hi-hat: looping white noise → BPF 8 kHz → gain (sequenced)
    const noiseBuf = createNoiseBuffer(ctx);
    const hhSrc    = ctx.createBufferSource();
    hhSrc.buffer   = noiseBuf;
    hhSrc.loop     = true;

    const hhBP = ctx.createBiquadFilter();
    hhBP.type = 'bandpass';
    hhBP.frequency.value = 8000;
    hhBP.Q.value = 1.2;

    const hhGain = ctx.createGain();
    hhGain.gain.value = 0;
    hhSrc.connect(hhBP).connect(hhGain).connect(dest);
    hhSrc.start();

    this._nodes.hihat = { src: hhSrc, filter: hhBP, gain: hhGain };
  }

  /* ── sequencer ─────────────────────────────────────────────────── */

  _startSequencers() {
    const ctx  = this._ctx;
    const step = SIXTEENTH * 1000;
    let arpIdx = 0;

    const seqId = setInterval(() => {
      if (!this._playing) return;
      try {
        const now = ctx.currentTime;

        // ─ Arp note (square wave, LPF at 1800 Hz, exponential decay)
        if (this._nodes._arpOsc) {
          try { this._nodes._arpOsc.stop(now + 0.01); } catch (_) {}
        }
        const arpOsc = ctx.createOscillator();
        arpOsc.type = 'square';
        arpOsc.frequency.value = ARP_NOTES[ARP_PATTERN[arpIdx % ARP_PATTERN.length]];

        const arpFilt = ctx.createBiquadFilter();
        arpFilt.type = 'lowpass';
        arpFilt.frequency.value = 1800;
        arpFilt.Q.value = 2;

        const arpG = ctx.createGain();
        arpG.gain.setValueAtTime(0.10, now);
        arpG.gain.exponentialRampToValueAtTime(0.001, now + step / 1000 * 0.9);

        arpOsc.connect(arpFilt).connect(arpG).connect(this._master);
        arpOsc.start(now);
        arpOsc.stop(now + step / 1000);
        this._nodes._arpOsc = arpOsc;

        // ─ Hi-hat: 8th-note hits + accented beats
        const hh = this._nodes.hihat;
        if (hh) {
          if (arpIdx % 4 === 0) {
            // accented on the beat
            hh.gain.gain.cancelScheduledValues(now);
            hh.gain.gain.setValueAtTime(0.14, now);
            hh.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          } else if (arpIdx % 2 === 0) {
            // regular 8th
            hh.gain.gain.cancelScheduledValues(now);
            hh.gain.gain.setValueAtTime(0.08, now);
            hh.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          }
        }

        arpIdx++;
      } catch (_) {}
    }, step);

    this._timers.push(seqId);
  }

  /* ── teardown ─────────────────────────────────────────────────── */

  _teardown() {
    this._timers.forEach(id => clearInterval(id));
    this._timers = [];

    const n = this._nodes;
    try {
      if (n.bass)  { n.bass.osc.stop(); n.bass.osc.disconnect(); }
      if (n.pad) {
        n.pad.oscs.forEach(o => { try { o.stop(); o.disconnect(); } catch (_) {} });
        n.pad.lfo.stop();
        n.pad.lfoGain.disconnect();
        n.pad.gain.disconnect();
      }
      if (n.hihat)  { n.hihat.src.stop(); n.hihat.filter.disconnect(); n.hihat.gain.disconnect(); }
      if (n._arpOsc) { n._arpOsc.disconnect(); }
    } catch (_) {}
    this._nodes = {};
  }

  /** Full cleanup — stops playback, removes listeners, closes AudioContext. */
  destroy() {
    this.stop();
    const bus = window.__engine?.bus;
    if (bus) {
      bus.off('race:go',            this._bound._onRaceGo);
      bus.off('race:end',           this._bound._onRaceEnd);
      bus.off('mode:circuit:raceEnd', this._bound._onRaceEnd);
    }
    if (this._ctx) {
      try { this._ctx.close(); } catch (_) {}
      this._ctx = null;
    }
  }
}

/* ── singleton + exports ─────────────────────────────────────────── */
const backgroundMusic = new BackgroundMusic();

export { BackgroundMusic };
export { backgroundMusic };
export default BackgroundMusic;
