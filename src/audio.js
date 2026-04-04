// What's Poppin — Audio Engine
// All sounds synthesized via Web Audio API — zero external files
// Vibe: satisfying pops, rising tones on combos, bass on big streaks, lo-fi ambient

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.muted = false;
    this.bgPlaying = false;
    this.bgNodes = [];
    this.bgTimeout = null;
    this._resumePromise = null; // Serializes async context activation
    this._pendingBgBeat = false; // Deferred startBgBeat if context not yet running

    // Pentatonic scale for melodic pop sounds — always sounds good
    // D minor pentatonic for that moody, hip-hop feel
    this.scale = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33, 698.46, 783.99];
    this.popIndex = 0;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.ctx.destination);

      // Compressor to keep everything glued
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -24;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 4;
      this.compressor.connect(this.masterGain);

      // Listen for context state changes (iOS interruption, Bluetooth disconnect,
      // tab backgrounding on mobile Safari) to auto-recover the bg beat loop
      this.ctx.addEventListener('statechange', () => {
        if (this.ctx.state === 'running' && this._pendingBgBeat) {
          this._pendingBgBeat = false;
          this.startBgBeat();
        }
      });

      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio not available:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      // AudioContext.resume() is async — serialize it to prevent race conditions
      // where playback fires into a still-suspended context
      if (!this._resumePromise) {
        this._resumePromise = this.ctx.resume().then(() => {
          this._resumePromise = null;
          // If startBgBeat was called while suspended, fire it now
          if (this._pendingBgBeat) {
            this._pendingBgBeat = false;
            this.startBgBeat();
          }
        }).catch(() => { this._resumePromise = null; });
      }
    }
  }

  // True when the AudioContext is running and ready for scheduling
  _isReady() {
    return this.initialized && this.ctx && this.ctx.state === 'running';
  }

  // -------------------------------------------------------
  // VOICE HELPERS — eliminate osc/gain/connect/start/stop boilerplate
  // -------------------------------------------------------

  /**
   * Create a single oscillator voice routed through the compressor.
   * Returns the OscillatorNode for optional bgNodes tracking.
   * @param {Object} o - Voice config
   * @param {string}  o.type      - Oscillator waveform ('sine','triangle','sawtooth','square')
   * @param {number}  o.freq      - Starting frequency (Hz)
   * @param {number}  o.vol       - Starting gain (0–1)
   * @param {number}  o.start     - AudioContext time to start
   * @param {number}  o.stop      - AudioContext time to stop
   * @param {number} [o.freqEnd]  - Frequency to ramp to (exponential)
   * @param {number} [o.freqAt]   - Time to reach freqEnd
   * @param {number} [o.fadeAt]   - Time to fade gain to 0.001 (exponential)
   * @param {AudioNode} [o.via]   - Optional node to route through before compressor (e.g. waveshaper)
   * @returns {OscillatorNode}
   */
  _tone({ type, freq, vol, start, stop, freqEnd, freqAt, fadeAt, via }) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (freqEnd && freqAt) osc.frequency.exponentialRampToValueAtTime(freqEnd, freqAt);
    gain.gain.setValueAtTime(vol, start);
    if (fadeAt) gain.gain.exponentialRampToValueAtTime(0.001, fadeAt);
    osc.connect(via || gain);
    if (via) via.connect(gain);
    gain.connect(this.compressor);
    osc.start(start);
    osc.stop(stop);
    return osc;
  }

  /**
   * Create a filtered noise burst (used for pops, hi-hats, snares, whooshes).
   * @param {Object} n - Noise config
   * @param {number} n.start      - AudioContext start time
   * @param {number} n.dur        - Duration in seconds
   * @param {number} n.vol        - Peak gain (0–1)
   * @param {string} [n.filter='bandpass'] - BiquadFilter type
   * @param {number} [n.filterFreq=3000]   - Filter center/cutoff frequency
   * @param {number} [n.Q=1.5]    - Filter Q factor
   * @param {number} [n.decay=3]  - Envelope power curve exponent (higher = faster decay)
   * @returns {AudioBufferSourceNode}
   */
  _noise({ start, dur, vol, filter = 'bandpass', filterFreq = 3000, Q = 1.5, decay = 3 }) {
    const len = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = filter;
    filt.frequency.value = filterFreq;
    filt.Q.value = Q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(this.compressor);
    src.start(start);
    src.stop(start + dur);
    return src;
  }

  // -------------------------------------------------------
  // BUBBLE SELECT — soft click
  // -------------------------------------------------------
  playSelect() {
    if (!this._isReady()) return;
    const t = this.ctx.currentTime;
    this._tone({ type: 'sine', freq: 800, vol: 0.15, start: t, stop: t + 0.1,
      freqEnd: 1200, freqAt: t + 0.06, fadeAt: t + 0.1 });
  }

  // -------------------------------------------------------
  // BUBBLE POP — melodic, pitch rises with combo chain
  // -------------------------------------------------------
  playPop(streak = 1, bubbleIndex = 0) {
    if (!this._isReady()) return;
    const t = this.ctx.currentTime + bubbleIndex * 0.04; // Stagger pops

    // Pick note from scale — rises with streak for satisfying escalation
    const noteIdx = Math.min(this.popIndex % this.scale.length, this.scale.length - 1);
    const freq = this.scale[noteIdx] * (1 + streak * 0.05);
    this.popIndex++;

    // Main pop tone
    this._tone({ type: 'triangle', freq, vol: 0.2, start: t, stop: t + 0.15,
      freqEnd: freq * 1.5, freqAt: t + 0.08, fadeAt: t + 0.15 });

    // Pop noise burst — the "crunch"
    this._noise({ start: t, dur: 0.06, vol: 0.12 });

    // Extra harmonics on higher streaks
    if (streak >= 3) {
      this._tone({ type: 'sine', freq: freq * 2, vol: 0.08, start: t, stop: t + 0.12,
        fadeAt: t + 0.12 });
    }
  }

  // -------------------------------------------------------
  // NOISE BURST — used for pop texture
  // -------------------------------------------------------
  /** @deprecated Use _noise() directly — kept for backward compat with game.js calls */
  playNoiseBurst(startTime, duration, volume) {
    this._noise({ start: startTime, dur: duration, vol: volume });
  }

  // -------------------------------------------------------
  // STREAK HIT — escalating impact sounds
  // -------------------------------------------------------
  playStreakHit(streak) {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime;
    this.popIndex = 0; // Reset melodic sequence for next chain

    if (streak >= 12) {
      this.playLegendary(now);
    } else if (streak >= 8) {
      this.playGodlike(now);
    } else if (streak >= 5) {
      this.playFire(now);
    } else if (streak >= 3) {
      this.playNice(now);
    }
  }

  // 3-streak: quick vinyl scratch + chord
  playNice(t) {
    // Rising chord — staggered triangle voices
    [1, 1.25, 1.5].forEach((mult, i) => {
      const s = t + i * 0.03;
      this._tone({ type: 'triangle', freq: 440 * mult, vol: 0.1, start: s, stop: t + 0.35,
        fadeAt: t + 0.3 });
    });
    // Quick scratch noise
    this._noise({ start: t, dur: 0.08, vol: 0.15 });
  }

  // 5-streak: 808 kick + rising synth
  playFire(t) {
    // 808 sub kick
    this._tone({ type: 'sine', freq: 150, vol: 0.4, start: t, stop: t + 0.3,
      freqEnd: 40, freqAt: t + 0.2, fadeAt: t + 0.3 });
    // Rising synth sweep
    this._tone({ type: 'sawtooth', freq: 200, vol: 0.08, start: t, stop: t + 0.35,
      freqEnd: 800, freqAt: t + 0.25, fadeAt: t + 0.3 });
    // Hi-hat double tap
    this._noise({ start: t + 0.05, dur: 0.04, vol: 0.2 });
    this._noise({ start: t + 0.12, dur: 0.03, vol: 0.15 });
  }

  // 8-streak: heavy 808, anime slash, power chord
  playGodlike(t) {
    // HEAVY sub bass
    this._tone({ type: 'sine', freq: 200, vol: 0.5, start: t, stop: t + 0.5,
      freqEnd: 30, freqAt: t + 0.4, fadeAt: t + 0.5 });
    // Anime slash — fast descending noise
    this._noise({ start: t, dur: 0.12, vol: 0.3 });
    // Power chord stab
    [329.63, 415.30, 493.88, 659.25].forEach(freq => {
      this._tone({ type: 'square', freq, vol: 0.06, start: t + 0.02, stop: t + 0.45,
        fadeAt: t + 0.4 });
    });
    // Metallic ring
    this._tone({ type: 'sine', freq: 2400, vol: 0.05, start: t, stop: t + 0.6,
      fadeAt: t + 0.6 });
  }

  // 12-streak: full cinematic — bass drop, reverse cymbal, chord swell
  playLegendary(t) {
    // MASSIVE bass drop
    this._tone({ type: 'sine', freq: 300, vol: 0.6, start: t, stop: t + 0.8,
      freqEnd: 25, freqAt: t + 0.6, fadeAt: t + 0.8 });

    // Distorted sub layer — routes through waveshaper for grit
    const waveshaper = this.ctx.createWaveShaper();
    waveshaper.curve = this.makeDistortionCurve(80);
    this._tone({ type: 'sine', freq: 55, vol: 0.15, start: t, stop: t + 0.7,
      fadeAt: t + 0.7, via: waveshaper });

    // Reverse cymbal swell
    const swellDuration = 0.5;
    const swellBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * swellDuration, this.ctx.sampleRate);
    const swellData = swellBuffer.getChannelData(0);
    for (let i = 0; i < swellData.length; i++) {
      const progress = i / swellData.length;
      swellData[i] = (Math.random() * 2 - 1) * Math.pow(progress, 2);
    }
    const swell = this.ctx.createBufferSource();
    swell.buffer = swellBuffer;
    const swellFilter = this.ctx.createBiquadFilter();
    swellFilter.type = 'highpass';
    swellFilter.frequency.setValueAtTime(2000, t);
    swellFilter.frequency.linearRampToValueAtTime(8000, t + swellDuration);
    const swellGain = this.ctx.createGain();
    swellGain.gain.setValueAtTime(0.001, t);
    swellGain.gain.linearRampToValueAtTime(0.25, t + swellDuration * 0.8);
    swellGain.gain.exponentialRampToValueAtTime(0.001, t + swellDuration);
    swell.connect(swellFilter);
    swellFilter.connect(swellGain);
    swellGain.connect(this.compressor);
    swell.start(t);

    // Triumphant chord at peak
    const chordTime = t + 0.15;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, chordTime);
      gain.gain.linearRampToValueAtTime(0.08, chordTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.8);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(chordTime);
      osc.stop(chordTime + 0.85);
    });
  }

  // -------------------------------------------------------
  // FEVER ACTIVATE — rising siren + impact
  // -------------------------------------------------------
  playFeverActivate() {
    if (!this._isReady()) return;
    const t = this.ctx.currentTime;
    // Rising siren sweep
    this._tone({ type: 'sawtooth', freq: 300, vol: 0.1, start: t, stop: t + 0.55,
      freqEnd: 1200, freqAt: t + 0.3, fadeAt: t + 0.5 });
    // Sub impact at peak
    this._tone({ type: 'sine', freq: 120, vol: 0.35, start: t + 0.25, stop: t + 0.65,
      freqEnd: 40, freqAt: t + 0.55, fadeAt: t + 0.6 });
    // Noise burst for texture
    this._noise({ start: t + 0.25, dur: 0.1, vol: 0.2 });
  }

  // -------------------------------------------------------
  // INVALID MOVE — dull thud
  // -------------------------------------------------------
  playInvalid() {
    if (!this._isReady()) return;
    const t = this.ctx.currentTime;
    this._tone({ type: 'sine', freq: 200, vol: 0.15, start: t, stop: t + 0.2,
      freqEnd: 80, freqAt: t + 0.15, fadeAt: t + 0.2 });
  }

  // -------------------------------------------------------
  // BUBBLE LAND — soft thump when bubbles drop into place
  // -------------------------------------------------------
  playLand(delay = 0) {
    if (!this._isReady()) return;
    const t = this.ctx.currentTime + delay;
    this._tone({ type: 'sine', freq: 120, vol: 0.06, start: t, stop: t + 0.1,
      freqEnd: 60, freqAt: t + 0.08, fadeAt: t + 0.1 });
  }

  // -------------------------------------------------------
  // SHUFFLE — whoosh
  // -------------------------------------------------------
  playShuffle() {
    if (!this._isReady()) return;
    // Whoosh — flat noise (decay=0) with bandpass sweep, louder than typical bursts
    this._noise({ start: this.ctx.currentTime, dur: 0.4, vol: 0.15,
      filter: 'bandpass', filterFreq: 2000, Q: 2, decay: 0 });
  }

  // -------------------------------------------------------
  // BACKGROUND BEAT — lo-fi hip-hop loop
  // -------------------------------------------------------
  startBgBeat() {
    if (!this.initialized || this.bgPlaying) return;
    // Defer if context is still resuming — _pendingBgBeat triggers in resume() callback
    if (this.ctx.state !== 'running') {
      this._pendingBgBeat = true;
      return;
    }
    this.bgPlaying = true;
    this.bgLoop();
  }

  stopBgBeat() {
    this.bgPlaying = false;
    this._pendingBgBeat = false; // Cancel any deferred start
    if (this.bgTimeout) {
      clearTimeout(this.bgTimeout);
      this.bgTimeout = null;
    }
    this.bgNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    this.bgNodes = [];
  }

  bgLoop() {
    if (!this.bgPlaying) return;
    // Context can suspend mid-playback (iOS phone call, Bluetooth disconnect,
    // mobile tab backgrounding). Park the loop and let statechange recover it.
    if (!this._isReady()) {
      this._pendingBgBeat = true;
      this.bgPlaying = false;
      return;
    }
    const now = this.ctx.currentTime;
    const bpm = 75; // Lo-fi tempo
    const beat = 60 / bpm;
    const bar = beat * 4;

    // Clear finished nodes from previous bar to prevent unbounded memory growth
    // All nodes from the prior bar have stopped by now (bar duration ≈ 3.2s)
    this.bgNodes = [];

    // Kick pattern: 1, 2.5, 3
    [0, beat * 1.5, beat * 2].forEach(t => {
      this.bgKick(now + t);
    });

    // Hi-hat on every half beat, slightly swung
    for (let i = 0; i < 8; i++) {
      const swing = i % 2 === 1 ? 0.02 : 0;
      const vol = i % 2 === 0 ? 0.06 : 0.03;
      this.bgHihat(now + i * (beat / 2) + swing, vol);
    }

    // Snare on 2 and 4
    this.bgSnare(now + beat);
    this.bgSnare(now + beat * 3);

    // Sub bass note — changes every 2 bars
    const bassNotes = [55, 65.41, 73.42, 61.74]; // A1, C2, D2, B1
    const noteIdx = Math.floor((now / (bar * 2)) % bassNotes.length);
    this.bgBass(now, bassNotes[noteIdx], bar);

    // Schedule next bar
    const nextTime = (bar * 1000) - 50; // Slight early to prevent gaps
    this.bgTimeout = setTimeout(() => this.bgLoop(), nextTime);
  }

  bgKick(t) {
    this.bgNodes.push(
      this._tone({ type: 'sine', freq: 100, vol: 0.2, start: t, stop: t + 0.2,
        freqEnd: 35, freqAt: t + 0.12, fadeAt: t + 0.2 })
    );
  }

  bgHihat(t, vol = 0.05) {
    this.bgNodes.push(
      this._noise({ start: t, dur: 0.05, vol, filter: 'highpass', filterFreq: 7000, decay: 8 })
    );
  }

  bgSnare(t) {
    // Noise body
    this.bgNodes.push(
      this._noise({ start: t, dur: 0.12, vol: 0.1 })
    );
    // Tonal snap
    this.bgNodes.push(
      this._tone({ type: 'triangle', freq: 200, vol: 0.08, start: t, stop: t + 0.06,
        fadeAt: t + 0.06 })
    );
  }

  bgBass(t, freq, duration) {
    this.bgNodes.push(
      this._tone({ type: 'sine', freq, vol: 0.12, start: t, stop: t + duration,
        fadeAt: t + duration })
    );
  }

  // -------------------------------------------------------
  // MUTE / UNMUTE
  // -------------------------------------------------------
  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.6, this.ctx.currentTime, 0.08);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // -------------------------------------------------------
  // UTILITY
  // -------------------------------------------------------
  makeDistortionCurve(amount) {
    const samples = 44100;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
}

// Global instance
window.audioEngine = new AudioEngine();
