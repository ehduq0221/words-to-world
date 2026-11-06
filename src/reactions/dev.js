// dev.html 전용. 3단계가 합쳐지면 stubGame.js와 함께 삭제합니다.
// 4단계 운영 기능 대신 operations.summary 형태의 값을 간단한 계산으로 만들어 민원 조건을 확인합니다.
// 아래 기숙사 계산은 확인용 흉내이며, 실제 계산은 4단계(src/operations/)가 맡습니다.
import { startGame, getState, subscribe, registerArea, updateArea, applyEffect, devAdvanceDays } from './stubGame.js';
import { initReactions, addReaction, registerDialogues } from './index.js';

const DORMS = {
  'dorm-1': { name: '제1기숙사', buildingId: 'way/1394978436', capacity: 546, demand: 700, fee: 957000 },
  'dorm-2': { name: '제2기숙사', buildingId: 'way/895812320', capacity: 1130, demand: 1400, fee: 928000 },
  'dorm-3': { name: '제3기숙사', buildingId: 'way/1394978434', capacity: 1000, demand: 1250, fee: 928000 },
};
const CAFETERIAS = {
  'welfare-cafeteria': { name: '학생식당', buildingId: 'way/367504010' },
  'dorm2-cafeteria': { name: '제2기숙사식당', buildingId: 'way/895812320' },
};
const FEE_LEVELS = { low: { multiplier: 0.85, demand: 1.2, housing: 10 }, normal: { multiplier: 1, demand: 1, housing: 0 }, high: { multiplier: 1.15, demand: 0.8, housing: -15 } };
const sim = { feeLevel: 'normal', open: { 'dorm-1': 1, 'dorm-2': 1, 'dorm-3': 1 }, cafeterias: { 'welfare-cafeteria': 'direct', 'dorm2-cafeteria': 'lease' }, convenience: 72 };

function summarize() {
  const level = FEE_LEVELS[sim.feeLevel];
  const dorms = {};
  let applicants = 0;
  let waiting = 0;
  for (const [id, dorm] of Object.entries(DORMS)) {
    const openBeds = Math.round(dorm.capacity * sim.open[id]);
    const apply = Math.round(dorm.demand * level.demand);
    const occupants = Math.min(openBeds, apply);
    dorms[id] = { buildingId: dorm.buildingId, name: dorm.name, capacity: dorm.capacity, openBeds, applicants: apply, occupants, waiting: apply - occupants, emptyBeds: openBeds - occupants, fee: Math.round(dorm.fee * level.multiplier) };
    applicants += apply;
    waiting += apply - occupants;
  }
  const housing = Math.round(Math.min(100, Math.max(0, 80 - 60 * (waiting / applicants) + level.housing)) * 10) / 10;
  const facilities = Object.fromEntries(Object.entries(CAFETERIAS).map(([id, item]) => [id, { ...item, type: 'cafeteria', mode: sim.cafeterias[id], convenience: sim.cafeterias[id] === 'direct' ? 85 : 60 }]));
  return { convenience: sim.convenience, housing, feeLevel: sim.feeLevel, dorms, facilities };
}
const applySim = () => updateArea('operations', area => ({ ...area, summary: summarize() }));

registerArea('operations', () => ({ summary: summarize() }));
const ready = initReactions();
await startGame();
const config = await ready;
registerDialogues([
  { type: 'festival.after', text: '{building}에서 본 축제 무대가 정말 좋았어요!' },
  { type: 'festival.after', text: '올해 축제 라인업 최고였어요. 내년에도 기대할게요!' },
  { type: 'festival.after', text: '축제 끝나고 {building} 정리하는 거 도왔는데 뿌듯했어요.' },
]);

let effectCount = 0;
const setMetric = (key, target) => {
  const current = getState().metrics[key];
  if (current !== target) applyEffect({ id: `dev:${key}:${++effectCount}`, [key]: target - current, reason: '개발용 조정' });
};
const advanceUntilEvent = () => {
  const start = getState().reactions.seq;
  for (let i = 0; i < 400; i++) {
    devAdvanceDays(1);
    if (getState().reactions.feed.some(reaction => reaction.seq > start && reaction.kind === 'event')) return;
  }
};

