// dev.html 전용. 3단계가 합쳐지면 stubGame.js와 함께 삭제합니다.
// 4단계 운영 기능 대신 operations.summary 형태의 값을 직접 만들어 민원 조건을 확인합니다.
import { startGame, getState, subscribe, registerArea, updateArea, applyEffect, devAdvanceDays } from './stubGame.js';
import { initReactions, addReaction, registerDialogues } from './index.js';

const dorm = (id, name, buildingId, capacity, waiting) => ({ buildingId, name, capacity, openBeds: capacity, applicants: capacity + waiting, occupants: capacity, waiting, emptyBeds: 0, fee: 928000 });
registerArea('operations', () => ({
  summary: {
    convenience: 72,
    housing: 70,
    feeLevel: 'normal',
    dorms: {
      'dorm-2': dorm('dorm-2', '제2기숙사', 'way/895812320', 1130, 270),
      'dorm-3': dorm('dorm-3', '제3기숙사', 'way/1394978434', 1000, 0),
    },
    facilities: {
      'welfare-cafeteria': { buildingId: 'way/367504010', name: '학생식당', type: 'cafeteria', mode: 'direct', convenience: 85 },
    },
  },
}));
const ready = initReactions();
await startGame();
await ready;
registerDialogues([
  { type: 'festival.after', text: '{building}에서 본 축제 무대가 정말 좋았어요!' },
  { type: 'festival.after', text: '올해 축제 라인업 최고였어요. 내년에도 기대할게요!' },
]);

const setSummary = change => updateArea('operations', area => ({ ...area, summary: change(area.summary) }));
const setDorm2Waiting = waiting => setSummary(summary => ({
  ...summary,
  dorms: { ...summary.dorms, 'dorm-2': { ...summary.dorms['dorm-2'], waiting, applicants: 1130 + waiting } },
}));
let effectCount = 0;
const groups = [
  ['제2기숙사 입사 대기', [['0명', () => setDorm2Waiting(0)], ['270명', () => setDorm2Waiting(270)], ['400명', () => setDorm2Waiting(400)]]],
  ['기숙사비', [['현재 요금', () => setSummary(s => ({ ...s, feeLevel: 'normal' }))], ['인상', () => setSummary(s => ({ ...s, feeLevel: 'high' }))]]],
  ['복지회관 학생식당', [
    ['직접 운영', () => setSummary(s => ({ ...s, facilities: { 'welfare-cafeteria': { ...s.facilities['welfare-cafeteria'], mode: 'direct' } } }))],
    ['임대', () => setSummary(s => ({ ...s, facilities: { 'welfare-cafeteria': { ...s.facilities['welfare-cafeteria'], mode: 'lease' } } }))],
  ]],
  ['학생 편의성', [['72', () => setSummary(s => ({ ...s, convenience: 72 }))], ['60', () => setSummary(s => ({ ...s, convenience: 60 }))]]],
  ['학생 만족도', [
    ['−20', () => applyEffect({ id: `dev:satisfaction:${++effectCount}`, satisfaction: -20, reason: '개발용 하락' })],
    ['+20', () => applyEffect({ id: `dev:satisfaction:${++effectCount}`, satisfaction: 20, reason: '개발용 상승' })],
  ]],
  ['시간', [['+7일', () => devAdvanceDays(7)], ['+28일', () => devAdvanceDays(28)]]],
  ['다른 기능의 반응', [['축제 후 반응', () => addReaction({ type: 'festival.after', buildingId: 'way/367512818', cause: '축제', values: { building: '대운동장' } })]]],
];
const controls = document.querySelector('#dev-controls');
for (const [title, buttons] of groups) {
  const group = document.createElement('div');
  group.className = 'dev-group';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const row = document.createElement('div');
  for (const [label, action] of buttons) {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', action);
    row.append(button);
  }
  group.append(heading, row);
  controls.append(group);
}

function show(state) {
  const { date } = state.time;
  const summary = state.operations.summary;
  document.querySelector('#dev-status').textContent =
    `${date.year}년 ${date.month}월 ${date.day}일 · 만족도 ${state.metrics.satisfaction} · 제2기숙사 대기 ${summary.dorms['dorm-2'].waiting}명 · 기숙사비 ${summary.feeLevel} · 학생식당 ${summary.facilities['welfare-cafeteria'].mode} · 편의성 ${summary.convenience} · 진행 중 민원 ${Object.keys(state.reactions.issues).length}건`;
  document.querySelector('#dev-log').replaceChildren(...state.reactions.feed.slice().reverse().map(reaction => {
    const item = document.createElement('li');
    item.textContent = `${reaction.date ? `${reaction.date.month}/${reaction.date.day}` : ''} [${reaction.kind}] ${reaction.who} ${reaction.year}학년 · ${reaction.text}`;
    return item;
  }));
}
subscribe(show);
show(getState());
