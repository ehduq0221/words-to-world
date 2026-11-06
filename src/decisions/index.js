// 즉시 조치 안건(IMPLEMENTATION_PLAN.md 공통 약속 「총장 결정」)
// - 시설 문제와 요청이 무작위로 생기고, 결정 대기 안건을 건물 위 !로 표시합니다.
// - 총장(플레이어)이 조치를 고르면 확인 창을 거쳐 「조치 예정」이 되고, 효과와 학생 반응은 다음 날 나타납니다.
// - 3단계가 합쳐지기 전에는 메인 화면 날짜 영역의 임시 「다음 날」 버튼으로 날짜를 넘깁니다.
import * as api from './gameApi.js';
import {
  createInitialArea, markerIssues, schedule, dueIssues, markDone, markFailed, spawn, effectId, findEvent, findChoice,
  effectText, formatWon, formatDate, nextDate,
} from './model.js';
import { confirmDecision } from '../ui/confirm.js';

const AREA = 'decisions';
const FEED_LIMIT = 20;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export async function loadDecisionsData(url = new URL('../../public/data/decisions.json', import.meta.url)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('즉시 조치 안건 자료를 불러올 수 없습니다.');
  return response.json();
}

export function validateDecisionsData(data, buildingIds) {
  const ids = new Set();
  const settingsValid = data.activeLimit > 0 && data.initialCount >= 0 && data.spawnChance >= 0 && data.spawnChance <= 1 && data.cooldownDays >= 0 && data.keepDone >= 0 && Number.isInteger(data.seed);
  if (!settingsValid) throw new Error('즉시 조치 안건의 발생 설정을 확인해 주세요.');
  for (const event of data.events) {
    if (ids.has(event.id) || !buildingIds.has(event.buildingId) || event.choices.length !== 3 || new Set(event.choices.map(choice => choice.id)).size !== 3 ||
        !event.choices.every(choice => ['budget', 'satisfaction', 'reputation'].every(key => Number.isFinite(choice.effect[key])))) {
      throw new Error('즉시 조치 안건의 건물 또는 조치 설정을 확인해 주세요.');
    }
    ids.add(event.id);
  }
}

// 학생의 후속 반응을 5단계 대사로 등록합니다(유형: decisions.<안건>.<조치>).
export function responseDialogues(data) {
  return data.events.flatMap(event => event.choices.map(choice => ({ type: `decisions.${event.id}.${choice.id}`, text: choice.response })));
}

