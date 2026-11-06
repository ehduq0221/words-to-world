// 3단계 게임 모듈 연결 전, 메인 화면에서 즉시 조치를 확인하기 위한 임시 공통 API입니다.
// 게임 전체 저장 키와 분리하여 기존 작업의 저장 데이터를 덮어쓰지 않습니다.
// 공통 약속의 함수에 더해 임시 날짜 진행(advanceDay)을 둡니다. 3단계가 합쳐지면 3단계의 시간 진행으로 바꾸고 이 파일을 삭제합니다.
const KEY = 'words-to-world:decisions-preview';
const VERSION = 2;
const START_DATE = { year: 2026, month: 3, day: 2 };
const factories = new Map();
const listeners = { change: new Set(), time: new Set() };
let state = null;
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const semesterOf = ({ year, month }) => (month >= 3 && month <= 8 ? `${year}-1` : month >= 9 ? `${year}-2` : `${year - 1}-2`);
function commit(next) {
  localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state: next }));
  state = freeze(next);
  listeners.change.forEach(listener => listener(state));
}
const listen = kind => listener => {
  listeners[kind].add(listener);
  return () => listeners[kind].delete(listener);
};
export function registerArea(name, createInitial) {
  if (state) throw new Error('게임 시작 전에 영역을 등록해 주세요.');
  factories.set(name, createInitial);
}
export const getState = () => state;
export function updateArea(name, updater) {
  if (!factories.has(name) || !state) throw new Error('등록된 상태 영역이 필요합니다.');
  commit({ ...state, [name]: updater(copy(state[name])) });
}
export function applyEffect({ id, budget = 0, satisfaction = 0, reputation = 0, reason = '', source = '' }) {
  if (!state || !id || ![budget, satisfaction, reputation].every(Number.isFinite)) throw new Error('조치 효과가 올바르지 않습니다.');
  if (state.ledger.some(entry => entry.id === id)) return false;
  const nextBudget = state.metrics.budget + Math.round(budget);
  if (nextBudget < 0) throw new Error('예산이 부족해 조치를 반영하지 못했어요.');
  const clamp = value => Math.max(0, Math.min(100, value));
  const metrics = { budget: nextBudget, satisfaction: clamp(state.metrics.satisfaction + satisfaction), reputation: clamp(state.metrics.reputation + reputation) };
  const actual = Object.fromEntries(Object.keys(metrics).map(key => [key, metrics[key] - state.metrics[key]]));
  commit({ ...state, metrics, ledger: [...state.ledger, { id, date: state.time.date, ...actual, reason, source }] });
  return true;
}
export const subscribe = listen('change');
export const onTimeAdvance = listen('time');
export const onSettlement = () => () => {};
export const onSettlementEnd = () => () => {};
// 5단계 학생 반응은 아직 메인에 연결되지 않아 기록하지 않습니다.
export const addReaction = () => null;
export const registerDialogues = () => {};
export function startGame() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
  } catch { saved = null; }
  const s = saved?.state;
  const valid = saved?.version === VERSION && s?.metrics && Number.isSafeInteger(s.metrics.budget) && s.metrics.budget >= 0 &&
    ['satisfaction', 'reputation'].every(key => Number.isFinite(s.metrics[key]) && s.metrics[key] >= 0 && s.metrics[key] <= 100) &&
    s.time?.date && Number.isInteger(s.time.date.year) &&
    Array.isArray(s.ledger) && s.ledger.every(entry => typeof entry.id === 'string' && ['budget', 'satisfaction', 'reputation'].every(key => Number.isFinite(entry[key]))) &&
    Array.isArray(s.decisions?.issues);
  const initial = { time: { date: START_DATE, semester: semesterOf(START_DATE) }, metrics: { budget: 1280000000, satisfaction: 76, reputation: 68 }, ledger: [] };
  for (const [name, factory] of factories) initial[name] = factory();
  state = freeze(valid ? s : initial);
  listeners.change.forEach(listener => listener(state));
  return state;
}
// 임시 날짜 진행: 하루를 넘기고 onTimeAdvance 리스너를 부릅니다.
export function advanceDay() {
  const { year, month, day } = state.time.date;
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const date = { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
  commit({ ...state, time: { date, semester: semesterOf(date) } });
  listeners.time.forEach(listener => listener({ date, semester: state.time.semester }));
}
