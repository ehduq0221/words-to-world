// 1차 합치기 임시 어댑터. 독립 기획·미리보기는 이 모듈 없이도 실행됩니다.
// 실제 게임 연결 시 ../game/index.js의 공통 API로 교체하고 삭제합니다.
const initializers = new Map();
const listeners = new Set();
let state = {};
export function registerArea(name, createInitial) {
  if (initializers.has(name)) throw new Error(`이미 등록된 영역: ${name}`);
  initializers.set(name, createInitial);
}
export function getState() { return structuredClone(state); }
export function updateArea(name, updater) {
  if (!(name in state)) throw new Error(`시작되지 않은 영역: ${name}`);
  state = { ...state, [name]: structuredClone(updater(structuredClone(state[name]))) };
  listeners.forEach(listener => listener(getState()));
}
export function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function startGame() {
  state = Object.fromEntries([...initializers].map(([name, createInitial]) => [name, createInitial()]));
  listeners.forEach(listener => listener(getState()));
}
