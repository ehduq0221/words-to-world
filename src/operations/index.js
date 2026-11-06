// 4단계 편의시설·기숙사 운영
// - 편의시설: 직접 운영(매출−운영비) 또는 임대(임대료).
// - 기숙사: 기숙사비 수준과 기숙사별 운영하는 방 비율. 운영하는 방은 비어 있어도 유지비가 듭니다.
// - 등록금: 학기 정산 때 등록 학생 수 × 1인 등록금을 받습니다.
// 수입·지출은 하루씩 쌓았다가 학기 정산(onSettlement) 때 applyEffect로 반영합니다.
//
// 운영 방식은 「학기 운영 결정」입니다(IMPLEMENTATION_PLAN.md 공통 약속 「총장 결정」).
// - 학기 중에는 바꿀 수 없고, 다음 학기 시작 30일 전부터 전날까지 「다음 학기 계획」을 정합니다.
// - 계획은 다음 학기 첫날 적용되며, 운영 방식이 바뀐 시설의 계약 변경 비용도 그날 지출됩니다.
// - 같은 계획 항목은 하루에 한 번만 고칠 수 있고, 고칠 때마다 확인 창을 거칩니다.

import { registerArea, getState, updateArea, applyEffect, onTimeAdvance, onSettlement, subscribe } from './gameApi.js';
import {
  createInitialArea, accrueDay, settle, facilityMode, normalizeData, summarize, isDecisionLocked, markDecided, dateKey,
  facilityResult, dormResult, feeLevelKey, openRate, scores, planningWindow, plannedArea, currentPlan, planChanges, applyPlan,
  semesterName, formatDate,
} from './model.js';
import { renderOperationsMenu, renderPlanningNotice, formatWon } from './menu.js';
import { confirmDecision } from '../ui/confirm.js';

const AREA = 'operations';
let data = null;
let selectedBuildingId = null;

// 운영 영역을 바꿀 때는 항상 이 함수를 써서 다른 기능이 읽는 summary를 함께 갱신합니다.
// 값이 그대로면 기존 summary 객체를 유지해, 계획만 고친 날 다른 기능이 「값이 바뀌었다」고 보지 않게 합니다.
function update(updater) {
  updateArea(AREA, current => {
    const next = updater(current);
    const summary = summarize(next, data);
    const same = current?.summary && JSON.stringify(current.summary) === JSON.stringify(summary);
    return { ...next, summary: same ? current.summary : summary };
  });
}

export async function loadOperationsData(url = new URL('../../public/data/operations.json', import.meta.url)) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('운영 데이터(operations.json)를 불러올 수 없습니다.');
  const raw = await response.json();
  const shapeValid = Array.isArray(raw.facilities) && Array.isArray(raw.dorms) && raw.facilityTypes &&
    raw.dorm?.feeLevels?.[raw.dorm.initialFeeLevel] && raw.tuition && raw.planningDaysBefore > 0 &&
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

// ---- 결정 기간과 잠금 ----

export function planning() {
  const state = getState();
  if (!state || !data) return null;
  return planningWindow(state.time.date, data.planningDaysBefore);
}

export function isLocked(key) {
  const state = getState();
  return Boolean(state?.[AREA]) && isDecisionLocked(state[AREA], key, state.time.date);
}

// 계획 항목을 고칠 수 있는지와 그 이유. 메뉴와 set* 함수가 함께 씁니다.
export function planStatus(key) {
  const window = planning();
  if (!window) return { editable: false, reason: 'loading' };
  if (!window.open) return { editable: false, reason: 'closed', window };
  if (isLocked(key)) return { editable: false, reason: 'locked', window };
  return { editable: true, reason: 'open', window };
}

// set* 함수는 확인 없이 계획을 고칩니다(확인 창은 request* 함수가 띄웁니다).
// 결정 기간이 아니거나, 오늘 이미 고쳤거나, 바뀌는 것이 없으면 false를 돌려줍니다.
function setPlan(key, change) {
  const status = planStatus(key);
  if (!status.editable) return false;
  const today = getState().time.date;
  const semester = status.window.semester;
  update(current => {
    const plan = currentPlan(current, semester);
    return markDecided({ ...current, plan: change(plan, current) }, key, today);
  });
  return true;
}

