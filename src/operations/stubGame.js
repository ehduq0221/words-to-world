// 3단계 src/game/index.js가 합쳐지기 전까지 쓰는 임시 구현입니다.
// 공통 약속의 함수 이름과 동작만 흉내 내며, 저장·불러오기는 하지 않습니다.
// 3단계가 합쳐지면 gameApi.js를 '../game/index.js'로 바꾸고 이 파일과 dev.html·dev.js를 삭제합니다.

const factories = new Map();
const listeners = { time: new Set(), settlement: new Set(), settlementEnd: new Set(), change: new Set() };
const appliedIds = new Set();
let state = null;

const emit = (kind, payload) => listeners[kind].forEach(listener => listener(payload));
const listen = kind => listener => {
  listeners[kind].add(listener);
  return () => listeners[kind].delete(listener);
};
const commit = next => {
  state = Object.freeze(next);
  emit('change', state);
};
const semesterOf = ({ year, month }) => (month >= 3 && month <= 8 ? `${year}-1` : month >= 9 ? `${year}-2` : `${year - 1}-2`);

export function registerArea(name, createInitial) {
  if (state) throw new Error('registerArea는 startGame 전에 호출합니다.');
  factories.set(name, createInitial);
}
export const getState = () => state;
export function updateArea(name, updater) {
  if (!factories.has(name)) throw new Error(`'${name}' 영역은 등록되지 않았습니다.`);
  commit({ ...state, [name]: updater(state[name]) });
}
export function applyEffect({ id, budget = 0, satisfaction = 0, reputation = 0, reason = '', source = '' }) {
  if (appliedIds.has(id)) return false;
  appliedIds.add(id);
  const { metrics } = state;
  commit({
    ...state,
    metrics: {
      budget: metrics.budget + Math.round(budget),
      satisfaction: Math.min(100, Math.max(0, metrics.satisfaction + satisfaction)),
      reputation: Math.min(100, Math.max(0, metrics.reputation + reputation)),
    },
    ledger: [...state.ledger, { id, date: state.time.date, semester: state.time.semester, budget: Math.round(budget), satisfaction, reputation, reason, source }],
  });
  return true;
}
export const onTimeAdvance = listen('time');
export const onSettlement = listen('settlement');
export const onSettlementEnd = listen('settlementEnd');
export const subscribe = listen('change');
export const addReaction = reaction => reaction;
export const registerDialogues = () => {};
export async function startGame() {
  const date = { year: 2026, month: 3, day: 2 };
  const next = { time: { date, semester: semesterOf(date) }, metrics: { budget: 10_000_000_000, satisfaction: 60, reputation: 60 }, ledger: [] };
  for (const [name, createInitial] of factories) next[name] = createInitial();
  commit(next);
  return state;
}

// 개발 확인용: 하루씩 진행하고 학기가 바뀌면 정산합니다.
export function devAdvanceDays(count) {
  for (let i = 0; i < count; i++) {
    const { date, semester } = state.time;
    const nextDate = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
    const next = { year: nextDate.getUTCFullYear(), month: nextDate.getUTCMonth() + 1, day: nextDate.getUTCDate() };
    const nextSemester = semesterOf(next);
    if (nextSemester !== semester) {
      emit('settlement', { semester });
      emit('settlementEnd', { semester, budget: state.metrics.budget });
    }
    commit({ ...state, time: { date: next, semester: nextSemester } });
    emit('time', { date: next, semester: nextSemester });
  }
}