// [그룹 이름, [[버튼 이름, 동작, 현재 선택 여부]]]
// [그룹 이름, 버튼 목록, 결정 키]. 결정 키가 있는 그룹은 플레이어 결정이라 확인 창과 하루 한 번 규칙을 따릅니다.
const groups = [
  ['기숙사비 (모든 기숙사)', [['인하', 'low'], ['현재 요금', 'normal'], ['인상', 'high']].map(([label, key]) => [label, () => { sim.feeLevel = key; applySim(); }, () => sim.feeLevel === key]), 'feeLevel'],
  ...['dorm-1', 'dorm-2'].map(id => [`${DORMS[id].name} 운영하는 방`, [0.5, 0.75, 1].map(rate => [`${rate * 100}%`, () => { sim.open[id] = rate; applySim(); }, () => sim.open[id] === rate]), `openRate:${id}`]),
  ...Object.entries(CAFETERIAS).map(([id, item]) => [`${item.name} 운영`, [['직접 운영', 'direct'], ['임대', 'lease']].map(([label, mode]) => [label, () => { sim.cafeterias[id] = mode; applySim(); }, () => sim.cafeterias[id] === mode]), `mode:${id}`]),
  ['학생 편의성', [58, 66, 72, 82].map(value => [String(value), () => { sim.convenience = value; applySim(); }, () => sim.convenience === value])],
  ['학생 만족도', [30, 40, 60, 80].map(value => [String(value), () => setMetric('satisfaction', value), () => getState().metrics.satisfaction === value])],
  ['학교 평판', [35, 60, 80].map(value => [String(value), () => setMetric('reputation', value), () => getState().metrics.reputation === value])],
  ['학교 예산', [['적자 −10억', -1_000_000_000], ['흑자 100억', 10_000_000_000]].map(([label, value]) => [label, () => setMetric('budget', value), () => getState().metrics.budget === value])],
  ['시간', [['+1일', () => devAdvanceDays(1)], ['+7일', () => devAdvanceDays(7)], ['+28일', () => devAdvanceDays(28)], ['다음 학사 일정까지', advanceUntilEvent], ['한 학기 +182일', () => devAdvanceDays(182)]]],
  ['다른 기능의 반응', [['축제 후 반응', () => addReaction({ type: 'festival.after', buildingId: 'way/367512818', cause: '축제', values: { building: '대운동장' } })]]],
];

const PRIORITY_NOTE = { complaint: '민원', resolved: '해결', praise: '칭찬', eased: '완화', event: '일상' };
const result = document.querySelector('#dev-result');
function explain(label, before, changedValues) {
  const after = getState().reactions;
  const added = after.feed.filter(reaction => reaction.seq > before.seq);
  if (added.length) {
    result.textContent = `「${label}」 → 새 반응 ${added.length}개: ` + added.map(reaction => `[${reaction.priority || PRIORITY_NOTE[reaction.kind]}] ${reaction.text}`).join(' / ');
    return;
  }
  if (!changedValues) {
    result.textContent = `「${label}」 → 이미 선택된 상태라 바뀐 것이 없어요.`;
  } else if (after.pendingSince !== null && after.pendingSince !== undefined) {
    result.textContent = `「${label}」 → 바뀐 내용을 기록했어요. 학생들의 반응은 내일부터 들려와요. 「+1일」을 눌러 보세요.`;
  } else if (label.startsWith('+') || label.includes('학기') || label.includes('일정')) {
    result.textContent = `「${label}」 → 이 기간에는 학사 일정 반응이나, 28일 넘게 이어진 민원이 없어 새 반응이 없어요.`;
  } else {
    result.textContent = `「${label}」 → 값은 바뀌었지만 새로 생기거나 해결된 민원·칭찬이 없어요. 이미 진행 중인 민원은 심각도 단계가 바뀌거나 28일이 지나야 다시 이야기해요.`;
  }
}

