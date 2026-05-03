/**
 * Procedural Audio Engine for OPEN SCOPE
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
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.connect(this.ctx.destination);
    this.masterVolume.gain.value = 0.4; // Global volume
  }

  setVolume(value: number) {
    this.init();
    if (this.masterVolume) {
      this.masterVolume.gain.setTargetAtTime(value, this.ctx!.currentTime, 0.1);
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
    let step = 0;
    const sequence = [110, 110, 164, 110, 220, 110, 164, 110];
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      const freq = sequence[step % sequence.length];
      const { osc, gain } = this.createOscillator(freq * this.currentPitchFactor, 'triangle');
      gain.gain.setValueAtTime(0, this.ctx!.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, this.ctx!.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.4);
      osc.start();
      osc.stop(this.ctx!.currentTime + 0.5);
      step++;
    }, 400);
  }

  startGameMusic() {
    this.stopMusic();
    this.init();
    let step = 0;
    const sequence = [55, 55, 110, 55, 82, 55, 110, 147];
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = sequence[step % sequence.length];
      const { osc, gain } = this.createOscillator(freq * this.currentPitchFactor, 'square');
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400 * this.currentPitchFactor, now);
      osc.disconnect();
      osc.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start();
      osc.stop(now + 0.25);
      if (step % 2 === 1) {
        const { osc: click, gain: cGain } = this.createOscillator(2000 * this.currentPitchFactor, 'sine');
        cGain.gain.setValueAtTime(0.03, now);
        cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        click.start();
        click.stop(now + 0.05);
      }
      step++;
    }, 200);
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
    const now = this.ctx!.currentTime;
    
    // 1. Digital Zap
    const { osc: o1, gain: g1 } = this.createOscillator(1800 + Math.random() * 200, 'square');
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(0.2, now + 0.002);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    
    // 2. Low "Crush"
    const { osc: o2, gain: g2 } = this.createOscillator(100 + Math.random() * 50, 'sawtooth');
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.15, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    o1.start(now);
    o1.stop(now + 0.15);
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

    o1.start(now);
    o1.stop(now + 0.4);
    o2.start(now);
    o2.stop(now + 0.08);
    noise.start(now);
    noise.stop(now + 0.05);
  }

  /** Victory: A triumphant ascending sequence */
  playWin() {
    this.init();
    const now = this.ctx!.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C Major arpeggio
    
    notes.forEach((freq, i) => {
      const { osc, gain } = this.createOscillator(freq, 'triangle');
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.1, now + i * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.4);
    });

    // Sub hit
    const { osc: low, gain: lGain } = this.createOscillator(60, 'sine');
    lGain.gain.setValueAtTime(0, now);
    lGain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    lGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    low.start(now);
    low.stop(now + 2);
  }

  /** Penalty hit: A buzzy error sound */
  playError() {
    const { osc, gain } = this.createOscillator(110, 'sawtooth');
    const now = this.ctx!.currentTime;
    
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Success/Brackets Closed: Resonant digital chime */
  playSuccess() {
    const frequencies = [440, 554.37, 659.25, 880]; // Major chord sweep
    const now = this.ctx!.currentTime;
    
    frequencies.forEach((f, i) => {
      const { osc, gain } = this.createOscillator(f, 'sine');
      gain.gain.setValueAtTime(0, now + (i * 0.04));
      gain.gain.linearRampToValueAtTime(0.2, now + (i * 0.04) + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (i * 0.04) + 0.6);
      osc.start(now + (i * 0.04));
      osc.stop(now + 0.7);
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
