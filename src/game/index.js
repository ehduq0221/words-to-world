// 3단계 게임 기능의 공개 진입점. 다른 기능은 이 파일에서만 가져옵니다.
// 공통 약속의 게임 상태 함수(registerArea, applyEffect 등)는 이후 이 파일에 추가합니다.
import { parseDate } from './calendar.js';
import { createCalendarView } from './calendarView.js';

const DATA_URL = new URL('../../public/data/game.json', import.meta.url);

// 상단 날짜 영역에 학사 일정 달력을 연결합니다. 게임 시간 진행 전에는 startDate를 오늘로 표시합니다.
export async function initCalendar() {
  const trigger = document.querySelector('#game-date');
  const panel = document.querySelector('#game-calendar');
  if (!trigger || !panel) return null;
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error(`학사 일정을 불러오지 못했습니다: ${response.status}`);
  const data = await response.json();
  return createCalendarView({
    trigger,
    panel,
    label: trigger.querySelector('#game-date-label'),
    sub: trigger.querySelector('#game-date-sub'),
    events: data.calendar.events,
    source: data.calendar.source,
    today: parseDate(data.startDate),
  });
}
