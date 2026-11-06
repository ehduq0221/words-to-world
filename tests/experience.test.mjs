import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameStore} from '../src/game/store.js';
import {requestGoal,feedbackText} from '../src/experience/model.js';
import {decide} from '../src/decisions/model.js';
const config=JSON.parse(fs.readFileSync(new URL('../public/data/game.json',import.meta.url)));
const makeStore=()=>createGameStore({config,storage:{getItem:()=>null,setItem:()=>{}}});
test('목표 보상은 예산을 바꾸지 않고 만족도·평판만 한 번 올린다',()=>{
 const api=makeStore();api.startGame();for(let i=0;i<3;i++)api.applyEffect({id:'test:'+i,source:'decisions'});
 const before=api.getState().metrics,goal=requestGoal(api.getState());assert(goal.effect);
 api.applyEffect(goal.effect);assert.equal(requestGoal(api.getState()).effect,null);assert.equal(api.applyEffect(goal.effect),false);
 assert.deepEqual(api.getState().metrics,{...before,satisfaction:77,reputation:70});
 assert.equal(feedbackText(api.getState().ledger.at(-1)),'학생 만족도 +1 · 학교 평판 +2');assert.equal(api.getState().ledger.at(-1).budget,0);
 api.advanceDays(30);assert.equal(requestGoal(api.getState()).count,0);
});
test('학생 요청에서 양수 예산 보상을 지급할 수 없다',()=>{
 const api=makeStore();api.startGame();const before=api.getState();
 assert.throws(()=>decide({id:'invalid',choices:[{id:'reward',effect:{budget:5000000,satisfaction:1}}]},'reward',api),/만족도와 평판/);
 assert.equal(api.getState(),before);
});
