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
