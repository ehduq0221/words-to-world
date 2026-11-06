// dev.html 전용. 3단계가 합쳐지면 stubGame.js와 함께 삭제합니다.
import { startGame, getState, subscribe, devAdvanceDays } from './stubGame.js';
import { initOperations } from './index.js';
import { formatWon } from './menu.js';

const data = await (async () => {
  const ready = initOperations();
  await startGame();
  return ready;
})();

const campus = await (await fetch(new URL('../../public/data/campus.json', import.meta.url))).json();
const campusNames = new Map(campus.buildings.map(building => [building.id, building.name]));
const buildings = new Map();
for (const item of [...data.facilities, ...data.dorms]) {
  if (!buildings.has(item.buildingId)) buildings.set(item.buildingId, campusNames.get(item.buildingId) ?? item.buildingId);
}
const buildingList = document.querySelector('#dev-buildings');
for (const [buildingId, name] of buildings) {
  const button = document.createElement('button');
  button.textContent = name;
  button.addEventListener('click', () => {
    document.querySelector('#facility-actions').replaceChildren();
    window.dispatchEvent(new CustomEvent('campus:select', { detail: { buildingId, name } }));
  });
  buildingList.append(button);
}

document.querySelector('.dev-time').addEventListener('click', event => {
  const days = event.target.closest('[data-days]')?.dataset.days;
  if (!days) return;
  if (days !== 'semester') return devAdvanceDays(Number(days));
  const { semester } = getState().time;
  while (getState().time.semester === semester) devAdvanceDays(1);
});

function show(state) {
  const { date, semester } = state.time;
  const { budget, satisfaction, reputation } = state.metrics;
  document.querySelector('#dev-status').innerHTML = '';
  for (const text of [
    `${date.year}년 ${date.month}월 ${date.day}일 · ${semester} 정산 기간`,
    `예산 ${formatWon(budget)}원 · 만족도 ${Math.round(satisfaction * 10) / 10} · 평판 ${reputation}`,
  ]) {
    const line = document.createElement('span');
    line.textContent = text;
    document.querySelector('#dev-status').append(line);
  }
  const ledger = document.querySelector('#dev-ledger');
  ledger.replaceChildren(...state.ledger.slice().reverse().map(entry => {
    const item = document.createElement('li');
    const parts = [entry.budget ? `${formatWon(entry.budget, { sign: true })}원` : '', entry.satisfaction ? `만족도 ${entry.satisfaction > 0 ? '+' : ''}${entry.satisfaction}` : ''].filter(Boolean);
    item.textContent = `${entry.semester} · ${entry.reason} · ${parts.join(' · ')}`;
    return item;
  }));
}
subscribe(show);
show(getState());
