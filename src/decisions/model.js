// 즉시 조치 안건 계산(IMPLEMENTATION_PLAN.md 공통 약속 「총장 결정」의 즉시 조치).
// - 안건은 게임 10~20일 무작위 간격으로 하나씩 공개되고, 동시에 최대 activeLimit개입니다.
// - 총장이 조치를 결정하면 「조치 예정」(scheduled)으로 기록하고, 효과는 다음 날 applyDue에서 반영합니다.
// - 조치를 마친 안건은 cooldownDays가 지나면 다시 공개될 수 있으며, 그때 회차(round)가 올라갑니다.

const roundOf = (event, state) => state.decisions?.rounds?.[event.id] ?? 0;

// 첫 회차는 기존 저장과 맞도록 decisions:<안건>:<조치>, 이후 회차는 decisions:<안건>#<회차>:<조치>입니다.
export function effectId(event, choice, round = 0) {
  return round ? `decisions:${event.id}#${round + 1}:${choice.id}` : `decisions:${event.id}:${choice.id}`;
}
export function eventIdOf(entryId) {
  return /^decisions:([^:#]+)/.exec(entryId)?.[1] ?? null;
}
export function resolvedChoice(event, state) {
  const round = roundOf(event, state);
  return event.choices.find(choice => state.ledger.some(entry => entry.id === effectId(event, choice, round))) || null;
}
export function scheduledChoice(event, state) {
  const item = state.decisions?.scheduled?.find(entry => entry.eventId === event.id);
  return item ? { ...item, choice: event.choices.find(choice => choice.id === item.choiceId) } : null;
}
// 공개됐고 아직 반영되지 않은 안건(결정 대기 + 조치 예정). 동시 상한에 포함됩니다.
export function activeEvents(events, state, limit) {
  const released = state.decisions?.released;
  return events.filter(event => (!Array.isArray(released) || released.includes(event.id)) && !resolvedChoice(event, state)).slice(0, limit);
}
// 건물 위 !로 보여 줄 결정 대기 안건
export function waitingEvents(events, state, limit) {
  return activeEvents(events, state, limit).filter(event => !scheduledChoice(event, state));
}

// 이미 조치 예정인 지출을 뺀, 결정에 쓸 수 있는 예산
export function availableBudget(events, state) {
  const pending = (state.decisions?.scheduled ?? []).reduce((sum, item) => {
    const event = events.find(entry => entry.id === item.eventId);
    const choice = event?.choices.find(entry => entry.id === item.choiceId);
    return sum + Math.min(0, choice?.effect.budget ?? 0);
  }, 0);
  return state.metrics.budget + pending;
}

// 조치를 결정합니다. 오늘은 예정으로만 기록하고, 효과는 다음 날 반영합니다.
export function decide(event, choiceId, api, events = [event]) {
  const state = api.getState();
  if (resolvedChoice(event, state) || scheduledChoice(event, state)) return false;
  const choice = event.choices.find(item => item.id === choiceId);
  if (!choice) throw new Error('조치를 확인해 주세요.');
  if (choice.effect.budget > 0) throw new Error('즉시 조치로는 예산을 늘릴 수 없고 만족도와 평판만 바뀝니다.');
  if (availableBudget(events, state) + choice.effect.budget < 0) throw new Error('예산이 부족해 이 조치를 할 수 없어요. 다른 조치를 골라 주세요.');
  api.updateArea('decisions', area => ({
    ...area,
    scheduled: [...(area.scheduled ?? []), { eventId: event.id, choiceId, decidedDay: state.time.dayCount, decidedOn: state.time.date }],
    failed: Object.fromEntries(Object.entries(area.failed ?? {}).filter(([id]) => id !== event.id)),
  }));
  return true;
}

// 결정한 날이 지난 조치를 반영합니다. 반영한 조치 목록을 돌려줍니다.
// 그사이 예산이 부족해지면 반영하지 않고 안건을 결정 대기로 돌립니다.
export function applyDue(events, api) {
  const state = api.getState();
  const due = (state.decisions?.scheduled ?? []).filter(item => item.decidedDay < state.time.dayCount);
  const applied = [];
  for (const item of due) {
    const event = events.find(entry => entry.id === item.eventId);
    const choice = event?.choices.find(entry => entry.id === item.choiceId);
    const remove = area => ({ ...area, scheduled: (area.scheduled ?? []).filter(entry => entry.eventId !== item.eventId) });
    if (!event || !choice) {
      api.updateArea('decisions', remove);
      continue;
    }
    if (api.getState().metrics.budget + choice.effect.budget < 0) {
      api.updateArea('decisions', area => ({ ...remove(area), failed: { ...(area.failed ?? {}), [event.id]: `예산이 부족해 「${choice.label}」 조치를 반영하지 못했어요. 다른 조치를 골라 주세요.` } }));
      continue;
    }
    api.applyEffect({ id: effectId(event, choice, roundOf(event, api.getState())), ...choice.effect, reason: `${event.title} · ${choice.label}`, source: 'decisions' });
    api.updateArea('decisions', area => ({ ...remove(area), lastDone: { ...(area.lastDone ?? {}), [event.id]: state.time.dayCount } }));
    applied.push({ event, choice });
  }
  return applied;
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
// 새로 공개할 수 있는 안건: 아직 공개하지 않은 안건, 또는 조치를 마치고 cooldownDays가 지난 안건
function releasable(events, state, released, schedule) {
  const lastDone = state.decisions?.lastDone ?? {};
  return events.filter(event => {
    if (!released.includes(event.id)) return !resolvedChoice(event, state);
    return Boolean(resolvedChoice(event, state)) && lastDone[event.id] !== undefined &&
      state.time.dayCount - lastDone[event.id] >= (schedule.cooldownDays ?? Infinity);
  });
}
function hasFuture(events, state, released, schedule) {
  return releasable(events, state, released, schedule).length > 0 || Number.isFinite(schedule.cooldownDays ?? Infinity);
}
export function initializeSchedule(events, state, limit, schedule, random = Math.random) {
  const area = state.decisions;
  if (Array.isArray(area.released)) {
    const missing = area.released.filter(id => !Object.hasOwn(area.releasedOn ?? {}, id));
    return missing.length ? { ...area, releasedOn: { ...(area.releasedOn ?? {}), ...Object.fromEntries(missing.map(id => [id, state.time.dayCount])) } } : null;
  }
  // 기존 저장에서 열어 둔 안건은 우선 유지하고 상한을 넘는 항목은 이후에 공개합니다.
  const pending = events.filter(event => area.opened.includes(event.id) && !resolvedChoice(event, state)).slice(0, limit);
  const released = pending.map(event => event.id);
  while (released.length < Math.min(limit, schedule.initialCount)) {
    const pool = releasable(events, state, released, schedule).filter(event => !released.includes(event.id));
    if (!pool.length) break;
    released.push(pool[Math.floor(random() * pool.length)].id);
  }
  return { ...area, released, releasedOn: Object.fromEntries(released.map(id => [id, state.time.dayCount])), nextEventDay: hasFuture(events, state, released, schedule) ? nextDay(state.time.dayCount, schedule, random) : null };
}
export function releaseDueEvent(events, state, limit, schedule, random = Math.random) {
  const area = state.decisions;
  if (!Array.isArray(area.released) || area.nextEventDay === null || state.time.dayCount < area.nextEventDay) return null;
  const pool = releasable(events, state, area.released, schedule);
  let next = { ...area, released: [...area.released] };
  if (pool.length && activeEvents(events, state, limit).length < limit) {
    const event = pool[Math.floor(random() * pool.length)];
    next.releasedOn = { ...(area.releasedOn ?? {}), [event.id]: state.time.dayCount };
    if (next.released.includes(event.id)) {
      // 다시 생긴 안건: 회차를 올리고 지난 카드를 목록에서 내립니다.
      next = { ...next, rounds: { ...(area.rounds ?? {}), [event.id]: roundOf(event, state) + 1 }, opened: area.opened.filter(id => id !== event.id) };
    } else {
      next.released.push(event.id);
    }
  }
  // 상한에 도달하면 일정을 미뤄 조치 직후 연달아 발생하지 않게 합니다.
  return { ...next, nextEventDay: hasFuture(events, state, next.released, schedule) ? nextDay(state.time.dayCount, schedule, random) : null };
}
