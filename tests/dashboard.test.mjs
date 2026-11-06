import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {metricHistory}from '../src/game/historyModel.js';
import {careEffect}from '../src/decisions/care.js';
import {festivalSeason}from '../src/festival/season.js';
const events=JSON.parse(fs.readFileSync(new URL('../public/data/decisions.json',import.meta.url))).events;
test('추이 차트는 실제 장부로 시초·고가·저가·종가를 복원하고 빈 날짜를 유지한다',()=>{
 const state={metrics:{budget:110,satisfaction:80,reputation:70},time:{date:{year:2026,month:3,day:5}},ledger:[{date:{year:2026,month:3,day:3},budget:-20},{date:{year:2026,month:3,day:3},budget:30}]};
 const points=metricHistory(state,'budget','all',{year:2026,month:3,day:3});
 assert.deepEqual(points[0],{date:'2026-03-03',open:100,high:110,low:80,close:110});assert.equal(points.length,3);assert.equal(points[2].close,110);
 assert.equal(metricHistory(state,'budget',1,{year:2026,month:3,day:3})[0].open,110);
});
test('높은 지표는 매일 자연 하락하고 예산은 바뀌지 않는다',()=>{
 const state={metrics:{satisfaction:100,reputation:100},time:{dayCount:1,date:{year:2026,month:3,day:4}},ledger:[],decisions:{released:[],scheduled:[]}};
 const effect=careEffect(events,state);assert.equal(effect.satisfaction,-.3);assert.equal(effect.reputation,-.2);assert.equal(effect.budget,undefined);
 state.metrics={satisfaction:76,reputation:68};assert.equal(careEffect(events,state),null);
});
test('7일 지난 미처리 요청은 감점하되 조치 예정과 완료 안건은 방치로 보지 않는다',()=>{
 const event=events[0],state={metrics:{satisfaction:76,reputation:68},time:{dayCount:7,date:{year:2026,month:3,day:10}},ledger:[],decisions:{released:[event.id],releasedOn:{[event.id]:0},scheduled:[]}};
 assert.equal(careEffect(events,state).satisfaction,-.75);assert.equal(careEffect(events,state).reputation,-.4);
 state.decisions.scheduled=[{eventId:event.id,choiceId:event.choices[0].id}];assert.equal(careEffect(events,state),null);
 state.decisions.scheduled=[];state.time.dayCount=6;assert.equal(careEffect(events,state),null);
});
test('축제 입장은 게임 시즌 경계에서만 활성화한다',()=>{
 const schedule=JSON.parse(fs.readFileSync(new URL('../public/data/festival-schedule.json',import.meta.url)));
 assert.equal(festivalSeason({month:5,day:17},schedule),null);assert.equal(festivalSeason({month:5,day:18},schedule).id,'spring');assert.equal(festivalSeason({month:5,day:22},schedule).id,'spring');assert.equal(festivalSeason({month:5,day:23},schedule),null);
});
