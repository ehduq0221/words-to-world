import {
  WEEKDAYS, compareMonth, dateKey, eventsInMonth, eventsOn, formatPeriod, isHoliday,
  monthGrid, monthRange, semesterOf, shiftMonth, weekdayOf,
} from './calendar.js';

const MAX_CHIPS = 2;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function typeClass(event) {
  return event.type === '공휴일' ? 'is-holiday' : 'is-academic';
}

// 상단 날짜 버튼과 학사 일정 달력 창을 연결합니다.
// 게임 시간 진행이 생기면 돌려받은 setDate(date)로 오늘 날짜를 바꿉니다.
export function createCalendarView({ trigger, label, sub, panel, events, source, today }) {
  const range = monthRange(events);
  let current = today;
  let shown = { year: today.year, month: today.month };
  let selected = null;

  function updateTrigger() {
    const semester = semesterOf(current).endsWith('-1') ? '1학기' : '2학기';
    const todays = eventsOn(events, current).map(event => event.title);
    label.textContent = `${current.year}년 ${current.month}월 ${current.day}일 (${WEEKDAYS[weekdayOf(current)]})`;
    sub.textContent = `${semester} · ${todays.length ? todays.join(', ') : '학사 일정 보기'}`;
    trigger.setAttribute('aria-label', `${label.textContent}, ${sub.textContent}. 학사 일정 달력 열기`);
  }

  function dayCell(date) {
    if (!date) return '<div class="calendar-day is-empty" aria-hidden="true"></div>';
    const key = dateKey(date);
    const dayEvents = eventsOn(events, date);
    const weekday = weekdayOf(date);
    const classes = ['calendar-day'];
    if (weekday === 0 || isHoliday(events, date)) classes.push('is-red');
    if (weekday === 6) classes.push('is-saturday');
    if (key === dateKey(current)) classes.push('is-today');
    if (selected && key === dateKey(selected)) classes.push('is-selected');
    // 여러 날 일정은 시작일·주의 첫날·달의 1일에만 제목을 쓰고 나머지 날은 이어지는 띠로 표시합니다.
    const chips = dayEvents.slice(0, MAX_CHIPS).map(event => {
      const labelled = event.start === key || weekday === 0 || date.day === 1;
      return labelled
        ? `<span class="calendar-chip ${typeClass(event)}">${escapeHtml(event.title)}</span>`
        : `<span class="calendar-chip is-continue ${typeClass(event)}" aria-hidden="true"></span>`;
    }).join('');
    const more = dayEvents.length > MAX_CHIPS ? `<span class="calendar-more">+${dayEvents.length - MAX_CHIPS}</span>` : '';
    const names = dayEvents.map(event => event.title).join(', ');
    const aria = `${date.month}월 ${date.day}일 ${WEEKDAYS[weekday]}요일${names ? `, ${names}` : ''}`;
    return `<button type="button" class="${classes.join(' ')}" data-date="${key}" aria-label="${escapeHtml(aria)}" aria-pressed="${classes.includes('is-selected')}">`
      + `<span class="calendar-number">${date.day}</span>${chips}${more}</button>`;
  }

  function eventList(list, emptyText) {
    if (!list.length) return `<p class="calendar-empty">${emptyText}</p>`;
    return `<ul class="calendar-list">${list.map(event => `<li class="${typeClass(event)}">`
      + `<span class="calendar-dot" aria-hidden="true"></span><b>${escapeHtml(event.title)}</b>`
      + `<time>${escapeHtml(formatPeriod(event))}</time></li>`).join('')}</ul>`;
  }

  function render() {
    const canPrev = compareMonth(shown, range.first) > 0;
    const canNext = compareMonth(shown, range.last) < 0;
    const detail = selected
      ? `<h3>${selected.month}월 ${selected.day}일 (${WEEKDAYS[weekdayOf(selected)]})</h3>${eventList(eventsOn(events, selected), '이날은 학사 일정이 없습니다.')}`
      : `<h3>${shown.month}월 학사 일정</h3>${eventList(eventsInMonth(events, shown.year, shown.month), '이달은 학사 일정이 없습니다.')}`;
    panel.innerHTML = `
      <div class="calendar-head">
        <button type="button" class="calendar-nav" data-move="-1" aria-label="이전 달" ${canPrev ? '' : 'disabled'}>‹</button>
        <h2 id="game-calendar-title">${shown.year}년 ${shown.month}월</h2>
        <button type="button" class="calendar-nav" data-move="1" aria-label="다음 달" ${canNext ? '' : 'disabled'}>›</button>
        <button type="button" class="calendar-today" data-today>오늘</button>
        <button type="button" class="calendar-close" data-close aria-label="달력 닫기">×</button>
      </div>
      <div class="calendar-legend"><span class="is-academic"><i></i>학사</span><span class="is-holiday"><i></i>공휴일</span></div>
      <div class="calendar-grid" role="group" aria-labelledby="game-calendar-title">
        ${WEEKDAYS.map((name, index) => `<div class="calendar-weekday${index === 0 ? ' is-red' : index === 6 ? ' is-saturday' : ''}">${name}</div>`).join('')}
        ${monthGrid(shown.year, shown.month).flat().map(dayCell).join('')}
      </div>
      <div class="calendar-detail" aria-live="polite">${detail}</div>
      <p class="calendar-source">출처: ${escapeHtml(source)}</p>`;
  }

  function open() {
    shown = { year: current.year, month: current.month };
    selected = null;
    render();
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (panel.querySelector('.calendar-day.is-today') || panel.querySelector('.calendar-day:not(.is-empty)'))?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }

  trigger.addEventListener('click', () => (panel.hidden ? open() : close()));
  panel.addEventListener('click', event => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.close !== undefined) return close();
    if (target.dataset.today !== undefined) {
      shown = { year: current.year, month: current.month };
      selected = { ...current };
    } else if (target.dataset.move) {
      shown = shiftMonth(shown, Number(target.dataset.move));
      selected = null;
    } else if (target.dataset.date) {
      const [year, month, day] = target.dataset.date.split('-').map(Number);
      selected = selected && dateKey(selected) === target.dataset.date ? null : { year, month, day };
    } else return;
    const focusKey = target.dataset.date || (target.dataset.today !== undefined ? dateKey(current) : null);
    const focusMove = target.dataset.move;
    render();
    if (focusKey) panel.querySelector(`[data-date="${focusKey}"]`)?.focus();
    else if (focusMove) panel.querySelector(`[data-move="${focusMove}"]:not([disabled])`)?.focus();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) close({ restoreFocus: false });
  });

  updateTrigger();
  return {
    setDate(date) {
      current = { ...date };
      updateTrigger();
      if (!panel.hidden) render();
    },
    open,
    close,
  };
}
