// 즉시 조치 안건(IMPLEMENTATION_PLAN.md 공통 약속 「총장 결정」)
// 건물 위 !로 결정 대기 안건을 보여 주고, 총장이 조치를 고르면 확인 창을 거쳐 「조치 예정」이 됩니다.
// 효과와 학생의 후속 반응은 다음 날 나타납니다.
import { careEffect, neglectedRequests } from './care.js';
import * as api from './gameApi.js';
import { activeEvents, waitingEvents, resolvedChoice, scheduledChoice, decide, applyDue, effectId, effectText, initializeSchedule, releaseDueEvent } from './model.js';
import { confirmDecision } from '../ui/confirm.js';

const formatDate = ({ month, day }) => `${month}월 ${day}일`;
const nextDate = ({ year, month, day }) => {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
};

// 학생의 후속 반응을 5단계 대사로 등록합니다(유형: decisions.<안건>.<조치>).
export function responseDialogues(events) {
  return events.flatMap(event => event.choices.map(choice => ({ type: `decisions.${event.id}.${choice.id}`, text: choice.response })));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function initDecisions({ container, anchors, onSelect, onChange }) {
  const response = await fetch(new URL('../../public/data/decisions.json', import.meta.url), { cache: 'no-store' });
  if (!response.ok) throw new Error('즉시 조치 안건 자료를 불러올 수 없습니다.');
  const data = await response.json();
  if (!Number.isInteger(data.activeLimit) || data.activeLimit < 1 || data.activeLimit > 3 || !Number.isInteger(data.schedule?.minDays) || !Number.isInteger(data.schedule?.maxDays) || data.schedule.minDays < 1 || data.schedule.maxDays < data.schedule.minDays || !Number.isInteger(data.schedule.initialCount) || data.schedule.initialCount < 0 || data.schedule.initialCount > data.activeLimit || !(Number.isInteger(data.schedule.cooldownDays) && data.schedule.cooldownDays >= 0)) throw new Error('즉시 조치 안건의 발생 주기 설정을 확인해 주세요.');
  const byBuilding = new Map(anchors.map(anchor => [anchor.building.id, anchor]));
  const ids = new Set();
  for (const event of data.events) {
    if (ids.has(event.id) || !byBuilding.has(event.buildingId) || event.choices.length !== 3 || new Set(event.choices.map(choice => choice.id)).size !== 3 ||
        !event.choices.every(choice => ['budget', 'satisfaction', 'reputation'].every(key => Number.isFinite(choice.effect[key])))) {
      throw new Error('즉시 조치 안건의 건물 또는 조치 설정을 확인해 주세요.');
    }
    ids.add(event.id);
  }
  const section = document.querySelector('.reactions');
  const feed = section.querySelector('#decision-feed');
  const count = section.querySelector('#decision-count');
  const layer = element('div', 'decision-markers');
  container.append(layer);
  let markers = [];
  let view = null;

  function showError(card, message) {
    card.querySelector('.decision-error')?.remove();
    const error = element('p', 'decision-error', message);
    error.setAttribute('role', 'alert');
    card.append(error);
  }

  async function chooseAction(event, choice, card) {
    const tomorrow = nextDate(api.getState().time.date);
    const ok = await confirmDecision({
      title: `「${event.title}」 안건에 「${choice.label}」 조치를 할까요?`,
      notes: [
        '결정하면 이 안건의 조치는 바꿀 수 없어요.',
        `조치의 효과와 학생들의 반응은 내일(${formatDate(tomorrow)}) 나타나요.`,
      ],
      confirmLabel: '조치 결정',
    });
    if (!ok) return;
    try {
      decide(event, choice.id, api, data.events);
    } catch (error) {
      showError(card, error.message.includes('예산') || error.message.includes('즉시 조치') ? error.message : '결정을 저장하지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.');
    }
  }

  function eventCard(event, state) {
    const selected = resolvedChoice(event, state);
    const planned = selected ? null : scheduledChoice(event, state);
    const status = selected ? '조치 완료' : planned ? '조치 예정' : '결정 대기';
    const card = element('article', 'decision-card' + (selected ? ' is-resolved' : planned ? ' is-scheduled' : ''));
    card.dataset.eventId = event.id;
    card.tabIndex = -1;
    const heading = element('div', 'decision-heading');
    heading.append(element('span', 'decision-avatar', event.who[0]), element('b', '', `${event.who}의 요청`), element('span', 'decision-status', status));
    card.append(heading, element('h3', '', event.title), element('p', 'decision-story', event.text));
    const anchor = byBuilding.get(event.buildingId);
    const location = element('button', 'decision-location', anchor.name + ' · 지도에서 보기');
    location.type = 'button';
    location.addEventListener('click', () => onSelect(anchor.building, { focusMap: true }));
    card.append(location);
    if (selected) {
      const entry = state.ledger.find(item => item.id === effectId(event, selected, state.decisions.rounds?.[event.id] ?? 0));
      const result = element('div', 'decision-result');
      result.setAttribute('role', 'status');
      result.append(
        element('strong', '', `${selected.label} · ${formatDate(entry.date)} 반영`),
        element('p', 'decision-effects', effectText(entry)),
        element('p', '', `${event.who}: “${selected.response}”`),
      );
      card.append(result);
    } else if (planned) {
      const result = element('div', 'decision-result is-pending');
      result.setAttribute('role', 'status');
      result.append(
        element('strong', '', `${planned.choice.label} · ${formatDate(planned.decidedOn)} 결정`),
        element('p', '', `${formatDate(nextDate(planned.decidedOn))}에 조치가 반영되고 학생들의 반응이 들려와요.`),
      );
      card.append(result);
    } else {
      const choices = element('div', 'decision-choices');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', event.title + ' 조치 결정');
      for (const choice of event.choices) {
        const button = element('button', '', choice.label);
        button.type = 'button';
        button.addEventListener('click', () => chooseAction(event, choice, card));
        choices.append(button);
      }
      card.append(choices);
      const failed = state.decisions.failed?.[event.id];
      if (failed) showError(card, failed);
    }
    return card;
  }

  function openEvent(event) {
    window.dispatchEvent(new CustomEvent("campus:event-open", { detail: { title: event.title } }));
    const anchor = byBuilding.get(event.buildingId);
    onSelect(anchor.building, { focusMap: true });
    if (!api.getState().decisions.opened.includes(event.id)) {
      try {
        api.updateArea('decisions', area => ({ ...area, opened: [...area.opened, event.id] }));
      } catch {
        document.querySelector('#decision-notice').textContent = '안건을 저장하지 못했습니다. 브라우저 저장소를 확인해 주세요.';
        return;
      }
    }
    const card = [...feed.children].find(item => item.dataset.eventId === event.id);
    if (card) {
      feed.scrollTop = card.offsetTop;
      card.focus({ preventScroll: true });
    }
  }

  function projectMarkers(camera, width, height) {
    view = { camera, width, height };
    const occupied = [];
    for (const { anchor, button } of markers) {
      const point = anchor.position.clone().project(camera);
      let x = (point.x + 1) * width / 2 + 20;
      let y = (1 - point.y) * height / 2 - 36;
      const visible = point.z >= -1 && point.z <= 1 && x >= 0 && x <= width && y >= 0 && y <= height;
      button.hidden = !visible;
      if (!visible) continue;
      x = Math.max(18, Math.min(width - 18, x));
      y = Math.max(18, Math.min(height - 18, y));
      while (occupied.some(other => Math.abs(other.x - x) < 36 && Math.abs(other.y - y) < 38) && y > 45) y -= 38;
      occupied.push({ x, y });
      button.style.left = x + 'px';
      button.style.top = y + 'px';
    }
  }

  function render(state) {
    const initialized = initializeSchedule(data.events, state, data.activeLimit, data.schedule);
    if (initialized) { api.updateArea('decisions', () => initialized); return; }
    const active = activeEvents(data.events, state, data.activeLimit);
    const waiting = neglectedRequests(data.events, state, data.activeLimit);
    let careNote = section.querySelector('#care-note');
    if (!careNote) { careNote = element('p', 'care-note'); careNote.id = 'care-note'; section.querySelector('.section-sub').after(careNote); }
    const overdue = waiting.filter(item => item.age >= 7).length;
    careNote.textContent = overdue ? `오래 기다린 안건 ${overdue}건 · 만족도와 평판에 영향을 주고 있어요.` : '7일 이상 방치한 안건은 만족도·평판이 낮아져요.';
    const opened = [...state.decisions.opened].reverse().map(id => data.events.find(event => event.id === id)).filter(event => event && (resolvedChoice(event, state) || active.includes(event)));
    const scroll = feed.scrollTop;
    feed.replaceChildren(...opened.map(event => eventCard(event, state)));
    if (!opened.length) feed.append(element('p', 'decision-empty', '건물 위의 !을 눌러 조치가 필요한 안건을 확인하세요.'));
    feed.scrollTop = scroll;
    count.textContent = opened.filter(event => !resolvedChoice(event, state) && !scheduledChoice(event, state)).length;
    count.title = '결정을 기다리는 안건';
    layer.replaceChildren();
    markers = waitingEvents(data.events, state, data.activeLimit).map(event => {
      const anchor = byBuilding.get(event.buildingId);
      const button = element('button', 'decision-bubble', '!');
      button.type = 'button';
      button.dataset.eventId = event.id;
      button.classList.toggle('is-opened', state.decisions.opened.includes(event.id));
      button.setAttribute('aria-label', anchor.name + ' 조치가 필요한 안건 열기');
      button.addEventListener('click', () => openEvent(event));
      layer.append(button);
      return { anchor, button };
    });
    if (view) projectMarkers(view.camera, view.width, view.height);
    onChange();
  }
  api.registerArea('decisions', () => ({ opened: [], released: null, nextEventDay: null, scheduled: [], rounds: {}, lastDone: {}, failed: {}, releasedOn: {} }));
  api.registerDialogues(responseDialogues(data.events));
  api.onTimeAdvance(() => {
    // 어제까지 결정한 조치를 반영하고, 학생의 후속 반응을 남깁니다.
    for (const { event, choice } of applyDue(data.events, api)) {
      api.addReaction({ type: `decisions.${event.id}.${choice.id}`, buildingId: event.buildingId, cause: event.title });
    }
    const next = releaseDueEvent(data.events, api.getState(), data.activeLimit, data.schedule);
    if (next) api.updateArea('decisions', () => next);
    const effect = careEffect(data.events, api.getState(), data.activeLimit);
    if (effect) api.applyEffect(effect);
  });
  api.subscribe(render);
  return { update: projectMarkers };
}
