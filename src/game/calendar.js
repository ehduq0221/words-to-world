// 학사 일정 계산. 화면과 분리해 테스트에서도 그대로 사용합니다.
// 날짜 문자열은 'YYYY-MM-DD' 형식이라 문자열 비교로 앞뒤를 판단할 수 있습니다.

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function parseDate(text) {
  const [year, month, day] = text.split('-').map(Number);
  return { year, month, day };
}

export function dateKey({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function weekdayOf({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// 3~8월은 1학기, 9~12월은 2학기, 1~2월은 전년도 2학기(겨울방학)로 봅니다.
export function semesterOf({ year, month }) {
  if (month >= 3 && month <= 8) return `${year}-1`;
  if (month >= 9) return `${year}-2`;
  return `${year - 1}-2`;
}

export function eventsOn(events, date) {
  const key = dateKey(date);
  return events.filter(event => event.start <= key && key <= event.end);
}

export function eventsInMonth(events, year, month) {
  const first = dateKey({ year, month, day: 1 });
  const last = dateKey({ year, month, day: daysInMonth(year, month) });
  return events
    .filter(event => event.start <= last && event.end >= first)
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

export function isHoliday(events, date) {
  return eventsOn(events, date).some(event => event.type === '공휴일');
}

// 일요일부터 시작하는 주 단위 칸. 앞뒤 빈칸은 null입니다.
export function monthGrid(year, month) {
  const cells = Array(weekdayOf({ year, month, day: 1 })).fill(null);
  for (let day = 1; day <= daysInMonth(year, month); day += 1) cells.push({ year, month, day });
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

// 일정 데이터가 있는 첫 달과 마지막 달
export function monthRange(events) {
  const starts = events.map(event => event.start).sort();
  const ends = events.map(event => event.end).sort();
  const first = parseDate(starts[0]);
  const last = parseDate(ends[ends.length - 1]);
  return { first: { year: first.year, month: first.month }, last: { year: last.year, month: last.month } };
}

export function shiftMonth({ year, month }, offset) {
  const index = year * 12 + (month - 1) + offset;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareMonth(a, b) {
  return (a.year * 12 + a.month) - (b.year * 12 + b.month);
}

export function formatPeriod(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const short = date => `${date.month}.${date.day}`;
  if (event.start === event.end) return `${short(start)} (${WEEKDAYS[weekdayOf(start)]})`;
  if (start.year !== end.year) return `${start.year}.${short(start)} – ${end.year}.${short(end)}`;
  return `${short(start)} – ${short(end)}`;
}
