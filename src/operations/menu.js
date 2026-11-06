// 선택한 건물의 편의시설·기숙사 운영 메뉴를 만듭니다. 운영 시설이 없는 건물이면 null을 돌려줍니다.

import { facilityResult, dormResult, feeLevelKey, openRate, scores, semesterForecast } from './model.js';

export function formatWon(value, { sign = false } = {}) {
  const abs = Math.abs(value);
  let text;
  if (abs >= 1e8) text = `${(abs / 1e8).toFixed(1).replace(/\.0$/, '')}억`;
  else if (abs >= 1e4) text = `${Math.round(abs / 1e4).toLocaleString('ko-KR')}만`;
  else text = abs.toLocaleString('ko-KR');
  return `${value < 0 ? '−' : sign && value > 0 ? '+' : ''}${text}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(label, value, negative = false) {
  const line = element('div', 'ops-row');
  const amount = element('b', negative ? 'ops-negative' : '', value);
  line.append(element('span', '', label), amount);
  return line;
}

function facilityCard(facility, area, data, actions) {
  const card = element('div', 'ops-card');
  card.append(element('span', 'ops-type', data.facilityTypes[facility.type]?.label ?? facility.type), element('h4', '', facility.name));
  card.append(element('small', 'ops-place', `${facility.location} · ${facility.operator}`));
  const current = facilityResult(area, facility);
  const choices = element('div', 'ops-choice');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', `${facility.name} 운영 방식`);
  for (const [mode, label] of [['direct', '직접 운영'], ['lease', '임대']]) {
    const preview = facilityResult({ ...area, modes: { ...area.modes, [facility.id]: mode } }, facility);
    const button = element('button', '', label);
    button.setAttribute('aria-pressed', String(current.mode === mode));
    button.title = `학기 ${formatWon(preview.net, { sign: true })} · 편의성 ${preview.convenience}`;
    button.addEventListener('click', () => actions.setFacilityMode(facility.id, mode));
    choices.append(button);
  }
  card.append(choices);
  if (current.mode === 'direct') {
    card.append(row('학기 매출', formatWon(current.income)), row('학기 운영비', formatWon(-current.expense), true));
  } else {
    card.append(row('학기 임대료', formatWon(current.income)));
  }
  card.append(row('학기 수익', formatWon(current.net, { sign: true }), current.net < 0), row('학생 편의성', `${current.convenience} / 100`));
  card.append(element('small', 'ops-note', `방식을 바꾸면 계약 변경 비용 ${formatWon(data.switchCost)}이 듭니다.`));
  return card;
}

function select(label, options, value, onChange) {
  const wrapper = element('label', 'ops-select');
  wrapper.append(element('span', '', label));
  const input = element('select');
  for (const [optionValue, optionLabel] of options) {
    const option = element('option', '', optionLabel);
    option.value = String(optionValue);
    option.selected = optionValue === value;
    input.append(option);
  }
  input.addEventListener('change', () => onChange(input.value));
  wrapper.append(input);
  return wrapper;
}

function dormCard(dorm, area, data, actions) {
  const card = element('div', 'ops-card');
  card.append(element('span', 'ops-type', '기숙사'), element('h4', '', dorm.name));
  card.append(element('small', 'ops-place', `${dorm.opened} · ${dorm.rooms.map(room => `${room.type} ${room.beds.toLocaleString('ko-KR')}명 ${formatWon(room.fee)}원`).join(' · ')} (2026-1 공시 사용료)`));
  const result = dormResult(area, data, dorm);
  const levels = Object.entries(data.dorm.feeLevels).map(([key, level]) => [key, `${level.label} · 평균 ${formatWon(Math.round(dorm.fee * level.multiplier))}원`]);
  card.append(select('기숙사비 (모든 기숙사)', levels, feeLevelKey(area, data), value => actions.setDormFeeLevel(value)));
  const rates = data.dorm.openRates.map(rate => [rate, `${Math.round(rate * 100)}% · ${Math.round(dorm.capacity * rate).toLocaleString('ko-KR')}명`]);
  card.append(select('운영하는 방', rates, openRate(area, dorm), value => actions.setDormOpenRate(dorm.id, Number(value))));
  card.append(
    row('정원', `${dorm.capacity.toLocaleString('ko-KR')}명`),
    row('입사 신청', `${result.applicants.toLocaleString('ko-KR')}명`),
    row('입주', `${result.occupants.toLocaleString('ko-KR')}명`),
    row('입사 대기', `${result.waiting.toLocaleString('ko-KR')}명`, result.waiting > 0),
    row('빈방', `${result.emptyBeds.toLocaleString('ko-KR')}명분`, result.emptyBeds > 0),
    row('학기 기숙사비', formatWon(result.income)),
    row('학기 유지비', formatWon(-result.expense), true),
    row('학기 수익', formatWon(result.net, { sign: true }), result.net < 0),
  );
  card.append(element('small', 'ops-note', '열어 둔 방은 비어 있어도 유지비가 듭니다.'));
  return card;
}

export function renderOperationsMenu({ buildingId, area, data, actions }) {
  const facilities = data.facilities.filter(facility => facility.buildingId === buildingId);
  const dorms = data.dorms.filter(dorm => dorm.buildingId === buildingId);
  if (!facilities.length && !dorms.length) return null;
  const menu = element('section', 'operations-menu');
  menu.setAttribute('aria-label', '시설 운영');
  menu.append(element('h3', 'ops-title', '시설 운영'));
  for (const facility of facilities) menu.append(facilityCard(facility, area, data, actions));
  for (const dorm of dorms) menu.append(dormCard(dorm, area, data, actions));
  const score = scores(area, data);
  const forecast = semesterForecast(area, data);
  const summary = element('div', 'ops-summary');
  summary.append(
    element('span', 'ops-type', '학교 전체 · 한 학기 예상'),
    row('학생 편의성', `${score.convenience} / 100`),
    row('주거 만족도', `${score.housing} / 100`),
    row('편의시설 수익', formatWon(forecast.facilities, { sign: true }), forecast.facilities < 0),
    row('기숙사 수익', formatWon(forecast.dorms, { sign: true }), forecast.dorms < 0),
  );
  menu.append(summary);
  return menu;
}
