// 선택한 건물의 편의시설·기숙사 운영 메뉴와 학기 운영 결정 기간 안내를 만듭니다.
// 메뉴는 「이번 학기」 운영(바꿀 수 없음)과 「다음 학기 계획」(결정 기간에만 고칠 수 있음)을 나눠 보여 줍니다.

import { facilityResult, dormResult, feeLevelKey, openRate, scores, semesterForecast, semesterName, formatDate } from './model.js';

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

const modeLabel = mode => (mode === 'direct' ? '직접 운영' : '임대');

// 계획 항목의 상태 안내. status.reason: open | locked | closed
function planNote(status, changed, changedText) {
  const { window } = status;
  const name = semesterName(window.semester);
  if (status.reason === 'closed') {
    return [`${name} 계획은 ${formatDate(window.opens)}부터 ${formatDate(window.closes)}까지 정할 수 있어요.`, 'ops-note'];
  }
  if (status.reason === 'locked') {
    return [`오늘 계획을 정했어요. 내일부터 ${formatDate(window.closes)}까지 다시 고칠 수 있어요.`, 'ops-note ops-locked'];
  }
  if (changed) return [`${formatDate(window.start)}부터 ${changedText} · 결정 기간 ${formatDate(window.closes)}까지`, 'ops-note ops-planned'];
  return [`결정 기간 · ${formatDate(window.closes)}까지 정하면 ${formatDate(window.start)}부터 적용돼요.`, 'ops-note ops-open'];
}

function planHeading(window) {
  return element('span', 'ops-plan-title', `${semesterName(window.semester)} 계획`);
}

function facilityCard(facility, { area, planned, data, actions, planStatus, window }) {
  const card = element('div', 'ops-card');
  card.append(element('span', 'ops-type', data.facilityTypes[facility.type]?.label ?? facility.type), element('h4', '', facility.name));
  card.append(element('small', 'ops-place', `${facility.location} · ${facility.operator}`));
  const current = facilityResult(area, facility);
  const next = facilityResult(planned, facility);
  card.append(row('이번 학기 운영', modeLabel(current.mode)));
  if (current.mode === 'direct') {
    card.append(row('학기 매출', formatWon(current.income)), row('학기 운영비', formatWon(-current.expense), true));
  } else {
    card.append(row('학기 임대료', formatWon(current.income)));
  }
  card.append(row('학기 수익', formatWon(current.net, { sign: true }), current.net < 0), row('학생 편의성', `${current.convenience} / 100`));

  const status = planStatus(`mode:${facility.id}`);
  const plan = element('div', 'ops-plan');
  plan.append(planHeading(window));
  const choices = element('div', 'ops-choice');
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', `${facility.name} ${semesterName(window.semester)} 운영 계획`);
  for (const mode of ['direct', 'lease']) {
    const preview = facilityResult({ ...area, modes: { ...area.modes, [facility.id]: mode } }, facility);
    const button = element('button', '', modeLabel(mode));
    button.type = 'button';
    button.setAttribute('aria-pressed', String(next.mode === mode));
    button.disabled = !status.editable;
    button.title = `학기 ${formatWon(preview.net, { sign: true })} · 편의성 ${preview.convenience}`;
    button.addEventListener('click', () => actions.setFacilityMode(facility.id, mode));
    choices.append(button);
  }
  plan.append(choices);
  const changed = next.mode !== current.mode;
  const changedText = `${next.mode === 'direct' ? '직접 운영으로' : '임대로'} 바뀌어요(계약 변경 비용 ${formatWon(data.switchCost)}원)`;
  const [text, className] = planNote(status, changed, changedText);
  plan.append(element('small', className, text));
  card.append(plan);
  return card;
}

function select(label, options, value, onChange, disabled) {
  const wrapper = element('label', 'ops-select');
  wrapper.append(element('span', '', label));
  const input = element('select');
  input.disabled = disabled;
  for (const [optionValue, optionLabel] of options) {
    const option = element('option', '', optionLabel);
    option.value = String(optionValue);
    option.selected = optionValue === value;
    input.append(option);
  }
  // 확인 창에서 확정하기 전까지는 원래 값을 보여 줍니다. 확정하면 메뉴가 새 값으로 다시 그려집니다.
  input.addEventListener('change', () => {
    const chosen = input.value;
    input.value = String(value);
    onChange(chosen);
  });
  wrapper.append(input);
  return wrapper;
}

