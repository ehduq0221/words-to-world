import { getArtistProfile } from './profiles.js';
// Web Audio로 직접 합성한 짧은 배경 패턴. 외부 음원·샘플 사용 없음.
export function createFestivalAudio() {
  let context, timer, step = 0, genre = 'indie', enabled = false, profile, lastNote = 0;
  const patterns = { indie: [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66], idol: [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880, 783.99], hiphop: [65.41, 0, 65.41, 98, 0, 73.42, 65.41, 0] };
  function tick() {
    if (!context || !enabled || context.state !== 'running') return;
    const now = performance.now();
    if (now - lastNote < 60000 / (profile?.tempo || 120) / 2) return;
    lastNote = now;
    const frequency = (profile?.notes || patterns[genre])[step++ % 8];
    if (!frequency) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = genre === 'indie' ? 'sine' : genre === 'idol' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    if (genre === 'hiphop') oscillator.frequency.exponentialRampToValueAtTime(35, context.currentTime + .15);
    gain.gain.setValueAtTime(.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(genre === 'hiphop' ? .12 : .035, context.currentTime + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + (genre === 'indie' ? .65 : .2));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + .7);
  }
  return {
    async enable(value) {
      enabled = value;
      if (!value) { if (context) await context.suspend(); return; }
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('이 브라우저는 배경음 합성을 지원하지 않습니다.');
      context ||= new Audio();
      await context.resume();
      if (!timer) timer = setInterval(tick, 40);
    },
    firework() {
      if (!enabled || !context || context.state !== 'running') return;
      const buffer = context.createBuffer(1, context.sampleRate * .6, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (samples.length * .12));
      for (let shot = 0; shot < 7; shot++) {
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; gain.gain.value = .1; source.connect(gain).connect(context.destination); source.start(context.currentTime + .75 + shot * .42);
        const at = context.currentTime + .75 + shot * .42;
        const boom = context.createOscillator(), lowGain = context.createGain();
        boom.frequency.setValueAtTime(105, at); boom.frequency.exponentialRampToValueAtTime(28, at + .65);
        lowGain.gain.setValueAtTime(.12, at); lowGain.gain.exponentialRampToValueAtTime(.0001, at + 1.2);
        boom.connect(lowGain).connect(context.destination); boom.start(at); boom.stop(at + 1.3);
      }
    },
    setArtist(artist) { profile = getArtistProfile(artist); genre = artist.genre; step = 0; lastNote = 0; },
    cheer() {
      if (!enabled || !context || context.state !== 'running') return;
      const osc = context.createOscillator(), gain = context.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(220, context.currentTime); osc.frequency.linearRampToValueAtTime(440, context.currentTime + .2);
      gain.gain.setValueAtTime(.025, context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .7);
      osc.connect(gain).connect(context.destination); osc.start(); osc.stop(context.currentTime + .8);
    },
    setGenre(value) { genre = value; step = 0; },
    pause() { if (context) context.suspend(); },
    resume() { if (enabled && context) context.resume(); },
    dispose() { clearInterval(timer); if (context) context.close(); },
  };
}
