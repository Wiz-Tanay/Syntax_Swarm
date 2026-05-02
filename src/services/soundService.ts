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

  private init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterVolume = this.ctx.createGain();
    this.masterVolume.connect(this.ctx.destination);
    this.masterVolume.gain.value = 0.3; // Global volume
  }

  setVolume(value: number) {
    this.init();
    if (this.masterVolume) {
      this.masterVolume.gain.setTargetAtTime(value, this.ctx!.currentTime, 0.1);
    }
  }

  private createOscillator(freq: number, type: OscillatorType = 'sine'): { osc: OscillatorNode; gain: GainNode } {
    this.init();
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
    osc.connect(gain);
    gain.connect(this.masterVolume!);
    return { osc, gain };
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
    g1.gain.setValueAtTime(0.5, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    // Tech click
    const { osc: o2, gain: g2 } = this.createOscillator(3000, 'sine');
    g2.gain.setValueAtTime(0.2, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    o1.start(now);
    o1.stop(now + 0.3);
    o2.start(now);
    o2.stop(now + 0.05);
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
    const { osc: lowOsc, gain: lowGain } = this.createOscillator(60, 'sine');
    lowOsc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
    lowGain.gain.setValueAtTime(1.0, now);
    lowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    lowOsc.start(now);
    lowOsc.stop(now + 0.8);

    // 2. Mid Thump
    const { osc: midOsc, gain: midGain } = this.createOscillator(150, 'sawtooth');
    midGain.gain.setValueAtTime(0.4, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    midOsc.start(now);
    midOsc.stop(now + 0.4);

    // 3. High Shatter/Noise
    const bufferSize = this.ctx!.sampleRate * 0.8;
    const buffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx!.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx!.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.7);

    const gain = this.ctx!.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

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