function dormCard(dorm, { area, planned, data, actions, planStatus, window }) {
  const card = element('div', 'ops-card');
  card.append(element('span', 'ops-type', '기숙사'), element('h4', '', dorm.name));
  card.append(element('small', 'ops-place', `${dorm.opened} · ${dorm.rooms.map(room => `${room.type} ${room.beds.toLocaleString('ko-KR')}명 ${formatWon(room.fee)}원`).join(' · ')} (2026-1 공시 사용료)`));
  const result = dormResult(area, data, dorm);
  const levelLabel = key => data.dorm.feeLevels[key].label;
  card.append(
    row('이번 학기 기숙사비', `${levelLabel(feeLevelKey(area, data))} · 평균 ${formatWon(result.fee)}원`),
    row('운영하는 방', `${Math.round(openRate(area, dorm) * 100)}% · ${result.openBeds.toLocaleString('ko-KR')}명`),
    row('입사 신청', `${result.applicants.toLocaleString('ko-KR')}명`),
    row('입주', `${result.occupants.toLocaleString('ko-KR')}명`),
    row('입사 대기', `${result.waiting.toLocaleString('ko-KR')}명`, result.waiting > 0),
    row('빈방', `${result.emptyBeds.toLocaleString('ko-KR')}명분`, result.emptyBeds > 0),
    row('학기 수익', formatWon(result.net, { sign: true }), result.net < 0),
  );

  const plan = element('div', 'ops-plan');
  plan.append(planHeading(window));
  const feeStatus = planStatus('feeLevel');
  const levels = Object.entries(data.dorm.feeLevels).map(([key, level]) => [key, `${level.label} · 평균 ${formatWon(Math.round(dorm.fee * level.multiplier))}원`]);
  plan.append(select('기숙사비 (모든 기숙사)', levels, feeLevelKey(planned, data), value => actions.setDormFeeLevel(value), !feeStatus.editable));
  const feeChanged = feeLevelKey(planned, data) !== feeLevelKey(area, data);
  const [feeText, feeClass] = planNote(feeStatus, feeChanged, `기숙사비가 「${levelLabel(feeLevelKey(planned, data))}」(으)로 바뀌어요`);
  plan.append(element('small', feeClass, feeText));

  const rateStatus = planStatus(`openRate:${dorm.id}`);
  const rates = data.dorm.openRates.map(rate => [rate, `${Math.round(rate * 100)}% · ${Math.round(dorm.capacity * rate).toLocaleString('ko-KR')}명`]);
  plan.append(select('운영하는 방', rates, openRate(planned, dorm), value => actions.setDormOpenRate(dorm.id, Number(value)), !rateStatus.editable));
  const rateChanged = openRate(planned, dorm) !== openRate(area, dorm);
  const [rateText, rateClass] = planNote(rateStatus, rateChanged, `운영하는 방이 ${Math.round(openRate(planned, dorm) * 100)}%로 바뀌어요`);
  plan.append(element('small', rateClass, rateText));
  plan.append(element('small', 'ops-note', '운영하는 방은 비어 있어도 유지비가 듭니다.'));
  card.append(plan);
  return card;
}

export function renderOperationsMenu(context) {
  const { buildingId, area, planned, data, window } = context;
  const facilities = data.facilities.filter(facility => facility.buildingId === buildingId);
  const dorms = data.dorms.filter(dorm => dorm.buildingId === buildingId);
  if (!facilities.length && !dorms.length) return null;
  const menu = element('section', 'operations-menu');
  menu.setAttribute('aria-label', '시설 운영');
  menu.append(element('h3', 'ops-title', '시설 운영'));
  menu.append(element('p', 'ops-intro', `운영 방식은 학기 단위로 정해요. 이번 학기 운영은 바꿀 수 없고, ${semesterName(window.semester)} 계획은 ${formatDate(window.opens)}부터 ${formatDate(window.closes)}까지 정할 수 있어요.`));
  for (const facility of facilities) menu.append(facilityCard(facility, context));
  for (const dorm of dorms) menu.append(dormCard(dorm, context));
  const score = scores(area, data);
  const forecast = semesterForecast(area, data);
  const nextForecast = semesterForecast(planned, data);
  const summary = element('div', 'ops-summary');
  summary.append(
    element('span', 'ops-type', '학교 전체 · 이번 학기 예상'),
    row('학생 편의성', `${score.convenience} / 100`),
    row('주거 만족도', `${score.housing} / 100`),
    row('편의시설 수익', formatWon(forecast.facilities, { sign: true }), forecast.facilities < 0),
    row('기숙사 수익', formatWon(forecast.dorms, { sign: true }), forecast.dorms < 0),
  );
  if (nextForecast.facilities !== forecast.facilities || nextForecast.dorms !== forecast.dorms) {
    summary.append(
      element('span', 'ops-type ops-next', `${semesterName(window.semester)} 계획대로라면`),
      row('편의시설 수익', formatWon(nextForecast.facilities, { sign: true }), nextForecast.facilities < 0),
      row('기숙사 수익', formatWon(nextForecast.dorms, { sign: true }), nextForecast.dorms < 0),
    );
  }
  menu.append(summary);
  return menu;
}

// 결정 기간에 화면 위쪽에 띄우는 안내. 결정 기간이 아니면 지웁니다.
export function renderPlanningNotice({ window, changes }) {
  if (typeof document === 'undefined') return;
  let notice = document.querySelector('#term-plan-notice');
  if (!window.open) {
    notice?.remove();
    return;
  }
  if (!notice) {
    notice = element('div', 'term-plan-notice');
    notice.id = 'term-plan-notice';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  const name = semesterName(window.semester);
  const title = element('b', '', `${name} 운영 계획 결정 기간 · ${formatDate(window.closes)}까지`);
  const detail = changes.count
    ? `계획된 변경 ${changes.count}건 · ${formatDate(window.start)}부터 적용돼요.`
    : `기숙사·식당·편의시설 건물을 눌러 ${name} 운영 방식을 정하세요. 정하지 않으면 이번 학기 운영이 이어져요.`;
  notice.replaceChildren(title, element('span', '', detail));
}
