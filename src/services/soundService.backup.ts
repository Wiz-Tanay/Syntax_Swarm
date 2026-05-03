/**
 * Procedural Audio Engine for OPEN SCOPE - BACKUP
 * Generates technical, synthesized sound effects using Web Audio API
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private swarmOsc1: OscillatorNode | null = null;
  private swarmOsc2: OscillatorNode | null = null;
  private swarmGain: GainNode | null = null;
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicInterval: any = null;
  private currentPitchFactor: number = 1.0;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.connect(this.ctx.destination);
      this.masterVolume.gain.value = 0.3; // Match App.tsx default
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(value: number) {
    this.init();
    if (this.masterVolume && this.ctx) {
      this.masterVolume.gain.setTargetAtTime(value, this.ctx.currentTime, 0.1);
    }
  }

  private createOscillator(freq: number, type: OscillatorType = 'sine', dest: AudioNode | null = null): { osc: OscillatorNode; gain: GainNode } {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
    osc.connect(gain);
    gain.connect(dest || this.masterVolume!);
    return { osc, gain };
  }

  stopMusic() {
    if (this.musicInterval) clearInterval(this.musicInterval);
    this.musicNodes = [];
    this.musicInterval = null;
  }

  setMusicPitch(factor: number) {
    this.currentPitchFactor = factor;
  }

  startTitleMusic() {
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    let step = 0;
    
    // Tech-Noir rhythmic sequence (16 steps)
    const melSequence = [
      392.00, 466.16, 523.25, 0, 
      587.33, 466.16, 622.25, 587.33,
      523.25, 392.00, 466.16, 523.25,
      698.46, 0, 622.25, 587.33
    ];
    
    const bassSequence = [
      98.00, 0, 98.00, 73.42,
      87.31, 0, 77.78, 73.42,
      98.00, 0, 98.00, 73.42,
      87.31, 110.00, 130.81, 98.00
    ];
    
    const tick = () => {
      if (!this.ctx || this.musicInterval !== intervalRef) return;
      const now = this.ctx.currentTime;
      const s = step % 16;
      
      // 1. Tech Melody Layer (Sine + FM-like sub-oscillators)
      const freq = melSequence[s];
      if (freq > 0) {
        const { osc, gain } = this.createOscillator(freq * this.currentPitchFactor, 'sine');
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (s % 4 === 0 ? 0.8 : 0.4));
        osc.start();
        osc.stop(now + 1.0);
      }

      // 2. Pulsing Bass
      const bFreq = bassSequence[s];
      if (bFreq > 0) {
        const { osc: bOsc, gain: bGain } = this.createOscillator(bFreq * this.currentPitchFactor, 'triangle');
        bGain.gain.setValueAtTime(0, now);
        bGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        bOsc.start();
        bOsc.stop(now + 0.4);
      }

      // 3. Tech Percussion (Hats)
      if (s % 2 === 1) {
        const { osc: hOsc, gain: hGain } = this.createOscillator(6000, 'sine');
        hGain.gain.setValueAtTime(0, now);
        hGain.gain.linearRampToValueAtTime(0.03, now + 0.01);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        hOsc.start();
        hOsc.stop(now + 0.06);
      }

      step++;
    };

    const intervalRef = setInterval(tick, 220); // Faster Tempo (~136bpm base)
    this.musicInterval = intervalRef;
  }

  startGameMusic() {
    this.stopMusic();
    this.init();
    if (!this.ctx) return;
    
    // Ensure context is running (fixes some "lag" or silence issues)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    let step = 0;
    
    // Catchy Tech-Synth Hook (16-step sequence)
    // Scale: A Minor Pentatonic / Blues with some glitch accents
    const leadSeq = [
      440.00, 0, 523.25, 440.00, 
      0, 587.33, 0, 659.25,
      440.00, 659.25, 783.99, 659.25,
      587.33, 523.25, 392.00, 440.00
    ]; 
    
    // Rolling Bassline
    const bassSeq = [
      55.00, 55.00, 55.00, 55.00,
      65.41, 65.41, 65.41, 65.41,
      49.00, 49.00, 49.00, 49.00,
      58.27, 58.27, 61.74, 51.91
    ];
    
    const tick = () => {
      if (!this.ctx || this.musicInterval !== intervalRef) return;
      
      const now = this.ctx.currentTime;
      const s = step % 16;
      const pitch = this.currentPitchFactor;

      // 1. Rolling "Acid" Bass
      const bFreq = bassSeq[s];
      const { osc: bOsc, gain: bGain } = this.createOscillator(bFreq * pitch, 'sawtooth');
      const bFilter = this.ctx.createBiquadFilter();
      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(350, now);
      bFilter.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      
      bOsc.disconnect();
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      
      bGain.gain.setValueAtTime(0, now);
      bGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      bOsc.start(now);
      bOsc.stop(now + 0.18);

      // 2. Catchy Lead Melody
      const lFreq = leadSeq[s];
      if (lFreq > 0) {
        const { osc: lOsc, gain: lGain } = this.createOscillator(lFreq * pitch, 'square');
        const lFilter = this.ctx.createBiquadFilter();
        lFilter.type = 'bandpass';
        lFilter.frequency.setValueAtTime(1200, now);
        lFilter.Q.value = 5;
        
        lOsc.disconnect();
        lOsc.connect(lFilter);
        lFilter.connect(lGain);

        lGain.gain.setValueAtTime(0, now);
        lGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + (s % 4 === 0 ? 0.4 : 0.15));
        lOsc.start(now);
        lOsc.stop(now + 0.5);
      }

      // 3. Driving Percussion
      // Kick on 1, 5, 9, 13
      if (s % 4 === 0) {
        const { osc: kOsc, gain: kGain } = this.createOscillator(160, 'sine');
        kOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
        kGain.gain.setValueAtTime(0.4, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kOsc.start(now);
        kOsc.stop(now + 0.15);
      }

      // Snare on 5, 13
      if (s === 4 || s === 12) {
        const { osc: sOsc, gain: sGain } = this.createOscillator(1000, 'square');
        sGain.gain.setValueAtTime(0.08, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        sOsc.start(now);
        sOsc.stop(now + 0.08);
      }

      // Consistent Hi-hats
      if (s % 2 === 1) {
        const { osc: hOsc, gain: hGain } = this.createOscillator(8000, 'sine');
        hGain.gain.setValueAtTime(0, now);
        hGain.gain.linearRampToValueAtTime(0.02, now + 0.01);
        hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        hOsc.start(now);
        hOsc.stop(now + 0.04);
      }

      step++;
    };
    
    // Driving Tempo (faster, tighter)
    const intervalRef = setInterval(tick, 115); 
    this.musicInterval = intervalRef;
  }

  // --- Swarm Ambience ---

  /** Background "Syntax Swarm" Hum */
  startSwarm() {
    this.init();
    if (this.swarmOsc1) return;

    const now = this.ctx!.currentTime;
    this.swarmGain = this.ctx!.createGain();
    this.swarmGain.gain.setValueAtTime(0, now);
    this.swarmGain.gain.linearRampToValueAtTime(0.08, now + 2); // Slow fade in
    this.swarmGain.connect(this.masterVolume!);

    this.swarmOsc1 = this.ctx!.createOscillator();
    this.swarmOsc1.type = 'triangle';
    this.swarmOsc1.frequency.setValueAtTime(55, now); // Low A

    this.swarmOsc2 = this.ctx!.createOscillator();
    this.swarmOsc2.type = 'sine';
    this.swarmOsc2.frequency.setValueAtTime(56, now); // Slight detune for phasing effect

    this.swarmOsc1.connect(this.swarmGain);
    this.swarmOsc2.connect(this.swarmGain);

    this.swarmOsc1.start();
    this.swarmOsc2.start();
  }

  stopSwarm() {
    if (this.swarmGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.swarmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      setTimeout(() => {
        this.swarmOsc1?.stop();
        this.swarmOsc2?.stop();
        this.swarmOsc1 = null;
        this.swarmOsc2 = null;
        this.swarmGain = null;
      }, 600);
    }
  }

  updateSwarm(level: number) {
    if (!this.swarmOsc1 || !this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = 55 + (Math.max(0, 10 - level) * 2);
    this.swarmOsc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.5);
    this.swarmOsc2.frequency.exponentialRampToValueAtTime(baseFreq + 1.2, now + 0.5);
  }

  // --- Sound Presets ---

  /** Bug deletion: More technical "crush" sound */
  playPing(count: number) {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // 1. Digital Zap (Higher impact)
    const { osc: o1, gain: g1 } = this.createOscillator(2200 + Math.random() * 400, 'square');
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.25, now + 0.002);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    
    // 2. Low "Squash" slide
    const { osc: o2, gain: g2 } = this.createOscillator(300, 'sawtooth');
    o2.frequency.exponentialRampToValueAtTime(50, now + 0.15);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.2, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    o1.start(now);
    o1.stop(now + 0.1);
    o2.start(now);
    o2.stop(now + 0.2);
  }

  /** Number Step: Deep technical "thud" for iteration change */
  playStep() {
    this.init();
    const now = this.ctx!.currentTime;
    
    // Impact
    const { osc: o1, gain: g1 } = this.createOscillator(120, 'sine');
    o1.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    g1.gain.setValueAtTime(0.8, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    // Tech click
    const { osc: o2, gain: g2 } = this.createOscillator(2200, 'square');
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    // Filtered noise pop
    const bufferSize = this.ctx!.sampleRate * 0.1;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx!.createGain();
    nGain.gain.setValueAtTime(0.15, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    noise.connect(nGain);
    nGain.connect(this.masterVolume!);
    noise.start(now);
    noise.stop(now + 0.05);

    o1.start(now);
    o1.stop(now + 0.4);
    o2.start(now);
    o2.stop(now + 0.08);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  /** Victory: A triumphant ascending digital arpeggio */
  playWin() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // C5 Major arpeggio
    
    notes.forEach((freq, i) => {
      const { osc, gain } = this.createOscillator(freq, 'sine');
      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.5);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.6);
    });

    // Sub reinforcement
    const { osc: low, gain: lGain } = this.createOscillator(65.41, 'triangle');
    lGain.gain.setValueAtTime(0, now);
    lGain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    lGain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    low.start(now);
    low.stop(now + 2);
  }

  /** Penalty hit: A punchy technical glitch */
  playError() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    const { osc, gain } = this.createOscillator(160, 'square');
    osc.frequency.linearRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Success/Brackets Closed: Resonant digital chime sweep */
  playSuccess() {
    this.init();
    if (!this.ctx) return;
    const frequencies = [880, 1108.73, 1318.51, 1760]; // A5 Major sweep
    const now = this.ctx.currentTime;
    
    frequencies.forEach((f, i) => {
      const { osc, gain } = this.createOscillator(f, 'sine');
      gain.gain.setValueAtTime(0, now + (i * 0.03));
      gain.gain.linearRampToValueAtTime(0.1, now + (i * 0.03) + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.03) + 0.4);
      osc.start(now + (i * 0.03));
      osc.stop(now + 0.5);
    });
  }

  /** Heavy Improved Explosion: Deep impact + chaotic noise */
  playExplosion() {
    this.init();
    const now = this.ctx!.currentTime;

    // 1. Sub Bass Impact
    const { osc: lowOsc, gain: lowGain } = this.createOscillator(65, 'sine');
    lowOsc.frequency.exponentialRampToValueAtTime(20, now + 0.6);
    lowGain.gain.setValueAtTime(1.2, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    lowOsc.start(now);
    lowOsc.stop(now + 0.9);

    // 2. Mid Thump
    const { osc: midOsc, gain: midGain } = this.createOscillator(160, 'sawtooth');
    midGain.gain.setValueAtTime(0.6, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    midOsc.start(now);
    midOsc.stop(now + 0.5);

    // 3. High Shatter/Noise
    const bufferSize = this.ctx!.sampleRate * 1.0;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 0.8);

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume!);

    noise.start(now);
    noise.stop(now + 0.8);
  }

  /** Startup/Transition: Rising digital scan */
  playStartup() {
    const { osc, gain } = this.createOscillator(80, 'sawtooth');
    const now = this.ctx!.currentTime;
    
    osc.frequency.exponentialRampToValueAtTime(880, now + 1.2);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.1);
    gain.gain.linearRampToValueAtTime(0, now + 1.2);
    
    osc.start(now);
    osc.stop(now + 1.2);
  }

  /** Timeout/Fail: A descending heavy glitch sound */
  playTimeout() {
    this.init();
    const now = this.ctx!.currentTime;
    
    const { osc, gain } = this.createOscillator(220, 'sawtooth');
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.5);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0, now + 1.5);
    
    osc.start(now);
    osc.stop(now + 1.5);

    // Add some noise distortion
    const bufferSize = this.ctx!.sampleRate * 1.5;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 0.5 - 0.25;
    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    const nGain = this.ctx!.createGain();
    nGain.gain.setValueAtTime(0.2, now);
    nGain.gain.linearRampToValueAtTime(0, now + 1.0);
    noise.connect(nGain);
    nGain.connect(this.masterVolume!);
    noise.start(now);
    noise.stop(now + 1.5);
  }

  /** Interaction click: Short tactile noise */
  playClick() {
    const { osc, gain } = this.createOscillator(1600, 'sine');
    const now = this.ctx!.currentTime;
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

export const sounds = new SoundEngine();
