// 학생 반응 계산. 화면이나 게임 상태에 의존하지 않는 순수 함수만 둡니다.
// area는 게임 상태의 reactions 영역, config는 public/data/reactions.json입니다.

export function createInitialArea() {
  return { seq: 0, dayCount: 0, issues: {}, feed: [], recent: [] };
}

export function getPath(source, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function compare(actual, { op, value }) {
  if (actual === undefined) return false;
  switch (op) {
    case '>': return actual > value;
    case '>=': return actual >= value;
    case '<': return actual < value;
    case '<=': return actual <= value;
    case '==': return actual === value;
    case '!=': return actual !== value;
    default: throw new Error(`알 수 없는 비교 연산자 '${op}'`);
  }
}

// 단계(level): rule.levels의 조건 중 몇 개가 맞는지. 높을수록 심각합니다(예: 대기 300명 이상).
function levelOf(rule, read) {
  return (rule.levels ?? []).filter(condition => compare(read(condition.field), condition)).length;
}

// 지금 상태에서 성립하는 민원·칭찬 목록. 해당 기능이 아직 없으면(값이 undefined) 생기지 않습니다.
export function findIssues(state, rules) {
  const issues = new Map();
  for (const rule of rules) {
    if (rule.each) {
      const items = getPath(state, rule.each);
      if (!items || typeof items !== 'object') continue;
      for (const [key, item] of Object.entries(items)) {
        const read = field => item?.[field];
        // valueField가 있으면 고정값 대신 같은 항목의 다른 값과 비교합니다. 예: openBeds < capacity
        const check = condition => compare(read(condition.field), condition.valueField ? { ...condition, value: read(condition.valueField) } : condition);
        if (!rule.when.every(check)) continue;
        const values = Object.fromEntries(Object.entries(rule.values ?? {}).map(([name, field]) => [name, item[field]]));
        issues.set(`${rule.id}:${key}`, { rule, buildingId: item.buildingId ?? null, values, level: levelOf(rule, read) });
      }
    } else {
      const value = getPath(state, rule.path);
      const read = () => value;
      if (rule.when.every(condition => compare(value, condition))) {
        issues.set(rule.id, { rule, buildingId: rule.buildingId ?? null, values: { value, ...(rule.fixedValues ?? {}) }, level: levelOf(rule, read) });
      }
    }
  }
  return issues;
}

// 학사 일정 같은 날짜 반응. 해당 날짜가 되면 한 번 나옵니다.
export function calendarEvents(config, date) {
  return (config.calendar ?? []).filter(event => event.month === date.month && event.day === date.day);
}

function matches(when, values) {
  if (!when) return true;
  return Object.entries(when).every(([key, condition]) => {
    const value = values[key];
    if (condition && typeof condition === 'object') {
      return value !== undefined && (condition.min === undefined || value >= condition.min) && (condition.max === undefined || value <= condition.max);
    }
    return value === condition;
  });
}

export function fill(text, values) {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    if (value === undefined || value === null) return match;
    return typeof value === 'number' ? value.toLocaleString('ko-KR') : String(value);
  });
}

// 조건(when)이 맞는 대사를 우선하고, 최근에 쓴 대사는 다른 대사가 있으면 피합니다.
// 해당 유형의 대사가 없으면 default(해결이면 default.resolved) 대사를 씁니다.
export function pickLine(lines, type, values, recent, seq) {
  let candidates = lines.filter(line => line.type === type && matches(line.when, values));
  if (!candidates.length) {
    const suffix = ['resolved', 'eased', 'praise'].find(name => type.endsWith(`.${name}`));
    const fallback = suffix ? `default.${suffix}` : 'default';
    candidates = lines.filter(line => line.type === fallback);
  }
  if (!candidates.length) return null;
  const specific = candidates.filter(line => line.when);
  const pool = specific.length ? specific : candidates;
  const fresh = pool.filter(line => !recent.includes(line.id));
  const choices = fresh.length ? fresh : pool;
  return choices[seq % choices.length];
}

