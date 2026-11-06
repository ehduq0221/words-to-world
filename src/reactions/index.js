// 5단계 학생 반응과 민원 대사
// - 민원: public/data/reactions.json의 조건을 게임 상태에 비춰 보고, 새로 생기거나 오래 지속되거나 해결된 민원을 학생 반응으로 남깁니다.
// - 대사: 각 기능이 registerDialogues로 등록한 대사 중 상황에 맞는 것을 고르고 빈칸을 채웁니다. 외부 AI API는 쓰지 않습니다.
// - 다른 기능은 src/game/index.js의 addReaction·registerDialogues로 이 기능을 사용합니다.
//   3단계가 합쳐지면 src/game/index.js의 두 export가 이 파일을 가리키도록 바꿉니다.

import { registerArea, getState, updateArea, onTimeAdvance, subscribe } from './gameApi.js';
import { createInitialArea, addToArea, updateIssues, getPath, calendarEvents } from './engine.js';
import { renderReactionPanel } from './panel.js';

const AREA = 'reactions';
const lines = [];
let config = null;
let watched = null;

export async function loadReactionsConfig(url = new URL('../../public/data/reactions.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('학생 반응 설정(reactions.json)을 불러올 수 없습니다.');
  const data = await response.json();
  const rulesValid = Array.isArray(data.rules) && data.rules.every(rule =>
    rule.id && rule.type && (rule.each || rule.path) && Array.isArray(rule.when) && rule.when.length > 0);
  if (!rulesValid || !data.personas?.surnames?.length || !data.personas?.majors?.length || !(data.checkEveryDays > 0)) {
    throw new Error('학생 반응 설정(reactions.json)의 형식이 올바르지 않습니다.');
  }
  return data;
}

async function loadLines(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`대사 데이터(${url})를 불러올 수 없습니다.`);
  return response.json();
}

export function registerDialogues(newLines) {
  if (!Array.isArray(newLines)) throw new TypeError('registerDialogues: 대사 배열이 필요합니다.');
  for (const line of newLines) {
    if (!line || typeof line.type !== 'string' || typeof line.text !== 'string') {
      throw new TypeError('registerDialogues: 각 대사에는 type과 text가 필요합니다.');
    }
    lines.push({ ...line, id: line.id ?? `${line.type}#${lines.length}` });
  }
}

// 다른 기능이 상황에 맞는 학생 반응을 남길 때 씁니다. 예: 축제 후 반응
export function addReaction({ type, buildingId = null, cause = '', values = {} } = {}) {
  const state = getState();
  if (!state) throw new Error('addReaction: startGame() 이후에 호출해야 합니다.');
  if (typeof type !== 'string' || type === '') throw new TypeError('addReaction: type이 필요합니다.');
  if (!config) return null;
  let reaction = null;
  updateArea(AREA, area => {
    const result = addToArea(area, config, lines, { type, buildingId, cause, values, date: state.time.date });
    reaction = result.reaction;
    return result.area;
  });
  return reaction;
}

function checkIssues() {
  const state = getState();
  if (!config || !state?.[AREA]) return;
  updateArea(AREA, area => updateIssues(area, config, lines, state, state.time.date).area);
}

// 조건이 읽는 값이 바뀌었는지 확인합니다. 운영 결정 직후 민원이 바로 생기거나 해결되도록 합니다.
function watchedValues(state) {
  return config.rules.map(rule => getPath(state, rule.each ?? rule.path));
}

function changed(values) {
  if (!watched || watched.length !== values.length) return true;
  return values.some((value, index) => value !== watched[index]);
}

// src/main.js에서 startGame() 전에 호출합니다.
export function initReactions() {
  registerArea(AREA, createInitialArea);
  onTimeAdvance(({ date }) => {
    if (!config || !getState()?.[AREA]) return;
    updateArea(AREA, area => {
      let next = { ...area, dayCount: area.dayCount + 1 };
      for (const event of calendarEvents(config, date)) {
        next = addToArea(next, config, lines, { type: event.type, kind: 'event', buildingId: event.buildingId ?? null, cause: event.cause, priority: event.label ?? '', values: event.values ?? {}, persona: event.persona ?? null, date }).area;
      }
      return next;
    });
    if (getState()[AREA].dayCount % config.checkEveryDays === 0) checkIssues();
  });
  subscribe(state => {
    if (!config || !state?.[AREA]) return;
    const values = watchedValues(state);
    if (changed(values)) {
      watched = values;
      checkIssues();
      return;
    }
    renderReactionPanel(state[AREA], config);
  });
  return Promise.all([
    loadReactionsConfig(),
    loadLines(new URL('../../public/data/dialogues/reactions.json', import.meta.url)),
  ]).then(([loadedConfig, ownLines]) => {
    config = loadedConfig;
    registerDialogues(ownLines);
    if (getState()?.[AREA]) {
      watched = watchedValues(getState());
      checkIssues();
    }
    return config;
  });
}
