// 4단계 편의시설·기숙사 운영
// - 편의시설: 직접 운영(매출−운영비) 또는 임대(임대료). 방식을 바꾸면 계약 변경 비용이 듭니다.
// - 기숙사: 기숙사비 수준과 기숙사별 운영 비율을 정합니다. 열어 둔 방은 비어 있어도 유지비가 듭니다.
// - 등록금: 학기 정산 때 등록 학생 수 × 1인 등록금을 받습니다.
// 수입·지출은 하루씩 쌓았다가 학기 정산(onSettlement) 때 applyEffect로 반영합니다.

import { registerArea, getState, updateArea, applyEffect, onTimeAdvance, onSettlement, subscribe } from './gameApi.js';
import { createInitialArea, accrueDay, settle, facilityMode, normalizeData } from './model.js';
import { renderOperationsMenu } from './menu.js';

const AREA = 'operations';
let data = null;
let selectedBuildingId = null;

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

export function setFacilityMode(facilityId, mode) {
  const facility = data.facilities.find(item => item.id === facilityId);
  const area = getState()[AREA];
  if (!facility || !['direct', 'lease'].includes(mode) || facilityMode(area, facility) === mode) return false;
  const count = area.switchCount + 1;
  applyEffect({
    id: `operations:switch:${facilityId}:${count}`,
    budget: -data.switchCost,
    reason: `${facility.name} ${mode === 'direct' ? '직접 운영' : '임대'} 전환 비용`,
    source: 'operations',
  });
  updateArea(AREA, current => ({ ...current, switchCount: count, modes: { ...current.modes, [facilityId]: mode } }));
  return true;
}

export function setDormFeeLevel(level) {
  if (!data.dorm.feeLevels[level]) return false;
  updateArea(AREA, current => ({ ...current, feeLevel: level }));
  return true;
}

export function setDormOpenRate(dormId, rate) {
  if (!data.dorms.some(dorm => dorm.id === dormId) || !data.dorm.openRates.includes(rate)) return false;
  updateArea(AREA, current => ({ ...current, openRates: { ...current.openRates, [dormId]: rate } }));
  return true;
}

let renderedKey = null;

// 운영 설정이나 선택 건물이 바뀔 때만 다시 그립니다. 매일 쌓이는 정산 기록으로는 다시 그리지 않습니다.
function render({ force = false } = {}) {
  const container = typeof document !== 'undefined' ? document.querySelector('#facility-actions') : null;
  if (!container || !data || !getState()) return;
  const { modes, feeLevel, openRates } = getState()[AREA];
  const key = JSON.stringify([selectedBuildingId, modes, feeLevel, openRates]);
  const existing = container.querySelector('.operations-menu');
  if (!force && key === renderedKey && existing) return;
  renderedKey = key;
  existing?.remove();
  const menu = renderOperationsMenu({
    buildingId: selectedBuildingId,
    area: getState()[AREA],
    data,
    actions: { setFacilityMode, setDormFeeLevel, setDormOpenRate },
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
    updateArea(AREA, () => result.area);
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('campus:select', event => {
      selectedBuildingId = event.detail?.buildingId ?? null;
      render({ force: true });
    });
  }
  subscribe(() => render());
  return loadOperationsData().then(loaded => {
    data = loaded;
    render();
    return data;
  });
}