export async function initDecisions({ container, anchors, onSelect, onChange }) {
  const data = await loadDecisionsData();
  const byBuilding = new Map(anchors.map(anchor => [anchor.building.id, anchor]));
  validateDecisionsData(data, new Set(byBuilding.keys()));
  const section = document.querySelector('.reactions');
  const feed = section.querySelector('#decision-feed');
  const count = section.querySelector('#decision-count');
  const notice = document.querySelector('#decision-notice');
  const layer = element('div', 'decision-markers');
  container.append(layer);
  let markers = [];
  let view = null;

  const today = () => api.getState().time.date;

  function showError(card, message) {
    card.querySelector('.decision-error')?.remove();
    const error = element('p', 'decision-error', message);
    error.setAttribute('role', 'alert');
    card.append(error);
  }

  async function decide(issue, event, choice, card) {
    const state = api.getState();
    const effect = choice.effect;
    const after = {
      budget: state.metrics.budget + effect.budget,
      satisfaction: Math.max(0, Math.min(100, state.metrics.satisfaction + effect.satisfaction)),
      reputation: Math.max(0, Math.min(100, state.metrics.reputation + effect.reputation)),
    };
    const tomorrow = nextDate(today());
    const ok = await confirmDecision({
      title: `「${event.title}」 안건에 「${choice.label}」 조치를 할까요?`,
      columns: ['지금', `${formatDate(tomorrow)} 반영 후`],
      rows: [
        ['예산', `₩ ${formatWon(state.metrics.budget)}`, `₩ ${formatWon(after.budget)}`],
        ['학생 만족도', `${state.metrics.satisfaction}`, `${after.satisfaction}`],
        ['학교 평판', `${state.metrics.reputation}`, `${after.reputation}`],
      ],
      notes: [
        '결정하면 이 안건의 조치는 바꿀 수 없어요.',
        `예산·지표 변화와 학생들의 반응은 내일(${formatDate(tomorrow)}) 나타나요.`,
      ],
      confirmLabel: '조치 결정',
    });
    if (!ok) return;
    let result;
    try {
      api.updateArea(AREA, area => {
        result = schedule(area, data, issue.key, choice.id, { date: today(), budget: api.getState().metrics.budget });
        return result.area;
      });
    } catch {
      showError(card, '결정을 저장하지 못했습니다. 브라우저 저장소를 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    if (result?.error) showError(card, result.error);
  }

  function eventCard(issue, state) {
    const event = findEvent(data, issue);
    const choice = issue.choiceId ? findChoice(event, issue.choiceId) : null;
    const status = { open: '결정 대기', scheduled: '조치 예정', done: '조치 완료' }[issue.status];
    const card = element('article', `decision-card is-${issue.status}`);
    card.dataset.issueKey = issue.key;
    card.tabIndex = -1;
    const heading = element('div', 'decision-heading');
    heading.append(element('span', 'decision-avatar', event.who[0]), element('b', '', `${event.who}의 요청`), element('span', 'decision-status', status));
    card.append(heading, element('h3', '', event.title), element('p', 'decision-story', event.text));
    const anchor = byBuilding.get(event.buildingId);
    const location = element('button', 'decision-location', anchor.name + ' · 지도에서 보기');
    location.type = 'button';
    location.addEventListener('click', () => onSelect(anchor.building, { focusMap: true }));
    card.append(location);
    if (issue.status === 'done') {
      const entry = state.ledger.find(item => item.id === effectId(issue, choice));
      const result = element('div', 'decision-result');
      result.setAttribute('role', 'status');
      result.append(
        element('strong', '', `${choice.label} · ${formatDate(issue.appliedOn)} 반영`),
        element('p', 'decision-effects', entry ? effectText(entry) : '지표 변화 없음'),
        element('p', '', `${event.who}: “${choice.response}”`),
      );
      card.append(result);
    } else if (issue.status === 'scheduled') {
      const result = element('div', 'decision-result is-pending');
      result.setAttribute('role', 'status');
      result.append(
        element('strong', '', `${choice.label} · ${formatDate(issue.decidedOn)} 결정`),
        element('p', 'decision-effects', `예정 효과: ${effectText(choice.effect)}`),
        element('p', '', `${formatDate(nextDate(issue.decidedOn))}에 반영되고 학생들의 반응이 들려와요.`),
      );
      card.append(result);
    } else {
      const choices = element('div', 'decision-choices');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', `${event.title} 조치 결정`);
      for (const option of event.choices) {
        const button = element('button', '', option.label);
        button.type = 'button';
        button.addEventListener('click', () => decide(issue, event, option, card));
        choices.append(button);
      }
      card.append(choices);
      if (issue.failed) showError(card, issue.failed);
    }
    return card;
  }

  function openIssue(issue) {
    const event = findEvent(data, issue);
    onSelect(byBuilding.get(event.buildingId).building, { focusMap: true });
    if (!issue.opened) {
      try {
        api.updateArea(AREA, area => ({ ...area, issues: area.issues.map(item => (item.key === issue.key ? { ...item, opened: true } : item)) }));
      } catch {
        notice.textContent = '안건을 저장하지 못했습니다. 브라우저 저장소를 확인해 주세요.';
        return;
      }
    }
    const card = [...feed.children].find(item => item.dataset.issueKey === issue.key);
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

  function showMetrics(state) {
    const { budget, satisfaction, reputation } = state.metrics;
    document.querySelector('#hud-budget').textContent = '₩ ' + formatWon(budget);
    document.querySelector('#hud-satisfaction').textContent = satisfaction;
    document.querySelector('#hud-reputation').textContent = reputation;
    const spent = state.ledger.reduce((sum, entry) => sum + Math.max(0, -entry.budget), 0);
    const earned = state.ledger.reduce((sum, entry) => sum + Math.max(0, entry.budget), 0);
    document.querySelector('#hud-budget-note').textContent = '조치 반영 ' + formatWon(earned - spent, true);
    document.querySelector('#hud-satisfaction-note').textContent = '조치 누적 ' + (satisfaction - 76 > 0 ? '+' : '') + (satisfaction - 76);
    document.querySelector('#hud-reputation-note').textContent = '조치 누적 ' + (reputation - 68 > 0 ? '+' : '') + (reputation - 68);
    document.querySelector('#finance-income').textContent = formatWon(86000000 + earned, true);
    document.querySelector('#finance-expense').textContent = formatWon(-62000000 - spent);
    document.querySelector('#finance-balance').textContent = formatWon(24000000 + earned - spent, true) + ' 원';
    const date = document.querySelector('#preview-date');
    if (date) date.textContent = `${state.time.date.year}년 ${state.time.date.month}월 ${state.time.date.day}일`;
  }

  function render(state) {
    showMetrics(state);
    const area = state[AREA];
    const opened = area.issues.filter(issue => issue.opened).slice(-FEED_LIMIT).reverse();
    const scroll = feed.scrollTop;
    feed.replaceChildren(...opened.map(issue => eventCard(issue, state)));
    if (!opened.length) feed.append(element('p', 'decision-empty', '건물 위의 !을 눌러 조치가 필요한 안건을 확인하세요.'));
    feed.scrollTop = scroll;
    const waiting = area.issues.filter(issue => issue.status === 'open').length;
    count.textContent = waiting;
    count.title = '결정을 기다리는 안건';
    layer.replaceChildren();
    markers = markerIssues(area, data.activeLimit).map(issue => {
      const anchor = byBuilding.get(findEvent(data, issue).buildingId);
      const button = element('button', 'decision-bubble', '!');
      button.type = 'button';
      button.dataset.issueKey = issue.key;
      button.classList.toggle('is-opened', issue.opened);
      button.setAttribute('aria-label', `${anchor.name} 조치가 필요한 안건 열기`);
      button.addEventListener('click', () => openIssue(issue));
      layer.append(button);
      return { anchor, button };
    });
    if (view) projectMarkers(view.camera, view.width, view.height);
    onChange();
  }

  // 하루가 지나면: 결정한 조치의 효과와 학생 반응을 반영하고, 새 안건이 생길 수 있습니다.
  function onDay({ date }) {
    api.updateArea(AREA, area => ({ ...area, dayCount: area.dayCount + 1 }));
    for (const issue of dueIssues(api.getState()[AREA])) {
      const event = findEvent(data, issue);
      const choice = findChoice(event, issue.choiceId);
      try {
        api.applyEffect({ id: effectId(issue, choice), ...choice.effect, reason: `${event.title} · ${choice.label}`, source: 'decisions' });
        api.updateArea(AREA, area => markDone(area, issue.key, date));
        api.addReaction({ type: `decisions.${event.id}.${choice.id}`, buildingId: event.buildingId, cause: event.title, values: {} });
      } catch (error) {
        const message = error.message.includes('예산')
          ? `예산이 부족해 「${choice.label}」 조치를 반영하지 못했어요. 다른 조치를 골라 주세요.`
          : '조치를 반영하지 못했습니다. 브라우저 저장소를 확인해 주세요.';
        api.updateArea(AREA, area => markFailed(area, issue.key, message));
      }
    }
    api.updateArea(AREA, area => spawn(area, data, date));
  }

  api.registerArea(AREA, () => createInitialArea(data));
  api.registerDialogues(responseDialogues(data));
  api.subscribe(render);
  api.onTimeAdvance(onDay);
  api.startGame();
  // 임시 날짜 진행 버튼(3단계가 합쳐지면 삭제)
  document.querySelector('#preview-next-day')?.addEventListener('click', () => api.advanceDay?.());
  return { update: projectMarkers };
}