// 이번 학기와 같은 값으로 계획하면 계획에서 지웁니다.
function withOverride(map, id, value, currentValue) {
  const next = { ...map };
  if (value === currentValue) delete next[id];
  else next[id] = value;
  return next;
}

export function setFacilityPlan(facilityId, mode) {
  const facility = data.facilities.find(item => item.id === facilityId);
  if (!facility || !['direct', 'lease'].includes(mode)) return false;
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (facilityMode(plannedArea(area, semester), facility) === mode) return false;
  return setPlan(`mode:${facilityId}`, plan => ({ ...plan, modes: withOverride(plan.modes, facilityId, mode, facilityMode(area, facility)) }));
}

export function setFeeLevelPlan(level) {
  if (!data.dorm.feeLevels[level]) return false;
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (feeLevelKey(plannedArea(area, semester), data) === level) return false;
  return setPlan('feeLevel', plan => ({ ...plan, feeLevel: level === feeLevelKey(area, data) ? null : level }));
}

export function setOpenRatePlan(dormId, rate) {
  const dorm = data.dorms.find(item => item.id === dormId);
  if (!dorm || !data.dorm.openRates.includes(rate)) return false;
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (openRate(plannedArea(area, semester), dorm) === rate) return false;
  return setPlan(`openRate:${dormId}`, plan => ({ ...plan, openRates: withOverride(plan.openRates, dormId, rate, openRate(area, dorm)) }));
}

// ---- 확인 창 ----

const people = value => `${value.toLocaleString('ko-KR')}명`;
const signed = value => formatWon(value, { sign: true });
// 마지막 글자의 받침에 맞는 조사를 붙입니다. 예: 학생식당을, 카페를 / 직접 운영으로, 임대로
function finalConsonant(word) {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 ? code % 28 : 0;
}
const objectParticle = word => `${word}${finalConsonant(word) ? '을' : '를'}`;
const toParticle = word => `${word}${[0, 8].includes(finalConsonant(word)) ? '로' : '으로'}`;
const modeLabel = mode => (mode === 'direct' ? '직접 운영' : '임대');

function ruleNotes(window) {
  return [
    `${formatDate(window.start)} ${semesterName(window.semester)} 첫날부터 적용돼요. 그전까지는 이번 학기 운영이 그대로 유지돼요.`,
    `오늘은 이 항목을 다시 고칠 수 없고, 내일부터 ${formatDate(window.closes)}까지 다시 고칠 수 있어요.`,
    '학생들의 반응은 적용된 다음 날부터 들려와요.',
  ];
}

function dormTotals(area) {
  const results = data.dorms.map(dorm => dormResult(area, data, dorm));
  const sum = key => results.reduce((total, result) => total + result[key], 0);
  return { applicants: sum('applicants'), waiting: sum('waiting'), net: sum('net'), housing: scores(area, data).housing };
}

async function confirmPlan({ key, title, rows, notes = [] }) {
  const status = planStatus(key);
  if (!status.editable) return false;
  return confirmDecision({
    title,
    columns: ['이번 학기', `${semesterName(status.window.semester)} 계획`],
    rows,
    notes: [...notes, ...ruleNotes(status.window)],
    confirmLabel: '계획 확정',
  });
}

export async function requestFacilityPlan(facilityId, mode) {
  const facility = data.facilities.find(item => item.id === facilityId);
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (!facility || !semester || facilityMode(plannedArea(area, semester), facility) === mode) return false;
  const before = facilityResult(area, facility);
  const after = facilityResult({ ...area, modes: { ...area.modes, [facilityId]: mode } }, facility);
  const costNote = mode === before.mode
    ? '이번 학기 방식을 그대로 이어 가므로 계약 변경 비용이 들지 않아요.'
    : `계약 변경 비용 ${formatWon(data.switchCost)}원은 학기 첫날 지출돼요.`;
  const ok = await confirmPlan({
    key: `mode:${facilityId}`,
    title: `다음 학기에 ${objectParticle(facility.name)} ${toParticle(modeLabel(mode))} 운영할까요?`,
    rows: [
      ['운영 방식', modeLabel(before.mode), modeLabel(after.mode)],
      ['학기 수익', signed(before.net), signed(after.net)],
      ['학생 편의성', `${before.convenience}`, `${after.convenience}`],
    ],
    notes: [costNote],
  });
  return ok && setFacilityPlan(facilityId, mode);
}

