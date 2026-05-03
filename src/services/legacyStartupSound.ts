/**
 * Original "Rising Scan" startup sound
 */
export const legacyStartupSound = (ctx: AudioContext, masterVolume: GainNode) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 1.2);
  
  osc.connect(gain);
  gain.connect(masterVolume);
  
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.2);
};
