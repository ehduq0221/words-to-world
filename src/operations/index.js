// 4단계 편의시설·기숙사 운영
// - 편의시설: 직접 운영(매출−운영비) 또는 임대(임대료). 방식을 바꾸면 계약 변경 비용이 듭니다.
// - 기숙사: 기숙사비 수준과 기숙사별 운영 비율을 정합니다. 열어 둔 방은 비어 있어도 유지비가 듭니다.
// - 등록금: 학기 정산 때 등록 학생 수 × 1인 등록금을 받습니다.
// 수입·지출은 하루씩 쌓았다가 학기 정산(onSettlement) 때 applyEffect로 반영합니다.

import { registerArea, getState, updateArea, applyEffect, onTimeAdvance, onSettlement, subscribe } from './gameApi.js';
import { createInitialArea, accrueDay, settle, facilityMode, normalizeData, summarize, isDecisionLocked, markDecided, dateKey, facilityResult, dormResult, feeLevelKey, openRate, scores } from './model.js';
import { renderOperationsMenu, formatWon } from './menu.js';
import { confirmDecision } from './confirm.js';

const AREA = 'operations';
let data = null;
let selectedBuildingId = null;

// 운영 영역을 바꿀 때는 항상 이 함수를 써서 다른 기능이 읽는 summary를 함께 갱신합니다.
function update(updater) {
  updateArea(AREA, current => {
    const next = updater(current);
    return { ...next, summary: summarize(next, data) };
  });
}

