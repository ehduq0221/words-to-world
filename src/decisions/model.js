// 즉시 조치 안건 계산. 화면이나 게임 상태에 의존하지 않는 순수 함수만 둡니다.
// area는 게임 상태의 decisions 영역, data는 public/data/decisions.json입니다.
// 안건 상태: open(결정 대기) → scheduled(조치 예정, 다음 날 반영) → done(조치 완료)

export function createInitialArea(data) {
  const first = data.events.slice(0, data.initialCount);
  return {
    version: 2,
    seed: data.seed >>> 0,
    dayCount: 0,
    nextNumber: first.length + 1,
    issues: first.map((event, index) => ({ key: `${event.id}#${index + 1}`, eventId: event.id, status: 'open', opened: false, since: null })),
    lastSeen: {},
  };
}

export function effectId(issue, choice) {
  return `decisions:${issue.key}:${choice.id}`;
}

export const findEvent = (data, issue) => data.events.find(event => event.id === issue.eventId);
export const findChoice = (event, choiceId) => event.choices.find(choice => choice.id === choiceId) ?? null;

// 건물 위 !로 보여 줄 결정 대기 안건
export function markerIssues(area, limit) {
  return area.issues.filter(issue => issue.status === 'open').slice(0, limit);
}

// 이미 조치 예정인 지출을 뺀, 결정에 쓸 수 있는 예산
export function availableBudget(area, data, budget) {
  const pending = area.issues
    .filter(issue => issue.status === 'scheduled')
    .reduce((sum, issue) => sum + Math.min(0, findChoice(findEvent(data, issue), issue.choiceId).effect.budget), 0);
  return budget + pending;
}

// 조치를 결정합니다. 효과는 다음 날 반영되므로 여기서는 예정으로만 기록합니다.
export function schedule(area, data, issueKey, choiceId, { date, budget }) {
  const issue = area.issues.find(item => item.key === issueKey);
  if (!issue || issue.status !== 'open') return { area, error: null, changed: false };
  const choice = findChoice(findEvent(data, issue), choiceId);
  if (!choice) throw new Error('조치를 확인해 주세요.');
  if (availableBudget(area, data, budget) + choice.effect.budget < 0) {
    return { area, error: '예산이 부족해 이 조치를 할 수 없어요. 다른 조치를 골라 주세요.', changed: false };
  }
  const issues = area.issues.map(item => (item.key === issueKey
    ? { ...item, status: 'scheduled', choiceId, decidedOn: date, decidedDay: area.dayCount, failed: null }
    : item));
  return { area: { ...area, issues }, error: null, changed: true };
}

// 결정한 날이 지난 조치 예정 안건
export function dueIssues(area) {
  return area.issues.filter(issue => issue.status === 'scheduled' && issue.decidedDay < area.dayCount);
}

export function markDone(area, issueKey, date) {
  return {
    ...area,
    issues: area.issues.map(item => (item.key === issueKey ? { ...item, status: 'done', appliedOn: date } : item)),
    lastSeen: { ...area.lastSeen, [area.issues.find(item => item.key === issueKey).eventId]: area.dayCount },
  };
}

// 반영하지 못한 조치(예: 그사이 예산 부족)는 다시 결정 대기로 돌립니다.
export function markFailed(area, issueKey, message) {
  return {
    ...area,
    issues: area.issues.map(item => (item.key === issueKey ? { ...item, status: 'open', choiceId: null, failed: message } : item)),
  };
}

// 재현 가능한 난수(mulberry32). 상태에 seed를 저장해 불러온 뒤에도 같은 흐름이 이어집니다.
export function random(seed) {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

// 하루에 한 번, 정해진 확률로 새 안건이 생깁니다. 같은 안건은 진행 중이 아니고, 마지막 조치 후 cooldownDays가 지나야 다시 생깁니다.
export function spawn(area, data, date) {
  const open = area.issues.filter(issue => issue.status !== 'done').length;
  let { value, seed } = random(area.seed);
  if (open >= data.activeLimit || value >= data.spawnChance) return { ...area, seed };
  const active = new Set(area.issues.filter(issue => issue.status !== 'done').map(issue => issue.eventId));
  const candidates = data.events.filter(event => !active.has(event.id) &&
    (area.lastSeen[event.id] === undefined || area.dayCount - area.lastSeen[event.id] >= data.cooldownDays));
  if (!candidates.length) return { ...area, seed };
  ({ value, seed } = random(seed));
  const event = candidates[Math.floor(value * candidates.length)];
  const issue = { key: `${event.id}#${area.nextNumber}`, eventId: event.id, status: 'open', opened: false, since: date };
  // 조치를 마친 안건은 최근 기록만 남겨 상태가 끝없이 커지지 않게 합니다.
  const done = area.issues.filter(item => item.status === 'done').slice(-data.keepDone);
  const rest = area.issues.filter(item => item.status !== 'done');
  return { ...area, seed, nextNumber: area.nextNumber + 1, issues: [...done, ...rest, issue] };
}

export function formatWon(value, signed = false) {
  const abs = Math.abs(value);
  const amount = abs >= 100000000 ? `${Number((abs / 100000000).toFixed(2))}억` : abs >= 10000 ? `${Math.round(abs / 10000).toLocaleString('ko-KR')}만` : abs.toLocaleString('ko-KR');
  return `${value < 0 ? '−' : signed && value > 0 ? '+' : ''}${amount}`;
}

export function effectText(entry) {
  return [['budget', '예산'], ['satisfaction', '만족도'], ['reputation', '평판']]
    .filter(([key]) => entry[key])
    .map(([key, label]) => `${label} ${key === 'budget' ? formatWon(entry[key], true) : (entry[key] > 0 ? '+' : '') + entry[key]}`)
    .join(' · ') || '지표 변화 없음';
}

export const formatDate = ({ month, day }) => `${month}월 ${day}일`;

export function nextDate({ year, month, day }) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}
