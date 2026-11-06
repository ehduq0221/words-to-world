// 체험 안에서만 쓰는 판정입니다. 학교 지표·저장 상태와 연결하지 않습니다.
export function judgeBeat(elapsedMs, tempo) {
  const duration = 60000 / tempo;
  const phase = ((elapsedMs % duration) + duration) % duration / duration;
  const distance = Math.abs(phase - .5);
  return { phase, rating: distance <= .1 ? 'PERFECT' : distance <= .22 ? 'GOOD' : 'MISS' };
}

// 초보자가 따라갈 수 있도록 세 박자에 한 번, 약 1.3~2.1초 주기로 흔듭니다.
export function judgeLightstick(elapsedMs, artistTempo) {
  const tempo = Math.max(28, Math.min(45, Math.round(artistTempo / 3)));
  const beat = judgeBeat(elapsedMs, tempo);
  const distance = Math.abs(beat.phase - .5);
  return { ...beat, duration: 60000 / tempo, rating: distance <= .14 ? 'PERFECT' : distance <= .29 ? 'GOOD' : 'MISS' };
}