// 4단계 운영 메뉴의 결정 규칙을 흉내 냅니다: 확인 창 한 번, 같은 결정은 하루 한 번.
// 실제 확인 창(지금/결정 후 비교 표)은 4단계 운영 메뉴에 있습니다.
const decidedOn = {};
const today = () => { const { year, month, day } = getState().time.date; return `${year}-${month}-${day}`; };
const isDecisionLocked = key => decidedOn[key] === today();

const controls = document.querySelector('#dev-controls');
const pressedChecks = [];
const lockedGroups = [];
for (const [title, buttons, decisionKey] of groups) {
  const group = document.createElement('div');
  group.className = 'dev-group';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const row = document.createElement('div');
  for (const [label, action, isPressed] of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    if (isPressed) pressedChecks.push([button, isPressed]);
    button.addEventListener('click', () => {
      const before = getState().reactions;
      const snapshot = JSON.stringify([getState().operations.summary, getState().metrics, getState().time]);
      if (decisionKey) {
        if (isPressed()) return explain(`${title} ${label}`, before, false);
        if (isDecisionLocked(decisionKey)) {
          result.textContent = `「${title} ${label}」 → 오늘 이미 결정했어요. 내일부터 다시 바꿀 수 있어요.`;
          return;
        }
        if (!window.confirm(`「${title}」을(를) 「${label}」(으)로 결정할까요?\n확인하면 오늘은 다시 바꿀 수 없고, 학생 반응은 내일부터 들려와요.`)) {
          result.textContent = `「${title} ${label}」 → 취소했어요. 바뀐 것이 없어요.`;
          return;
        }
        decidedOn[decisionKey] = today();
      }
      action();
      explain(`${title} ${label}`.replace(/^시간 /, ''), before, snapshot !== JSON.stringify([getState().operations.summary, getState().metrics, getState().time]));
    });
    row.append(button);
  }
  if (decisionKey) lockedGroups.push([decisionKey, heading, row, title]);
  group.append(heading, row);
  controls.append(group);
}

const won = value => `${Math.round(value / 1e8).toLocaleString('ko-KR')}억`;
function show(state) {
  for (const [button, isPressed] of pressedChecks) button.setAttribute('aria-pressed', String(isPressed()));
  for (const [key, heading, row, title] of lockedGroups) {
    const locked = isDecisionLocked(key);
    heading.textContent = locked ? `${title} · 오늘 결정함` : title;
    for (const button of row.querySelectorAll('button')) button.disabled = locked;
  }
  const { date } = state.time;
  const summary = state.operations.summary;
  const dormText = Object.values(summary.dorms).map(dorm => `${dorm.name} 대기 ${dorm.waiting}명`).join(', ');
  document.querySelector('#dev-status').textContent =
    `${date.year}년 ${date.month}월 ${date.day}일 · 만족도 ${state.metrics.satisfaction} · 평판 ${state.metrics.reputation} · 예산 ${won(state.metrics.budget)} · 편의성 ${summary.convenience} · 주거 만족도 ${summary.housing} · ${dormText}`;
  document.querySelector('#dev-issues').replaceChildren(...Object.values(state.reactions.issues).map(issue => {
    const chip = document.createElement('span');
    chip.className = issue.kind === 'praise' ? 'praise' : '';
    const detail = issue.values.building ? ` · ${issue.values.building}` : '';
    const level = issue.level ? ' (심각)' : '';
    chip.textContent = `${issue.kind === 'praise' ? '칭찬' : '민원'} · ${issue.cause}${detail}${level}`;
    return chip;
  }));
  document.querySelector('#dev-log').replaceChildren(...state.reactions.feed.slice().reverse().map(reaction => {
    const item = document.createElement('li');
    const head = document.createElement('b');
    head.textContent = `${reaction.date.month}/${reaction.date.day} [${reaction.priority || PRIORITY_NOTE[reaction.kind]}] ${reaction.who} ${reaction.year}학년 · ${reaction.cause} — `;
    item.append(head, reaction.text ?? '');
    return item;
  }));
}
subscribe(show);
show(getState());
console.info(`[reactions] 민원·칭찬 조건 ${config.rules.length}개, 학사 일정 ${config.calendar.length}개`);
