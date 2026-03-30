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
  // BUBBLE SELECT — soft click
  // -------------------------------------------------------
  playSelect() {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // -------------------------------------------------------
  // BUBBLE POP — melodic, pitch rises with combo chain
  // -------------------------------------------------------
  playPop(streak = 1, bubbleIndex = 0) {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime;
    const delay = bubbleIndex * 0.04; // Stagger pops in a group

    // Pick note from scale — rises with streak for satisfying escalation
    const noteIdx = Math.min(this.popIndex % this.scale.length, this.scale.length - 1);
    const freq = this.scale[noteIdx] * (1 + streak * 0.05);
    this.popIndex++;

    // Main pop tone
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + delay + 0.08);
    gain.gain.setValueAtTime(0.2, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now + delay);
    osc.stop(now + delay + 0.15);

    // Pop noise burst — the "crunch"
    this.playNoiseBurst(now + delay, 0.06, 0.12);

    // Extra harmonics on higher streaks
    if (streak >= 3) {
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      gain2.gain.setValueAtTime(0.08, now + delay);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
      osc2.connect(gain2);
      gain2.connect(this.compressor);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.12);
    }
  }

  // -------------------------------------------------------
  // NOISE BURST — used for pop texture
  // -------------------------------------------------------
  playNoiseBurst(startTime, duration, volume) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(startTime);
    noise.stop(startTime + duration);
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
    // Rising chord
    [1, 1.25, 1.5].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = 440 * mult;
      gain.gain.setValueAtTime(0.1, t + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(t + i * 0.03);
      osc.stop(t + 0.35);
    });

    // Quick scratch noise
    this.playNoiseBurst(t, 0.08, 0.15);
  }

  // 5-streak: 808 kick + rising synth
  playFire(t) {
    // 808 sub kick
    const kick = this.ctx.createOscillator();
    const kickGain = this.ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(150, t);
    kick.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    kickGain.gain.setValueAtTime(0.4, t);
    kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    kick.connect(kickGain);
    kickGain.connect(this.compressor);
    kick.start(t);
    kick.stop(t + 0.3);

    // Rising synth sweep
    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(200, t);
    sweep.frequency.exponentialRampToValueAtTime(800, t + 0.25);
    sweepGain.gain.setValueAtTime(0.08, t);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    sweep.connect(sweepGain);
    sweepGain.connect(this.compressor);
    sweep.start(t);
    sweep.stop(t + 0.35);

    // Hi-hat
    this.playNoiseBurst(t + 0.05, 0.04, 0.2);
    this.playNoiseBurst(t + 0.12, 0.03, 0.15);
  }

  // 8-streak: heavy 808, anime slash, power chord
  playGodlike(t) {
    // HEAVY sub bass
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(200, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    subGain.gain.setValueAtTime(0.5, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    sub.connect(subGain);
    subGain.connect(this.compressor);
    sub.start(t);
    sub.stop(t + 0.5);

    // Anime slash — fast descending noise
    this.playNoiseBurst(t, 0.12, 0.3);

    // Power chord stab
    [329.63, 415.30, 493.88, 659.25].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      gain.connect(this.compressor);
      osc.start(t + 0.02);
      osc.stop(t + 0.45);
    });

    // Metallic ring
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.value = 2400;
    ringGain.gain.setValueAtTime(0.05, t);
    ringGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    ring.connect(ringGain);
    ringGain.connect(this.compressor);
    ring.start(t);
    ring.stop(t + 0.6);
  }

  // 12-streak: full cinematic — bass drop, reverse cymbal, chord swell
  playLegendary(t) {
    // MASSIVE bass drop
    const drop = this.ctx.createOscillator();
    const dropGain = this.ctx.createGain();
    drop.type = 'sine';
    drop.frequency.setValueAtTime(300, t);
    drop.frequency.exponentialRampToValueAtTime(25, t + 0.6);
    dropGain.gain.setValueAtTime(0.6, t);
    dropGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    drop.connect(dropGain);
    dropGain.connect(this.compressor);
    drop.start(t);
    drop.stop(t + 0.8);

    // Distorted sub layer
    const dist = this.ctx.createOscillator();
    const distGain = this.ctx.createGain();
    const waveshaper = this.ctx.createWaveShaper();
    waveshaper.curve = this.makeDistortionCurve(80);
    dist.type = 'sine';
    dist.frequency.setValueAtTime(55, t);
    distGain.gain.setValueAtTime(0.15, t);
    distGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    dist.connect(waveshaper);
    waveshaper.connect(distGain);
    distGain.connect(this.compressor);
    dist.start(t);
    dist.stop(t + 0.7);

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
  // INVALID MOVE — dull thud
  // -------------------------------------------------------
  playInvalid() {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // -------------------------------------------------------
  // BUBBLE LAND — soft thump when bubbles drop into place
  // -------------------------------------------------------
  playLand(delay = 0) {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // -------------------------------------------------------
  // SHUFFLE — whoosh
  // -------------------------------------------------------
  playShuffle() {
    if (!this._isReady()) return;
    const now = this.ctx.currentTime;

    // Whoosh noise sweep
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.4);
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(now);
    noise.stop(now + 0.4);
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
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(t);
    osc.stop(t + 0.2);
    this.bgNodes.push(osc);
  }

  bgHihat(t, vol = 0.05) {
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 8);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(t);
    noise.stop(t + 0.05);
    this.bgNodes.push(noise);
  }

  bgSnare(t) {
    // Noise body
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    noise.start(t);
    noise.stop(t + 0.12);
    this.bgNodes.push(noise);

    // Tonal snap
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 200;
    oscGain.gain.setValueAtTime(0.08, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(oscGain);
    oscGain.connect(this.compressor);
    osc.start(t);
    osc.stop(t + 0.06);
    this.bgNodes.push(osc);
  }

  bgBass(t, freq, duration) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.setValueAtTime(0.12, t + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(t);
    osc.stop(t + duration);
    this.bgNodes.push(osc);
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
