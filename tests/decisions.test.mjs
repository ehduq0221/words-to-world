import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as model from '../src/decisions/model.js';
import { createGameStore } from '../src/game/store.js';
const config=JSON.parse(fs.readFileSync(new URL('../public/data/game.json',import.meta.url)));
const data = JSON.parse(fs.readFileSync(new URL('../public/data/decisions.json', import.meta.url)));
const campus = JSON.parse(fs.readFileSync(new URL('../public/data/campus.json', import.meta.url)));

test('모든 이벤트는 존재하는 대표 건물과 세 가지 대응에 연결된다', () => {
  const ids = new Set(campus.buildings.map(b => b.selectionGroupId || b.id));
  assert.equal(new Set(data.events.map(event => event.id)).size, data.events.length);
  for (const event of data.events) {
    assert(ids.has(event.buildingId));
    assert.equal(event.choices.length, 3);
    assert.equal(new Set(event.choices.map(choice => choice.id)).size, 3);
    assert(event.choices.every(choice => Object.values(choice.effect).every(Number.isFinite)));
  }
});

test('조치는 결정한 날 예정으로만 기록되고 다음 날 한 번만 반영되며 복원 후에도 바꿀 수 없다', async () => {
  let saved = null;
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const area = () => ({ opened: [], released: null, nextEventDay: null, scheduled: [], rounds: {}, lastDone: {}, failed: {} });
  const api = createGameStore({config,storage:localStorage});
  api.registerArea('decisions', area);
  api.startGame();
  const computer = data.events.find(event => event.id === 'slow-computers');
  assert.equal(model.decide(computer, 'replace', api, data.events), true);
  assert.deepEqual(api.getState().metrics, config.initialMetrics, '결정한 날에는 지표가 그대로');
  assert.equal(model.scheduledChoice(computer, api.getState()).choiceId, 'replace');
  assert.equal(model.decide(computer, 'repair', api, data.events), false, '한 번 결정한 안건은 바꿀 수 없음');
  assert.deepEqual(model.applyDue(data.events, api), [], '같은 날에는 반영하지 않음');
  api.advanceDays(1);
  assert.equal(model.applyDue(data.events, api).length, 1);
  assert.deepEqual(api.getState().metrics, { budget: 1200000000, satisfaction: 82, reputation: 68 });
  assert.equal(model.applyDue(data.events, api).length, 0, '한 번만 반영');
  assert.equal(api.getState().ledger.length, 1);
  assert(!model.activeEvents(data.events, api.getState(), 5).includes(computer));
  const restored = createGameStore({config,storage:localStorage});
  restored.registerArea('decisions', area);
  restored.startGame();
  assert.equal(model.decide(computer, 'defer', restored, data.events), false);
  assert.equal(restored.getState().metrics.budget, 1200000000);
  assert.equal(model.effectText(restored.getState().ledger[0]), '예산 −8,000만 · 만족도 +6');
  assert.equal(model.eventIdOf(restored.getState().ledger[0].id), 'slow-computers');
});

test('예정된 지출까지 고려해 예산이 부족하면 결정할 수 없고, 반영 날 부족하면 결정 대기로 돌아간다', () => {
  const storage = { items: new Map(), getItem(k) { return this.items.get(k) || null; }, setItem(k, v) { this.items.set(k, v); } };
  const api = createGameStore({ config: { ...config, initialMetrics: { ...config.initialMetrics, budget: 90000000 } }, storage });
  api.registerArea('decisions', () => ({ opened: [], released: null, nextEventDay: null, scheduled: [], rounds: {}, lastDone: {}, failed: {} }));
  api.startGame();
  const computer = data.events.find(event => event.id === 'slow-computers');
  const lab = data.events.find(event => event.id === 'lab-safety');
  assert.equal(model.decide(computer, 'replace', api, data.events), true);
  const expensive = lab.choices.reduce((a, b) => (a.effect.budget < b.effect.budget ? a : b));
  assert.throws(() => model.decide(lab, expensive.id, api, data.events), /예산이 부족/);
  api.applyEffect({ id: 'test:spend', budget: -50000000 });
  api.advanceDays(1);
  assert.equal(model.applyDue(data.events, api).length, 0);
  assert.match(api.getState().decisions.failed['slow-computers'], /예산이 부족/);
  assert.equal(model.scheduledChoice(computer, api.getState()), null, '다시 결정 대기');
});

