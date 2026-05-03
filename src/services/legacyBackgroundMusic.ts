/** 
 * LEGACY BACKGROUND MUSIC PRESET
 * Saved for future use as requested by user.
 */

/*
startGameMusic() {
    this.init();
    if (!this.ctx || this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    const now = this.ctx.currentTime;
    
    // Smooth looping bass/pad
    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'triangle';
    this.musicOsc.frequency.setValueAtTime(55, now); // A1
    
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(0, now);
    this.musicGain.gain.linearRampToValueAtTime(0.12, now + 2);
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    
    this.musicOsc.connect(filter);
    filter.connect(this.musicGain);
    this.musicGain.connect(this.masterVolume!);
    
    this.musicOsc.start(now);
}
*/

export const legacyMusic = (ctx: AudioContext, masterVolume: GainNode) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(55, now);
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 2);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterVolume);
    
    osc.start(now);
    return { osc, gain };
};