export function makePersona(config, { persona, buildingId }, seq) {
  const { surnames, majors, byBuilding } = config.personas;
  const surname = surnames[(seq * 7) % surnames.length];
  const year = (seq % 4) + 1;
  if (persona?.role) return { avatar: surname, label: persona.role, year };
  const list = (buildingId && byBuilding[buildingId]) || majors;
  return { avatar: surname, label: list[(seq * 3) % list.length], year };
}

// 반응 하나를 만들어 영역에 추가합니다.
export function addToArea(area, config, lines, { type, kind = 'event', issueId = null, buildingId = null, cause = '', priority = '', values = {}, persona = null, date = null }) {
  const seq = area.seq + 1;
  const who = makePersona(config, { persona, buildingId }, seq);
  const allValues = { major: who.label, year: who.year, ...values };
  const line = pickLine(lines, type, allValues, area.recent, seq);
  const reaction = {
    id: `reaction-${seq}`,
    seq,
    date,
    type,
    kind,
    issueId,
    buildingId,
    cause,
    priority,
    avatar: who.avatar,
    who: values.major ?? who.label,
    year: values.year ?? who.year,
    lineId: line?.id ?? null,
    text: line ? fill(line.text, allValues) : null,
  };
  const recent = line ? [...area.recent, line.id].slice(-config.recentLines) : area.recent;
  return {
    area: { ...area, seq, recent, feed: [...area.feed, reaction].slice(-config.maxFeed) },
    reaction,
  };
}

// 민원·칭찬 상태를 갱신하고, 바뀐 만큼 학생 반응을 남깁니다.
// - 새 민원: 「개선 요청」, 새 칭찬: 「칭찬」
// - 단계가 오르면 「악화」, 내려가면 「완화」(유형.eased 대사)
// - 같은 민원이 remindEveryDays 넘게 이어지면 「계속 요청」
// - 민원이 사라지면 「해결」(유형.resolved 대사), 칭찬이 사라지면 조용히 뺍니다.
export function updateIssues(area, config, lines, state, date) {
  const found = findIssues(state, config.rules);
  let next = { ...area, issues: { ...area.issues } };
  const added = [];
  const push = input => {
    const result = addToArea(next, config, lines, { ...input, date });
    next = result.area;
    added.push(result.reaction);
  };
  for (const [issueId, { rule, buildingId, values, level }] of found) {
    const existing = next.issues[issueId];
    const kind = rule.kind ?? 'complaint';
    const base = { issueId, buildingId, cause: rule.cause, values, persona: rule.persona };
    let spoke = true;
    if (!existing) {
      push(kind === 'praise'
        ? { ...base, type: `${rule.type}`, kind: 'praise', priority: '칭찬' }
        : { ...base, type: rule.type, kind: 'complaint', priority: level > 0 ? '긴급' : '개선 요청' });
    } else if (level > existing.level) {
      push({ ...base, type: rule.type, kind: 'complaint', priority: '악화' });
    } else if (level < existing.level) {
      push({ ...base, type: `${rule.type}.eased`, kind: 'eased', priority: '완화' });
    } else if (kind === 'complaint' && next.dayCount - existing.lastAt >= config.remindEveryDays) {
      push({ ...base, type: rule.type, kind: 'complaint', priority: '계속 요청' });
    } else {
      spoke = false;
    }
    next.issues[issueId] = {
      ruleId: rule.id, kind, type: rule.type, cause: rule.cause, buildingId, values, level,
      persona: rule.persona ?? null, since: existing?.since ?? date, lastAt: spoke ? next.dayCount : existing.lastAt,
    };
  }
  for (const [issueId, issue] of Object.entries(area.issues)) {
    if (found.has(issueId)) continue;
    delete next.issues[issueId];
    if (issue.kind === 'praise') continue;
    push({ type: `${issue.type}.resolved`, kind: 'resolved', issueId, buildingId: issue.buildingId, cause: issue.cause, priority: '해결', values: issue.values, persona: issue.persona });
  }
  return { area: next, added };
}
