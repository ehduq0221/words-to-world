// 3단계 게임 모듈 연결 전의 로컬 이벤트 확인용 공통 API입니다.
// 게임 전체 저장 키와 분리하여 기존 작업의 저장 데이터를 덮어쓰지 않습니다.
const KEY = 'words-to-world:decisions-preview';
const factories = new Map();
const listeners = new Set();
let state = null;
const copy = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function commit(next) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, state: next }));
  state = freeze(next);
  listeners.forEach(listener => listener(state));
}
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
  if (!state || !id || ![budget, satisfaction, reputation].every(Number.isFinite)) throw new Error('이벤트 효과가 올바르지 않습니다.');
  if (state.ledger.some(entry => entry.id === id)) return false;
  const nextBudget = state.metrics.budget + Math.round(budget);
  if (nextBudget < 0) throw new Error('예산이 부족해 실행할 수 없습니다. 다른 선택지를 골라 주세요.');
  const clamp = value => Math.max(0, Math.min(100, value));
  const metrics = { budget: nextBudget, satisfaction: clamp(state.metrics.satisfaction + satisfaction), reputation: clamp(state.metrics.reputation + reputation) };
  const actual = Object.fromEntries(Object.keys(metrics).map(key => [key, metrics[key] - state.metrics[key]]));
  commit({ ...state, metrics, ledger: [...state.ledger, { id, ...actual, reason, source }] });
  return true;
}
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function startGame() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
  } catch { saved = null; }
  const s = saved?.state;
  const valid = saved?.version === 1 && s?.metrics && Number.isSafeInteger(s.metrics.budget) && s.metrics.budget >= 0 &&
    ['satisfaction', 'reputation'].every(key => Number.isFinite(s.metrics[key]) && s.metrics[key] >= 0 && s.metrics[key] <= 100) &&
    Array.isArray(s.ledger) && s.ledger.every(entry => typeof entry.id === 'string' && ['budget', 'satisfaction', 'reputation'].every(key => Number.isFinite(entry[key]))) &&
    Array.isArray(s.decisions?.opened) && s.decisions.opened.every(id => typeof id === 'string');
  const initial = { metrics: { budget: 1280000000, satisfaction: 76, reputation: 68 }, ledger: [] };
  for (const [name, factory] of factories) initial[name] = factory();
  state = freeze(valid ? s : initial);
  listeners.forEach(listener => listener(state));
  return state;
}