export async function loadOperationsData(url = new URL('../../public/data/operations.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('운영 데이터(operations.json)를 불러올 수 없습니다.');
  const raw = await response.json();
  const shapeValid = Array.isArray(raw.facilities) && Array.isArray(raw.dorms) && raw.facilityTypes &&
    raw.dorm?.feeLevels?.[raw.dorm.initialFeeLevel] && raw.daysPerSemester > 0 && raw.tuition &&
    raw.dorms.every(dorm => Array.isArray(dorm.rooms) && dorm.rooms.length > 0 && dorm.rooms.every(room => room.beds > 0 && room.fee > 0) && dorm.demand >= 0);
  if (!shapeValid) throw new Error('운영 데이터(operations.json)의 형식이 올바르지 않습니다.');
  const loaded = normalizeData(raw);
  const ids = new Set();
  for (const facility of loaded.facilities) {
    if (ids.has(facility.id)) throw new Error(`운영 데이터에 같은 시설 ID '${facility.id}'가 두 번 있습니다.`);
    ids.add(facility.id);
    if (!['direct', 'lease'].includes(facility.initialMode)) throw new Error(`'${facility.name}'의 initialMode가 올바르지 않습니다.`);
  }
  return loaded;
}

// 결정 규칙(IMPLEMENTATION_PLAN.md 「플레이어 결정」): 같은 결정은 게임 날짜로 하루에 한 번만 내립니다.
// set* 함수는 확인 없이 바로 결정합니다(확인 창은 request* 함수가 띄웁니다). 잠겨 있거나 바뀌는 것이 없으면 false를 돌려줍니다.
export function isLocked(key) {
  const state = getState();
  return Boolean(state?.[AREA]) && isDecisionLocked(state[AREA], key, state.time.date);
}

export function setFacilityMode(facilityId, mode) {
  const facility = data.facilities.find(item => item.id === facilityId);
  const area = getState()[AREA];
  if (!facility || !['direct', 'lease'].includes(mode) || facilityMode(area, facility) === mode || isLocked(`mode:${facilityId}`)) return false;
  const count = area.switchCount + 1;
  applyEffect({
    id: `operations:switch:${facilityId}:${count}`,
    budget: -data.switchCost,
    reason: `${facility.name} ${mode === 'direct' ? '직접 운영' : '임대'} 전환 비용`,
    source: 'operations',
  });
  const today = getState().time.date;
  update(current => markDecided({ ...current, switchCount: count, modes: { ...current.modes, [facilityId]: mode } }, `mode:${facilityId}`, today));
  return true;
}

export function setDormFeeLevel(level) {
  if (!data.dorm.feeLevels[level] || feeLevelKey(getState()[AREA], data) === level || isLocked('feeLevel')) return false;
  const today = getState().time.date;
  update(current => markDecided({ ...current, feeLevel: level }, 'feeLevel', today));
  return true;
}

export function setDormOpenRate(dormId, rate) {
  const dorm = data.dorms.find(item => item.id === dormId);
  if (!dorm || !data.dorm.openRates.includes(rate) || openRate(getState()[AREA], dorm) === rate || isLocked(`openRate:${dormId}`)) return false;
  const today = getState().time.date;
  update(current => markDecided({ ...current, openRates: { ...current.openRates, [dormId]: rate } }, `openRate:${dormId}`, today));
  return true;
}

// 확인 창을 띄우고, 확인하면 결정합니다. 결정했으면 true를 돌려줍니다.
const RULE_NOTES = ['확인하면 오늘은 이 결정을 다시 바꿀 수 없고, 내일부터 바꿀 수 있어요.', '학생들의 반응은 내일부터 들려와요.'];
const people = value => `${value.toLocaleString('ko-KR')}명`;
// 마지막 글자의 받침에 맞는 조사를 붙입니다. 예: 학생식당을, 카페를 / 직접 운영으로, 임대로
function finalConsonant(word) {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : 0;
}
const objectParticle = word => `${word}${finalConsonant(word) ? '을' : '를'}`;
const toParticle = word => `${word}${[0, 8].includes(finalConsonant(word)) ? '로' : '으로'}`;
const signed = value => formatWon(value, { sign: true });

function dormTotals(area) {
  const results = data.dorms.map(dorm => dormResult(area, data, dorm));
  const sum = key => results.reduce((total, result) => total + result[key], 0);
  return { applicants: sum('applicants'), occupants: sum('occupants'), waiting: sum('waiting'), net: sum('net'), housing: scores(area, data).housing };
}

export async function requestFacilityMode(facilityId, mode) {
  const facility = data.facilities.find(item => item.id === facilityId);
  const area = getState()[AREA];
  if (!facility || facilityMode(area, facility) === mode || isLocked(`mode:${facilityId}`)) return false;
  const before = facilityResult(area, facility);
  const after = facilityResult({ ...area, modes: { ...area.modes, [facilityId]: mode } }, facility);
  const label = value => (value === 'direct' ? '직접 운영' : '임대');
  const ok = await confirmDecision({
    title: `${objectParticle(facility.name)} ${toParticle(label(mode))} 바꿀까요?`,
    rows: [
      ['운영 방식', label(before.mode), label(after.mode)],
      ['학기 수익', signed(before.net), signed(after.net)],
      ['학생 편의성', `${before.convenience}`, `${after.convenience}`],
    ],
    notes: [`계약 변경 비용 ${formatWon(data.switchCost)}원이 바로 지출돼요.`, ...RULE_NOTES],
  });
  return ok && setFacilityMode(facilityId, mode);
}

export async function requestDormFeeLevel(level) {
  const area = getState()[AREA];
  if (!data.dorm.feeLevels[level] || feeLevelKey(area, data) === level || isLocked('feeLevel')) return false;
  const before = dormTotals(area);
  const after = dormTotals({ ...area, feeLevel: level });
  const levelLabel = key => data.dorm.feeLevels[key].label;
  const ok = await confirmDecision({
    title: `모든 기숙사의 기숙사비를 ${toParticle(levelLabel(level))} 바꿀까요?`,
    rows: [
      ['기숙사비', levelLabel(feeLevelKey(area, data)), levelLabel(level)],
      ['입사 신청', people(before.applicants), people(after.applicants)],
      ['입사 대기', people(before.waiting), people(after.waiting)],
      ['기숙사 학기 수익', signed(before.net), signed(after.net)],
      ['주거 만족도', `${before.housing}`, `${after.housing}`],
    ],
    notes: RULE_NOTES,
  });
  return ok && setDormFeeLevel(level);
}

export async function requestDormOpenRate(dormId, rate) {
  const dorm = data.dorms.find(item => item.id === dormId);
  const area = getState()[AREA];
  if (!dorm || openRate(area, dorm) === rate || isLocked(`openRate:${dormId}`)) return false;
  const before = dormResult(area, data, dorm);
  const after = dormResult({ ...area, openRates: { ...area.openRates, [dormId]: rate } }, data, dorm);
  const ok = await confirmDecision({
    title: `${dorm.name}의 운영하는 방을 ${Math.round(rate * 100)}%로 바꿀까요?`,
    rows: [
      ['운영하는 방', people(before.openBeds), people(after.openBeds)],
      ['입주', people(before.occupants), people(after.occupants)],
      ['입사 대기', people(before.waiting), people(after.waiting)],
      ['학기 유지비', formatWon(-before.expense), formatWon(-after.expense)],
      ['학기 수익', signed(before.net), signed(after.net)],
    ],
    notes: ['운영하는 방은 비어 있어도 유지비가 들어요.', ...RULE_NOTES],
  });
  return ok && setDormOpenRate(dormId, rate);
}

let renderedKey = null;

// 운영 설정이나 선택 건물이 바뀔 때만 다시 그립니다. 매일 쌓이는 정산 기록으로는 다시 그리지 않습니다.
function render({ force = false } = {}) {
  const container = typeof document !== 'undefined' ? document.querySelector('#facility-actions') : null;
  if (!container || !data || !getState()) return;
  const { modes, feeLevel, openRates, decidedOn = {} } = getState()[AREA];
  // 오늘 잠긴 결정 목록이 바뀔 때(결정한 날, 다음 날 잠금이 풀릴 때)도 다시 그립니다.
  const today = dateKey(getState().time.date);
  const lockedToday = Object.keys(decidedOn).filter(key => decidedOn[key] === today).sort();
  const key = JSON.stringify([selectedBuildingId, modes, feeLevel, openRates, lockedToday]);
  const existing = container.querySelector('.operations-menu');
  if (!force && key === renderedKey && existing) return;
  renderedKey = key;
  existing?.remove();
  const menu = renderOperationsMenu({
    buildingId: selectedBuildingId,
    area: getState()[AREA],
    data,
    isLocked,
    actions: { setFacilityMode: requestFacilityMode, setDormFeeLevel: requestDormFeeLevel, setDormOpenRate: requestDormOpenRate },
  });
  if (menu) container.append(menu);
}

// src/main.js에서 startGame() 전에 호출합니다.
export function initOperations() {
  registerArea(AREA, createInitialArea);
  onTimeAdvance(({ semester }) => {
    if (data) updateArea(AREA, area => accrueDay(area, data, semester));
  });
  onSettlement(({ semester }) => {
    if (!data) return;
    const result = settle(getState()[AREA], data, semester);
    for (const effect of result.effects) applyEffect(effect);
    update(() => result.area);
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('campus:select', event => {
      selectedBuildingId = event.detail?.buildingId ?? null;
      render({ force: true });
    });
  }
  // 새 게임·불러오기 직후나 데이터가 늦게 준비된 경우 summary를 채웁니다.
  subscribe(state => {
    if (data && state?.[AREA] && !state[AREA].summary) update(current => current);
    render();
  });
  return loadOperationsData().then(loaded => {
    data = loaded;
    if (getState()?.[AREA]) update(current => current);
    render();
    return data;
  });
}
