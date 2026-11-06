export function effectId(event, choice) {
  return `decisions:${event.id}:${choice.id}`;
}
export function resolvedChoice(event, state) {
  return event.choices.find(choice => state.ledger.some(entry => entry.id === effectId(event, choice))) || null;
}
export function activeEvents(events, state, limit) {
  const released = state.decisions?.released;
  return events.filter(event => (!Array.isArray(released) || released.includes(event.id)) && !resolvedChoice(event, state)).slice(0, limit);
}
export function decide(event, choiceId, api) {
  if (resolvedChoice(event, api.getState())) return false;
  const choice = event.choices.find(item => item.id === choiceId);
  if (!choice) throw new Error('선택지를 확인해 주세요.');
  if (choice.effect.budget > 0) throw new Error('학생 요청 보상은 만족도와 평판만 변경할 수 있습니다.');
  if (api.getState().metrics.budget + choice.effect.budget < 0) throw new Error('예산이 부족해 실행할 수 없습니다. 다른 선택지를 골라 주세요.');
  return api.applyEffect({ id: effectId(event, choice), ...choice.effect, reason: `${event.title} · ${choice.label}`, source: 'decisions' });
}
export function formatWon(value, signed = false) {
  const abs = Math.abs(value);
  const amount = abs >= 100000000 ? `${Number((abs / 100000000).toFixed(2))}억` : abs >= 10000 ? `${Math.round(abs / 10000).toLocaleString('ko-KR')}만` : abs.toLocaleString('ko-KR');
  return `${value < 0 ? '−' : signed && value > 0 ? '+' : ''}${amount}`;
}
export function effectText(entry) {
  return [['budget', '예산'], ['satisfaction', '만족도'], ['reputation', '평판']].filter(([key]) => entry[key]).map(([key, label]) => `${label} ${key === 'budget' ? formatWon(entry[key], true) : (entry[key] > 0 ? '+' : '') + entry[key]}`).join(' · ') || '지표 변화 없음';
}

// 다음 발생일과 공개한 ID를 저장해 새로고침으로 다시 추첨하지 않습니다.
function nextDay(day, schedule, random) {
  return day + schedule.minDays + Math.floor(random() * (schedule.maxDays - schedule.minDays + 1));
}
function unreleased(events, state, released) {
  return events.filter(event => !released.includes(event.id) && !resolvedChoice(event, state));
}
export function initializeSchedule(events, state, limit, schedule, random = Math.random) {
  const area = state.decisions;
  if (Array.isArray(area.released)) return null;
  // 기존 저장에서 열어 둔 요청은 우선 유지하고 상한을 넘는 항목은 이후에 공개합니다.
  const pending = events.filter(event => area.opened.includes(event.id) && !resolvedChoice(event, state)).slice(0, limit);
  const released = pending.map(event => event.id);
  while (released.length < Math.min(limit, schedule.initialCount)) {
    const pool = unreleased(events, state, released);
    if (!pool.length) break;
    released.push(pool[Math.floor(random() * pool.length)].id);
  }
  return { ...area, released, nextEventDay: unreleased(events, state, released).length ? nextDay(state.time.dayCount, schedule, random) : null };
}
export function releaseDueEvent(events, state, limit, schedule, random = Math.random) {
  const area = state.decisions;
  if (!Array.isArray(area.released) || area.nextEventDay === null || state.time.dayCount < area.nextEventDay) return null;
  const pool = unreleased(events, state, area.released);
  const released = [...area.released];
  if (pool.length && activeEvents(events, state, limit).length < limit) released.push(pool[Math.floor(random() * pool.length)].id);
  // 상한에 도달하면 일정을 미뤄 요청 처리 직후 연달아 발생하지 않게 합니다.
  return { ...area, released, nextEventDay: unreleased(events, state, released).length ? nextDay(state.time.dayCount, schedule, random) : null };
}
