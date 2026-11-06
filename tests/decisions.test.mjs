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

test('결과는 한 번만 반영되며 복원 후 다른 선택으로 중복 보상할 수 없다', async () => {
  let saved = null;
  globalThis.localStorage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const api = createGameStore({config,storage:localStorage});
  api.registerArea('decisions', () => ({ opened: [] }));
  api.startGame();
  const computer = data.events.find(event => event.id === 'slow-computers');
  assert.equal(model.decide(computer, 'replace', api), true);
  assert.deepEqual(api.getState().metrics, { budget: 1200000000, satisfaction: 82, reputation: 68 });
  assert.equal(model.decide(computer, 'repair', api), false);
  assert.equal(api.getState().ledger.length, 1);
  assert(!model.activeEvents(data.events, api.getState(), 5).includes(computer));
  const restored = createGameStore({config,storage:localStorage});
  restored.registerArea('decisions', () => ({ opened: [] }));
  restored.startGame();
  assert.equal(model.decide(computer, 'defer', restored), false);
  assert.equal(restored.getState().metrics.budget, 1200000000);
  assert.equal(model.effectText(restored.getState().ledger[0]), '예산 −8,000만 · 만족도 +6');
  const before = restored.getState();
  assert.throws(() => model.decide({...computer,id:'expensive',choices:[{id:'replace',effect:{budget:-2000000000}}]}, 'replace', restored), /예산/);
  assert.equal(restored.getState(), before);
  globalThis.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => restored.applyEffect({ id: 'storage-failure', budget: -1 }), /quota/);
  assert.equal(restored.getState(), before);
  globalThis.localStorage.setItem = (_, value) => { saved = value; };
  restored.applyEffect({ id: 'clamped', satisfaction: 100 });
  assert.equal(restored.getState().metrics.satisfaction, 100);
  assert.equal(restored.getState().ledger.at(-1).satisfaction, 18);
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
