import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameStore,semesterOf} from '../src/game/store.js';
const config=JSON.parse(fs.readFileSync(new URL('../public/data/game.json',import.meta.url)));
function memory(){const items=new Map();return {getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,v)};}

test('공통 지표 변경, 읽기 전용 상태, 중복 효과, 저장·불러오기',()=>{
 const storage=memory(),game=createGameStore({config,storage});game.registerArea('example',()=>({value:1}));game.startGame();
 assert.throws(()=>{game.getState().metrics.budget=0;},TypeError);
 assert.equal(game.applyEffect({id:'test:once',budget:-80000000,satisfaction:6}),true);
 assert.equal(game.applyEffect({id:'test:once',budget:-80000000}),false);
 assert.equal(game.getState().metrics.budget,1200000000);assert.equal(game.getState().metrics.satisfaction,82);
 game.advanceDays(7);game.saveGame();const date=game.getState().time.date;
 const restored=createGameStore({config,storage});restored.registerArea('example',()=>({value:0}));restored.startGame();
 assert.deepEqual(restored.getState().time.date,date);assert.equal(restored.getState().metrics.budget,1200000000);assert(restored.getState().time.paused);
 assert.equal(restored.applyEffect({id:'test:once',budget:-1}),false);
 assert.equal(semesterOf({year:2027,month:1}),'2026-2');
});

test('학기 경계 정산은 모든 수입·지출 후 한 번 종료되고 장부가 일치한다',()=>{
 const storage=memory();const cfg={...config,initialDate:{year:2026,month:8,day:30}};
 const game=createGameStore({config:cfg,storage});let ends=0;
 game.onSettlement(({semester})=>game.applyEffect({id:`test:income:${semester}`,budget:30000000000,reason:'등록금 테스트'}));
 game.onSettlementEnd(()=>{ends++;assert.equal(game.getState().metrics.budget,config.initialMetrics.budget+5000000000);});
 game.startGame();game.advanceDays(2);assert.equal(ends,1);assert.equal(game.getState().time.semester,'2026-2');
 game.loadGame();game.advanceDays(1);assert.equal(ends,1);assert.equal(game.getState().settled.length,1);
 assert.equal(game.getState().metrics.budget,game.getState().initialBudget+game.getState().ledger.reduce((s,e)=>s+e.budget,0));
});

test('정산 또는 저장 실패 시 날짜·예산·장부가 함께 복원된다',()=>{
 const storage=memory(),game=createGameStore({config:{...config,initialDate:{year:2026,month:8,day:31}},storage});game.startGame();const before=game.getState();
 game.onSettlement(()=>{game.applyEffect({id:'partial',budget:100});throw new Error('settlement failure');});
 assert.throws(()=>game.advanceDays(1),/settlement failure/);assert.equal(game.getState(),before);
 storage.setItem=()=>{throw new Error('quota');};assert.throws(()=>game.applyEffect({id:'save-failure',budget:1}),/quota/);assert.equal(game.getState(),before);
});

test('실제 운영·민원 모듈이 한 상태에서 연결되고, 학기 계획은 학기 첫날 적용되며 반응은 그다음 날 나온다',async()=>{
 globalThis.localStorage=memory();
 globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url))});
 const api=await import('../src/game/index.js');const operations=await import('../src/operations/index.js');const reactions=await import('../src/reactions/index.js');
 await api.initGame();await Promise.all([operations.initOperations(),reactions.initReactions()]);api.startGame();
 assert(!operations.setFeeLevelPlan('high'),'결정 기간 전에는 계획 불가');
 while(!operations.planning().open)api.advanceDays(1);
 assert.deepEqual(api.getState().time.date,{year:2026,month:8,day:2});
 const summary=api.getState().operations.summary;
 assert(operations.setFeeLevelPlan('high'));assert(!operations.setFeeLevelPlan('low'),'같은 날 다시 고칠 수 없음');
 assert.equal(api.getState().operations.feeLevel,null,'이번 학기 운영은 그대로');assert.equal(api.getState().operations.summary,summary);
 api.advanceDays(1);assert(operations.setFeeLevelPlan('low'),'다음 날 다시 고칠 수 있음');
 while(api.getState().time.semester==='2026-1')api.advanceDays(1);
 assert.deepEqual(api.getState().time.date,{year:2026,month:9,day:1});
 assert.equal(api.getState().operations.feeLevel,'low');assert.equal(api.getState().operations.summary.feeLevel,'low');
 const applied=api.getState().reactions.seq;
 api.advanceDays(1);const added=api.getState().reactions.feed.filter(r=>r.seq>applied);assert(added.some(r=>r.type.startsWith('dorm.')),'적용 다음 날 기숙사 반응');
 const s=api.getState();assert(s.settled.includes('2026-1'));assert(s.ledger.some(e=>e.source==='operations'));
 assert.equal(s.metrics.budget,s.initialBudget+s.ledger.reduce((n,e)=>n+e.budget,0));
});

test('속도는 1배·2배만 지원하고 예전 저장의 다른 속도는 1배로 불러온다',()=>{
 const storage=memory(),game=createGameStore({config,storage});game.startGame();
 game.setSpeed(2);assert.equal(game.getState().time.speed,2);
 assert.throws(()=>game.setSpeed(4),/속도/);assert.throws(()=>game.setSpeed(12),/속도/);
 const saved=JSON.parse(storage.getItem('words-to-world:save'));saved.state.time.speed=12;storage.setItem('words-to-world:save',JSON.stringify(saved));
 const restored=createGameStore({config,storage});restored.startGame();assert.equal(restored.getState().time.speed,1);
});