test('조치를 마친 안건은 cooldownDays가 지나야 다음 회차로 다시 공개된다', () => {
  const computer = data.events.find(event => event.id === 'slow-computers');
  const schedule = { ...data.schedule, initialCount: 0, minDays: 1, maxDays: 1 };
  const only = [computer];
  const state = { time: { dayCount: 5 }, ledger: [{ id: model.effectId(computer, computer.choices[0]) }],
    decisions: { opened: ['slow-computers'], released: ['slow-computers'], nextEventDay: 6, scheduled: [], rounds: {}, lastDone: { 'slow-computers': 5 }, failed: {} } };
  state.time.dayCount = 5 + schedule.cooldownDays - 1;
  state.decisions = model.releaseDueEvent(only, state, 3, schedule, () => 0);
  assert.equal(model.activeEvents(only, state, 3).length, 0, '아직 다시 생기지 않음');
  state.time.dayCount = 5 + schedule.cooldownDays;
  state.decisions = { ...state.decisions, nextEventDay: state.time.dayCount };
  state.decisions = model.releaseDueEvent(only, state, 3, schedule, () => 0);
  assert.equal(state.decisions.rounds['slow-computers'], 1);
  assert.deepEqual(model.activeEvents(only, state, 3), [computer], '다음 회차로 다시 결정 대기');
  assert(!state.decisions.opened.includes('slow-computers'), '지난 카드는 목록에서 내림');
  assert.equal(model.effectId(computer, computer.choices[1], 1), 'decisions:slow-computers#2:repair');
  assert.equal(model.eventIdOf('decisions:slow-computers#2:repair'), 'slow-computers');
});

test('랜덤 이벤트는 10~20일 간격이고 처리 직후 보충하지 않는다', () => {
  const state={time:{dayCount:0},ledger:[],decisions:{opened:[],released:null,nextEventDay:null}};
  state.decisions=model.initializeSchedule(data.events,state,3,data.schedule,()=>0);
  assert.equal(model.activeEvents(data.events,state,3).length,1);
  assert.equal(state.decisions.nextEventDay,10);
  state.time.dayCount=9;assert.equal(model.releaseDueEvent(data.events,state,3,data.schedule,()=>0),null);
  const first=model.activeEvents(data.events,state,3)[0];state.ledger.push({id:model.effectId(first,first.choices[0])});
  assert.equal(model.activeEvents(data.events,state,3).length,0);
  state.time.dayCount=10;state.decisions=model.releaseDueEvent(data.events,state,3,data.schedule,()=>.99999);
  assert.equal(model.activeEvents(data.events,state,3).length,1);assert.equal(state.decisions.nextEventDay,30);
  assert(!model.activeEvents(data.events,state,3).includes(first));
  const restored=JSON.parse(JSON.stringify(state));assert.equal(model.initializeSchedule(data.events,restored,3,data.schedule,()=>0),null);
  assert.equal(restored.decisions.nextEventDay,30);
});

test('이벤트 상한이면 일정을 미루며 기존 저장도 최대 3개로 이어진다', () => {
  const state={time:{dayCount:50},ledger:[],decisions:{opened:data.events.slice(0,5).map(e=>e.id),released:null}};
  state.decisions=model.initializeSchedule(data.events,state,3,data.schedule,()=>0);
  assert.equal(model.activeEvents(data.events,state,3).length,3);
  const before=[...state.decisions.released];state.time.dayCount=60;
  state.decisions=model.releaseDueEvent(data.events,state,3,data.schedule,()=>0);
  assert.deepEqual(state.decisions.released,before);assert.equal(state.decisions.nextEventDay,70);
  state.ledger.push({id:model.effectId(data.events[0],data.events[0].choices[0])});
  assert.equal(model.activeEvents(data.events,state,3).length,2);
  assert.equal(model.releaseDueEvent(data.events,state,3,data.schedule,()=>0),null);
  state.time.dayCount=70;state.decisions=model.releaseDueEvent(data.events,state,3,data.schedule,()=>0);
  assert.equal(model.activeEvents(data.events,state,3).length,3);
  assert.equal(new Set(state.decisions.released).size,state.decisions.released.length);
});
