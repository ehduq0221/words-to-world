export function effectId(event, choice) {
  return `decisions:${event.id}:${choice.id}`;
}
export function resolvedChoice(event, state) {
  return event.choices.find(choice => state.ledger.some(entry => entry.id === effectId(event, choice))) || null;
}
export function activeEvents(events, state, limit) {
  return events.filter(event => !resolvedChoice(event, state)).slice(0, limit);
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