export async function requestFeeLevelPlan(level) {
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (!data.dorm.feeLevels[level] || !semester || feeLevelKey(plannedArea(area, semester), data) === level) return false;
  const before = dormTotals(area);
  const after = dormTotals({ ...area, feeLevel: level });
  const levelLabel = key => data.dorm.feeLevels[key].label;
  const ok = await confirmPlan({
    key: 'feeLevel',
    title: `다음 학기 모든 기숙사의 기숙사비를 ${toParticle(levelLabel(level))} 정할까요?`,
    rows: [
      ['기숙사비', levelLabel(feeLevelKey(area, data)), levelLabel(level)],
      ['입사 신청', people(before.applicants), people(after.applicants)],
      ['입사 대기', people(before.waiting), people(after.waiting)],
      ['기숙사 학기 수익', signed(before.net), signed(after.net)],
      ['주거 만족도', `${before.housing}`, `${after.housing}`],
    ],
  });
  return ok && setFeeLevelPlan(level);
}

export async function requestOpenRatePlan(dormId, rate) {
  const dorm = data.dorms.find(item => item.id === dormId);
  const area = getState()[AREA];
  const semester = planning()?.semester;
  if (!dorm || !semester || openRate(plannedArea(area, semester), dorm) === rate) return false;
  const before = dormResult(area, data, dorm);
  const after = dormResult({ ...area, openRates: { ...area.openRates, [dormId]: rate } }, data, dorm);
  const ok = await confirmPlan({
    key: `openRate:${dormId}`,
    title: `다음 학기 ${dorm.name}의 운영하는 방을 ${Math.round(rate * 100)}%로 정할까요?`,
    rows: [
      ['운영하는 방', people(before.openBeds), people(after.openBeds)],
      ['입주', people(before.occupants), people(after.occupants)],
      ['입사 대기', people(before.waiting), people(after.waiting)],
      ['학기 유지비', formatWon(-before.expense), formatWon(-after.expense)],
      ['학기 수익', signed(before.net), signed(after.net)],
    ],
    notes: ['운영하는 방은 비어 있어도 유지비가 들어요.'],
  });
  return ok && setOpenRatePlan(dormId, rate);
}

// ---- 화면 ----

let renderedKey = null;

// 운영 설정·계획·잠금·결정 기간·선택 건물이 바뀔 때만 다시 그립니다. 매일 쌓이는 정산 기록으로는 다시 그리지 않습니다.
function render({ force = false } = {}) {
  if (typeof document === 'undefined' || !data || !getState()?.[AREA]) return;
  const area = getState()[AREA];
  const window = planning();
  const today = dateKey(getState().time.date);
  const lockedToday = Object.keys(area.decidedOn ?? {}).filter(key => area.decidedOn[key] === today).sort();
  const key = JSON.stringify([selectedBuildingId, area.modes, area.feeLevel, area.openRates, area.plan, lockedToday, window.semester, window.open]);
  const container = document.querySelector('#facility-actions');
  const existing = container?.querySelector('.operations-menu');
  if (!force && key === renderedKey && (existing || !container)) return;
  renderedKey = key;
  renderPlanningNotice({ window, changes: planChanges(area, data, window.semester) });
  if (!container) return;
  existing?.remove();
  const menu = renderOperationsMenu({
    buildingId: selectedBuildingId,
    area,
    planned: plannedArea(area, window.semester),
    window,
    data,
    planStatus,
    actions: { setFacilityMode: requestFacilityPlan, setDormFeeLevel: requestFeeLevelPlan, setDormOpenRate: requestOpenRatePlan },
  });
  if (menu) container.append(menu);
}

// src/main.js에서 startGame() 전에 호출합니다.
export function initOperations() {
  registerArea(AREA, createInitialArea);
  onTimeAdvance(({ semester }) => {
    if (!data) return;
    const area = getState()[AREA];
    // 새 학기 첫날: 다음 학기 계획을 적용하고 계약 변경 비용을 지출합니다.
    if (area.activeSemester !== semester) {
      if (area.activeSemester === null || area.activeSemester === undefined) {
        update(current => ({ ...current, activeSemester: semester }));
      } else {
        const result = applyPlan(area, data, semester);
        for (const effect of result.effects) applyEffect(effect);
        update(() => result.area);
      }
    }
    updateArea(AREA, current => accrueDay(current, data, semester));
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
