// Web Audio로 직접 합성한 짧은 배경 패턴. 외부 음원·샘플 사용 없음.
export function createFestivalAudio() {
  let context, timer, step = 0, genre = 'indie', enabled = false;
  const patterns = { indie: [261.63, 329.63, 392, 493.88, 440, 392, 329.63, 293.66], idol: [523.25, 659.25, 783.99, 659.25, 587.33, 783.99, 880, 783.99], hiphop: [65.41, 0, 65.41, 98, 0, 73.42, 65.41, 0] };
  function tick() {
    if (!context || !enabled || context.state !== 'running') return;
    const frequency = patterns[genre][step++ % 8];
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
      if (!timer) timer = setInterval(tick, 230);
    },
    setGenre(value) { genre = value; step = 0; },
    pause() { if (context) context.suspend(); },
    resume() { if (enabled && context) context.resume(); },
    dispose() { clearInterval(timer); if (context) context.close(); },
  };
}
