import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as calendar from '../src/game/calendar.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/game.json', import.meta.url)));
const events = data.calendar.events;

test('학사 일정 데이터는 올바른 날짜와 유형을 가진다', () => {
  assert(events.length > 0);
  for (const event of events) {
    assert.match(event.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(event.end, /^\d{4}-\d{2}-\d{2}$/);
    assert(event.start <= event.end, `${event.title}의 시작일이 종료일보다 늦습니다`);
    assert(['학사', '공휴일'].includes(event.type));
    assert(event.title.trim());
  }
  assert.match(data.startDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('게임 시작일은 1학기 개강일이다', () => {
  const start = calendar.parseDate(data.startDate);
  assert.equal(calendar.semesterOf(start), '2026-1');
  assert.deepEqual(calendar.eventsOn(events, start).map(event => event.title), ['제1학기 개강']);
});

test('여러 날에 걸친 일정은 기간 안의 모든 날짜와 걸친 달에 나온다', () => {
  const winter = events.find(event => event.title === '동계 계절학기' && event.start.startsWith('2026'));
  assert(calendar.eventsOn(events, { year: 2026, month: 12, day: 31 }).includes(winter));
  assert(calendar.eventsOn(events, { year: 2027, month: 1, day: 13 }).includes(winter));
  assert(!calendar.eventsOn(events, { year: 2027, month: 1, day: 14 }).includes(winter));
  assert(calendar.eventsInMonth(events, 2027, 1).includes(winter));
  assert.equal(calendar.formatPeriod(winter), '2026.12.22 – 2027.1.13');
});

test('공휴일과 학기 구분을 계산한다', () => {
  assert(calendar.isHoliday(events, { year: 2026, month: 5, day: 5 }));
  assert(!calendar.isHoliday(events, { year: 2026, month: 5, day: 6 }));
  assert.equal(calendar.semesterOf({ year: 2026, month: 9, day: 1 }), '2026-2');
  assert.equal(calendar.semesterOf({ year: 2027, month: 2, day: 1 }), '2026-2');
});

test('달력 칸은 일요일부터 시작하고 모든 날짜를 담는다', () => {
  const weeks = calendar.monthGrid(2026, 3);
  assert(weeks.every(week => week.length === 7));
  assert.deepEqual(weeks[0][0], { year: 2026, month: 3, day: 1 }); // 2026-03-01은 일요일
  assert.equal(weeks.flat().filter(Boolean).length, 31);
  assert.deepEqual(calendar.monthRange(events), { first: { year: 2026, month: 1 }, last: { year: 2027, month: 2 } });
  assert.deepEqual(calendar.shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
});
