import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlan, validatePlan, totalCost, readPlans, writePlans, PLAN_KEY } from './plans.js';
const data = JSON.parse(readFileSync(new URL('../../public/data/festival.json', import.meta.url)));
const memory = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };
test('라인업 상한·중복·알 수 없는 후보와 잘못된 예산을 거부한다', () => {
  const p = createPlan(data); assert.ok(validatePlan(p, data));
  for (const patch of [{ artistIds: data.artists.slice(0, 4).map(a => a.id) }, { artistIds: ['sunset-letter', 'sunset-letter'] }, { artistIds: ['unknown'] }, { budget: -1 }, { budget: 1.5 }, { venueId: 'unknown' }, { name: '' }]) assert.ok(!validatePlan({ ...p, ...patch }, data));
});
test('저장·재불러오기에 순서·장소·구성과 예산을 유지하고 원본과 분리한다', () => {
  const p = createPlan(data), storage = memory();
  p.artistIds = ['wave-nine', 'sunset-letter', 'neon-us'];
  writePlans([p], data, storage);
  const loaded = readPlans(data, storage);
  assert.deepEqual(loaded, [p]); loaded[0].artistIds.reverse();
  assert.deepEqual(readPlans(data, storage)[0].artistIds, p.artistIds);
  assert.equal(totalCost(p, data), 56500000);
  writePlans([], data, storage); assert.deepEqual(readPlans(data, storage), []);
});
test('손상 데이터·중복 ID·버전 불일치를 자동 덮어쓰지 않는다', () => {
  const storage = memory(), p = createPlan(data);
  for (const raw of ['{', JSON.stringify({ version: 2, plans: [] }), JSON.stringify({ version: 1, plans: [p, p] })]) {
    storage.setItem(PLAN_KEY, raw); assert.throws(() => readPlans(data, storage)); assert.equal(storage.getItem(PLAN_KEY), raw);
  }
});

test('폭죽은 선택된 공연 구간에만 저장되며 비용을 합산한다', () => {
  const p = createPlan(data); p.artistIds = ['hanroro', 'ive']; p.fireworks = ['opening', 'between-1-2', 'finale'];
  assert.ok(validatePlan(p, data));
  const plain = { ...p, fireworks: [] };
  assert.equal(totalCost(p, data) - totalCost(plain, data), 3 * data.fireworkCost);
  assert.ok(!validatePlan({ ...p, fireworks: ['between-2-3'] }, data));
  assert.ok(!validatePlan({ ...p, fireworks: ['opening', 'opening'] }, data));
  const storage = memory(); writePlans([p], data, storage); assert.deepEqual(readPlans(data, storage)[0].fireworks, p.fireworks);
});
test('제공 차트 기반 예시와 초록 위치 데이터가 유효하다', () => {
  for (const preset of data.presets) assert.ok(validatePlan({ ...createPlan(data), ...preset, extras: ['booths', 'lights', 'confetti'] }, data));
  const campus = JSON.parse(readFileSync(new URL('../../public/data/campus.json', import.meta.url)));
  for (const venue of data.venues.filter(v => !v.archived)) assert.ok(campus.buildings.some(b => b.id === venue.anchorBuildingId));
});
test('공연 사이와 마지막 공연 종료가 폭죽 타이밍으로 분리된다', async () => {
  const { buildTimeline } = await import('./timeline.js');
  const timeline = buildTimeline(3);
  assert.equal(timeline.length, 66);
  assert.equal(timeline.fireworkTimes.opening, 4);
  assert.equal(timeline.fireworkTimes['between-1-2'], 20.2);
  assert.equal(timeline.fireworkTimes['between-2-3'], 39.2);
  assert.equal(timeline.fireworkTimes.finale, 58.2);
  assert.equal(buildTimeline(1).fireworkTimes['between-1-2'], undefined);
});

test('폭죽 위치를 저장하고 알 수 없는 위치는 거부한다', () => {
  const p = createPlan(data); p.fireworkPosition = 'right-sky';
  const storage = memory(); writePlans([p], data, storage);
  assert.equal(readPlans(data, storage)[0].fireworkPosition, 'right-sky');
  assert.ok(!validatePlan({ ...p, fireworkPosition: 'unknown' }, data));
  const legacy = { ...p }; delete legacy.fireworkPosition; assert.ok(validatePlan(legacy, data));
});
test('같은 아이돌 연출도 가수별 무대·색·패턴을 다르게 사용한다', async () => {
  const { getArtistProfile } = await import('./profiles.js');
  const ive = getArtistProfile(data.artists.find(a => a.id === 'ive'));
  const rescene = getArtistProfile(data.artists.find(a => a.id === 'rescene'));
  assert.notDeepEqual(ive.colors, rescene.colors); assert.notEqual(ive.design, rescene.design);
  assert.notDeepEqual(ive.notes, rescene.notes); assert.notEqual(ive.formation, rescene.formation);
});

test('비트 판정은 템포와 반복 구간에 맞춰 성공·실패를 구분한다', async () => {
  const { judgeBeat } = await import('./participation.js');
  assert.equal(judgeBeat(300, 100).rating, 'PERFECT');
  assert.equal(judgeBeat(210, 100).rating, 'GOOD');
  assert.equal(judgeBeat(0, 100).rating, 'MISS');
  assert.equal(judgeBeat(-300, 100).rating, 'PERFECT');
  assert.equal(judgeBeat(150, 200).rating, 'PERFECT');
});

test('17·19·21시 공연의 배경을 시간대별로 구분한다', async () => {
  const { getPerformanceEnvironment } = await import('./environment.js');
  assert.equal(getPerformanceEnvironment('17:00').phase, 'sunset');
  assert.equal(getPerformanceEnvironment('19:00').phase, 'twilight');
  assert.equal(getPerformanceEnvironment('21:00').phase, 'night');
  assert.throws(() => getPerformanceEnvironment('invalid'));
});
