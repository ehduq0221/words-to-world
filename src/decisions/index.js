import * as api from './gameApi.js';
import { activeEvents, resolvedChoice, decide, effectId, effectText, formatWon, initializeSchedule, releaseDueEvent } from './model.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function initDecisions({ container, anchors, onSelect, onChange }) {
  const response = await fetch(new URL('../../public/data/decisions.json', import.meta.url));
  if (!response.ok) throw new Error('학생 이벤트 자료를 불러올 수 없습니다.');
  const data = await response.json();
  if (!Number.isInteger(data.activeLimit) || data.activeLimit < 1 || data.activeLimit > 3 || !Number.isInteger(data.schedule?.minDays) || !Number.isInteger(data.schedule?.maxDays) || data.schedule.minDays < 1 || data.schedule.maxDays < data.schedule.minDays || !Number.isInteger(data.schedule.initialCount) || data.schedule.initialCount < 0 || data.schedule.initialCount > data.activeLimit) throw new Error('학생 이벤트 주기 설정을 확인해 주세요.');
  const byBuilding = new Map(anchors.map(anchor => [anchor.building.id, anchor]));
  const ids = new Set();
  for (const event of data.events) {
    if (ids.has(event.id) || !byBuilding.has(event.buildingId) || event.choices.length !== 3 || new Set(event.choices.map(choice => choice.id)).size !== 3 ||
        !event.choices.every(choice => ['budget', 'satisfaction', 'reputation'].every(key => Number.isFinite(choice.effect[key])))) {
      throw new Error('학생 이벤트의 건물 또는 선택지 설정을 확인해 주세요.');
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

  function eventCard(event, state) {
    const selected = resolvedChoice(event, state);
    const card = element('article', 'decision-card' + (selected ? ' is-resolved' : ''));
    card.dataset.eventId = event.id;
    card.tabIndex = -1;
    const heading = element('div', 'decision-heading');
    heading.append(element('span', 'decision-avatar', event.who[0]), element('b', '', event.who), element('span', 'decision-status', selected ? '처리 완료' : '선택 대기'));
    card.append(heading, element('h3', '', event.title), element('p', 'decision-story', event.text));
    const anchor = byBuilding.get(event.buildingId);
    const location = element('button', 'decision-location', anchor.name + ' · 지도에서 보기');
    location.type = 'button';
    location.addEventListener('click', () => onSelect(anchor.building, { focusMap: true }));
    card.append(location);
    if (selected) {
      const entry = state.ledger.find(item => item.id === effectId(event, selected));
      const result = element('div', 'decision-result');
      result.setAttribute('role', 'status');
      const nextDay = JSON.stringify(state.time.date) !== JSON.stringify(entry.date);
      result.append(element('strong', '', selected.label), element('p', 'decision-effects', effectText(entry)), element('p', '', nextDay ? '“' + selected.response + '”' : '결정을 반영했습니다. 학생의 후속 이야기는 내일부터 들려와요.'));
      card.append(result);
    } else {
      const choices = element('div', 'decision-choices');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', event.title + ' 대응 선택');
      for (const choice of event.choices) {
        const button = element('button', '', choice.label);
        button.type = 'button';
        button.addEventListener('click', () => {
          try {
            decide(event, choice.id, api);
          } catch (error) {
            showError(card, error.message.includes('예산') ? error.message : '결과를 저장하지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.');
          }
        });
        choices.append(button);
      }
      card.append(choices);
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
        document.querySelector('#decision-notice').textContent = '이벤트를 저장하지 못했습니다. 브라우저 저장소를 확인해 주세요.';
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
    const opened = [...state.decisions.opened].reverse().map(id => data.events.find(event => event.id === id)).filter(event => event && (resolvedChoice(event, state) || active.includes(event)));
    const scroll = feed.scrollTop;
    feed.replaceChildren(...opened.map(event => eventCard(event, state)));
    if (!opened.length) feed.append(element('p', 'decision-empty', '건물 위의 !을 눌러 학생의 이야기를 들어 보세요.'));
    feed.scrollTop = scroll;
    count.textContent = opened.filter(event => !resolvedChoice(event, state)).length;
    count.title = '선택을 기다리는 학생의 목소리';
    layer.replaceChildren();
    markers = activeEvents(data.events, state, data.activeLimit).map(event => {
      const anchor = byBuilding.get(event.buildingId);
      const button = element('button', 'decision-bubble', '!');
      button.type = 'button';
      button.dataset.eventId = event.id;
      button.classList.toggle('is-opened', state.decisions.opened.includes(event.id));
      button.setAttribute('aria-label', anchor.name + ' 학생 이벤트 열기');
      button.addEventListener('click', () => openEvent(event));
      layer.append(button);
      return { anchor, button };
    });
    if (view) projectMarkers(view.camera, view.width, view.height);
    onChange();
  }
  api.registerArea('decisions', () => ({ opened: [], released: null, nextEventDay: null }));
  api.onTimeAdvance(() => {
    const next = releaseDueEvent(data.events, api.getState(), data.activeLimit, data.schedule);
    if (next) api.updateArea('decisions', () => next);
  });
  api.subscribe(render);
  return { update: projectMarkers };
}
