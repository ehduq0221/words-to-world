export function buildTimeline(teamCount) {
  if (!Number.isInteger(teamCount) || teamCount < 1 || teamCount > 3) throw new Error('라인업은 1~3팀이어야 합니다.');
  const segments = [{ kind: 'setup', start: 0, end: 4, index: 0 }];
  const fireworkTimes = { opening: 4 };
  let time = 4;
  for (let index = 0; index < teamCount; index++) {
    segments.push({ kind: 'performance', start: time, end: time + 16, index }); time += 16;
    if (index < teamCount - 1) {
      fireworkTimes[`between-${index + 1}-${index + 2}`] = time + .2;
      segments.push({ kind: 'intermission', start: time, end: time + 3, index }); time += 3;
    }
  }
  fireworkTimes.finale = time + .2;
  segments.push({ kind: 'finale', start: time, end: time + 8, index: teamCount - 1 });
  return { segments, fireworkTimes, length: time + 8 };
}
