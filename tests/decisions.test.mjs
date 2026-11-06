import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as model from '../src/decisions/model.js';
const data = JSON.parse(fs.readFileSync(new URL('../public/data/decisions.json', import.meta.url)));
const campus = JSON.parse(fs.readFileSync(new URL('../public/data/campus.json', import.meta.url)));
const date = (month, day) => ({ year: 2026, month, day });

test('모든 안건은 존재하는 대표 건물과 세 가지 조치에 연결된다', () => {
  const ids = new Set(campus.buildings.map(b => b.selectionGroupId || b.id));
  assert.equal(new Set(data.events.map(event => event.id)).size, data.events.length);
  for (const event of data.events) {
    assert(ids.has(event.buildingId));
    assert.equal(event.choices.length, 3);
    assert.equal(new Set(event.choices.map(choice => choice.id)).size, 3);
    assert(event.choices.every(choice => Object.values(choice.effect).every(Number.isFinite)));
  }
  assert(data.initialCount <= data.activeLimit && data.spawnChance > 0 && data.spawnChance <= 1);
});

test('조치는 결정한 날 반영되지 않고 다음 날 한 번만 반영된다', () => {
  let area = model.createInitialArea(data);
  const issue = area.issues.find(item => item.eventId === 'slow-computers');
  const result = model.schedule(area, data, issue.key, 'replace', { date: date(3, 2), budget: 1280000000 });
  assert.equal(result.changed, true);
  area = result.area;
  assert.equal(area.issues.find(item => item.key === issue.key).status, 'scheduled');
  assert.equal(model.dueIssues(area).length, 0, '결정한 날에는 반영 대상이 아님');
  assert.equal(model.schedule(area, data, issue.key, 'repair', { date: date(3, 2), budget: 1280000000 }).changed, false, '한 번 결정한 안건은 바꿀 수 없음');
  area = { ...area, dayCount: area.dayCount + 1 };
  assert.deepEqual(model.dueIssues(area).map(item => item.key), [issue.key]);
  area = model.markDone(area, issue.key, date(3, 3));
  assert.equal(model.dueIssues(area).length, 0);
  assert.equal(model.markerIssues(area, data.activeLimit).some(item => item.key === issue.key), false);
});

test('예정된 지출까지 고려해 예산이 부족하면 결정할 수 없다', () => {
  let area = model.createInitialArea(data);
  const [first, second] = area.issues;
  const expensive = event => event.choices.reduce((a, b) => (a.effect.budget < b.effect.budget ? a : b));
  const firstChoice = expensive(data.events.find(e => e.id === first.eventId));
  const budget = -firstChoice.effect.budget + 1;
  area = model.schedule(area, data, first.key, firstChoice.id, { date: date(3, 2), budget }).area;
  const secondChoice = expensive(data.events.find(e => e.id === second.eventId));
  const result = model.schedule(area, data, second.key, secondChoice.id, { date: date(3, 2), budget });
  assert.match(result.error, /예산이 부족/);
  assert.equal(result.changed, false);
});

test('안건은 같은 seed에서 같은 순서로 생기고, 진행 중 안건은 최대 activeLimit개다', () => {
  const run = () => {
    let area = model.createInitialArea(data);
    const keys = [];
    for (let day = 0; day < 120; day++) {
      area = { ...area, dayCount: area.dayCount + 1 };
      area = model.spawn(area, data, date(3, 2));
      assert(area.issues.filter(issue => issue.status !== 'done').length <= data.activeLimit);
      keys.push(area.issues.map(issue => issue.key).join(','));
    }
    return keys;
  };
  assert.deepEqual(run(), run());
});

test('조치를 마친 안건은 cooldownDays가 지나야 다시 생긴다', () => {
  let area = model.createInitialArea({ ...data, initialCount: 1 });
  const issue = area.issues[0];
  area = model.schedule(area, data, issue.key, data.events[0].choices[0].id, { date: date(3, 2), budget: 1e10 }).area;
  area = { ...area, dayCount: 1 };
  area = model.markDone(area, issue.key, date(3, 3));
  const only = { ...data, events: [data.events[0]], spawnChance: 1 };
  let next = model.spawn({ ...area, dayCount: 1 + data.cooldownDays - 1 }, only, date(4, 1));
  assert.equal(next.issues.filter(item => item.status === 'open').length, 0);
  next = model.spawn({ ...area, dayCount: 1 + data.cooldownDays }, only, date(4, 20));
  assert.equal(next.issues.filter(item => item.status === 'open').length, 1);
});

test('임시 구현은 결과를 저장·복원하고 같은 효과를 두 번 반영하지 않는다', async () => {
  let saved = null;
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const api = await import('../src/decisions/stubGame.js?test=primary');
  api.registerArea('decisions', () => model.createInitialArea(data));
  api.startGame();
  assert.equal(api.applyEffect({ id: 'decisions:a#1:x', budget: -80000000, satisfaction: 6 }), true);
  assert.equal(api.applyEffect({ id: 'decisions:a#1:x', budget: -80000000 }), false);
  api.advanceDay();
  assert.deepEqual(api.getState().time.date, date(3, 3));
  const restored = await import('../src/decisions/stubGame.js?test=restored');
  restored.registerArea('decisions', () => model.createInitialArea(data));
  restored.startGame();
  assert.deepEqual(restored.getState().time.date, date(3, 3));
  assert.equal(restored.getState().metrics.budget, 1200000000);
  assert.equal(model.effectText(restored.getState().ledger[0]), '예산 −8,000만 · 만족도 +6');
  const before = restored.getState();
  assert.throws(() => restored.applyEffect({ id: 'expensive', budget: -2000000000 }), /예산/);
  assert.equal(restored.getState(), before);
});
