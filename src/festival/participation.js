// 체험 안에서만 쓰는 판정입니다. 학교 지표·저장 상태와 연결하지 않습니다.
export function judgeBeat(elapsedMs, tempo) {
  const duration = 60000 / tempo;
  const phase = ((elapsedMs % duration) + duration) % duration / duration;
  const distance = Math.abs(phase - .5);
  return { phase, rating: distance <= .1 ? 'PERFECT' : distance <= .22 ? 'GOOD' : 'MISS' };
}
