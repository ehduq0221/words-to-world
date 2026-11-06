// 편의시설·기숙사 운영 계산. 화면이나 게임 상태에 의존하지 않는 순수 함수만 둡니다.
// area는 게임 상태의 operations 영역, data는 public/data/operations.json입니다.

// modes·feeLevel·openRates는 이번 학기에 적용 중인 설정, plan은 다음 학기 계획입니다.
export function createInitialArea() {
  return { modes: {}, feeLevel: null, openRates: {}, plan: emptyPlan(null), activeSemester: null, accrual: {}, decidedOn: {} };
}

function emptyPlan(semester) {
  return { semester, modes: {}, feeLevel: null, openRates: {} };
}

// ---- 학기와 결정 기간 ----
// 1학기는 3~8월, 2학기는 9월~다음 해 2월입니다. 다음 학기 계획은 그 학기 시작 planningDaysBefore일 전부터 전날까지 정합니다.

const toUtc = ({ year, month, day }) => Date.UTC(year, month - 1, day);
const fromUtc = time => {
  const date = new Date(time);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
};

export function semesterOf({ year, month }) {
  if (month >= 3 && month <= 8) return `${year}-1`;
  if (month >= 9) return `${year}-2`;
  return `${year - 1}-2`;
}

export function semesterName(semester) {
  return `${semester.split('-')[1]}학기`;
}

export function nextSemester(date) {
  const [year, term] = semesterOf(date).split('-').map(Number);
  return term === 1
    ? { semester: `${year}-2`, start: { year, month: 9, day: 1 } }
    : { semester: `${year + 1}-1`, start: { year: year + 1, month: 3, day: 1 } };
}

export function planningWindow(date, daysBefore) {
  const { semester, start } = nextSemester(date);
  const opens = fromUtc(toUtc(start) - daysBefore * 86400000);
  const closes = fromUtc(toUtc(start) - 86400000);
  const now = toUtc(date);
  return { semester, start, opens, closes, open: now >= toUtc(opens) && now <= toUtc(closes) };
}

export const formatDate = ({ month, day }) => `${month}월 ${day}일`;

// 학기 정산 기간의 실제 날짜 수. 1학기 3/1~8/31은 184일, 2학기 9/1~다음 해 2월 말은 181일 또는 182일입니다.
export function semesterDays(semester) {
  const [year, term] = semester.split('-').map(Number);
  const start = term === 1 ? { year, month: 3, day: 1 } : { year, month: 9, day: 1 };
  const end = term === 1 ? { year, month: 9, day: 1 } : { year: year + 1, month: 3, day: 1 };
  return Math.round((toUtc(end) - toUtc(start)) / 86400000);
}

// ---- 다음 학기 계획 ----

// 계획이 다음 학기 것이 아니면(지난 계획) 비어 있는 것으로 봅니다.
export function currentPlan(area, semester) {
  return area.plan?.semester === semester ? area.plan : emptyPlan(semester);
}

// 계획을 반영한 다음 학기 설정. 계획이 없는 항목은 이번 학기 설정을 이어 갑니다.
export function plannedArea(area, semester) {
  const plan = currentPlan(area, semester);
  return {
    ...area,
    modes: { ...area.modes, ...plan.modes },
    feeLevel: plan.feeLevel ?? area.feeLevel,
    openRates: { ...area.openRates, ...plan.openRates },
  };
}

export function planChanges(area, data, semester) {
  const next = plannedArea(area, semester);
  const facilities = data.facilities
    .filter(facility => facilityMode(area, facility) !== facilityMode(next, facility))
    .map(facility => ({ facility, from: facilityMode(area, facility), to: facilityMode(next, facility) }));
  const fee = feeLevelKey(area, data) !== feeLevelKey(next, data) ? { from: feeLevelKey(area, data), to: feeLevelKey(next, data) } : null;
  const dorms = data.dorms
    .filter(dorm => openRate(area, dorm) !== openRate(next, dorm))
    .map(dorm => ({ dorm, from: openRate(area, dorm), to: openRate(next, dorm) }));
  return { facilities, fee, dorms, count: facilities.length + (fee ? 1 : 0) + dorms.length };
}

// 학기 첫날 계획을 적용합니다. 운영 방식이 바뀐 시설은 계약 변경 비용을 그날 지출합니다.
export function applyPlan(area, data, semester) {
  const changes = planChanges(area, data, semester);
  const next = plannedArea(area, semester);
  const effects = changes.facilities.map(({ facility, to }) => ({
    id: `operations:switch:${facility.id}:${semester}`,
    budget: -data.switchCost,
    reason: `${facility.name} ${to === 'direct' ? '직접 운영' : '임대'} 전환 비용`,
    source: 'operations',
  }));
  return { area: { ...next, plan: emptyPlan(null), activeSemester: semester }, effects, changes };
}

// 플레이어 결정은 같은 결정마다 게임 날짜로 하루에 한 번만 내릴 수 있습니다.
// 결정 키: 시설 운영 방식 mode:<시설 ID>, 기숙사비 feeLevel, 운영하는 방 openRate:<기숙사 ID>
export function dateKey({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isDecisionLocked(area, key, date) {
  return (area.decidedOn ?? {})[key] === dateKey(date);
}

export function markDecided(area, key, date) {
  return { ...area, decidedOn: { ...(area.decidedOn ?? {}), [key]: dateKey(date) } };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round1 = value => Math.round(value * 10) / 10;

// operations.json을 계산에 쓰는 형태로 바꿉니다.
// - 시설: 매출·운영비·임대료가 없으면 유형 기본값 × scale을 씁니다. 편의성 점수는 scale과 관계없이 유형 값을 씁니다.
// - 기숙사: 호실 구성(rooms)에서 정원과 1인당 평균 사용료를 계산합니다.
export function normalizeData(raw) {
  const scaled = (values, scale) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, key === 'convenience' ? value : Math.round(value * scale)]));
  const facilities = raw.facilities.map(facility => {
    const type = raw.facilityTypes[facility.type];
    if (!type) throw new Error(`'${facility.name}'의 시설 유형 '${facility.type}'이 facilityTypes에 없습니다.`);
    const scale = facility.scale ?? 1;
    return {
      ...facility,
      direct: facility.direct ?? scaled(type.direct, scale),
      lease: facility.lease ?? scaled(type.lease, scale),
    };
  });
  const dorms = raw.dorms.map(dorm => {
    const capacity = dorm.rooms.reduce((sum, room) => sum + room.beds, 0);
    const fee = Math.round(dorm.rooms.reduce((sum, room) => sum + room.beds * room.fee, 0) / capacity);
    return { ...dorm, capacity, fee };
  });
  return { ...raw, facilities, dorms };
}

export function facilityMode(area, facility) {
  return area.modes[facility.id] ?? facility.initialMode;
}

export function feeLevelKey(area, data) {
  return area.feeLevel ?? data.dorm.initialFeeLevel;
}

export function openRate(area, dorm) {
  return area.openRates[dorm.id] ?? 1;
}

// 한 학기 동안 현재 방식으로 운영했을 때의 결과
export function facilityResult(area, facility) {
  const mode = facilityMode(area, facility);
  if (mode === 'direct') {
    const { revenue, cost, convenience } = facility.direct;
    return { mode, income: revenue, expense: cost, net: revenue - cost, convenience };
  }
  const { rent, convenience } = facility.lease;
  return { mode, income: rent, expense: 0, net: rent, convenience };
}

export function dormResult(area, data, dorm) {
  const level = data.dorm.feeLevels[feeLevelKey(area, data)];
  const openBeds = Math.round(dorm.capacity * openRate(area, dorm));
  const applicants = Math.round(dorm.demand * level.demand);
  const occupants = Math.min(openBeds, applicants);
  const fee = Math.round(dorm.fee * level.multiplier);
  const income = occupants * fee;
  const expense = openBeds * data.dorm.maintenancePerBed;
  return {
    openBeds,
    applicants,
    occupants,
    waiting: applicants - occupants,
    emptyBeds: openBeds - occupants,
    fee,
    income,
    expense,
    net: income - expense,
  };
}

// 학생 편의성(편의시설)과 주거 만족도(기숙사), 0~100
export function scores(area, data) {
  const convenience = data.facilities.length
    ? data.facilities.reduce((sum, facility) => sum + facilityResult(area, facility).convenience, 0) / data.facilities.length
    : 50;
  const dorms = data.dorms.map(dorm => dormResult(area, data, dorm));
  const applicants = dorms.reduce((sum, dorm) => sum + dorm.applicants, 0);
  const waiting = dorms.reduce((sum, dorm) => sum + dorm.waiting, 0);
  const waitRatio = applicants ? waiting / applicants : 0;
  const levelBonus = data.dorm.feeLevels[feeLevelKey(area, data)].housing;
  const housing = clamp(80 - 60 * waitRatio + levelBonus, 0, 100);
  return { convenience: round1(convenience), housing: round1(housing), waitRatio: round1(waitRatio * 100) / 100 };
}

// 한 학기 예상 정산(등록금 포함)
export function semesterForecast(area, data) {
  const facilities = data.facilities.reduce((sum, facility) => sum + facilityResult(area, facility).net, 0);
  const dorms = data.dorms.reduce((sum, dorm) => sum + dormResult(area, data, dorm).net, 0);
  const tuition = data.tuition.students * data.tuition.perStudent;
  return { tuition, facilities, dorms, total: tuition + facilities + dorms };
}

// 하루치 수입·지출과 점수를 학기별로 쌓습니다. 하루치는 학기 금액 ÷ 그 학기의 실제 날짜 수입니다.
// 학기 도중에 게임을 시작하면 운영한 날짜만큼만 정산됩니다.
export function accrueDay(area, data, semester) {
  const days = semesterDays(semester);
  const current = area.accrual[semester] ?? { days: 0, items: {}, convenience: 0, housing: 0 };
  const items = { ...current.items };
  const add = (key, reason, income, expense) => {
    const item = items[key] ?? { reason, income: 0, expense: 0 };
    items[key] = { reason, income: item.income + income / days, expense: item.expense + expense / days };
  };
  for (const facility of data.facilities) {
    const result = facilityResult(area, facility);
    add(`facility:${facility.id}`, `${facility.name} 운영`, result.income, result.expense);
  }
  for (const dorm of data.dorms) {
    const result = dormResult(area, data, dorm);
    add(`dorm-fee:${dorm.id}`, `${dorm.name} 기숙사비`, result.income, 0);
    add(`dorm-upkeep:${dorm.id}`, `${dorm.name} 유지비`, 0, result.expense);
  }
  const score = scores(area, data);
  return {
    ...area,
    accrual: {
      ...area.accrual,
      [semester]: {
        days: current.days + 1,
        items,
        convenience: current.convenience + score.convenience,
        housing: current.housing + score.housing,
      },
    },
  };
}

// 학기 정산에 반영할 효과 목록과 쌓인 기록을 비운 영역을 돌려줍니다.
export function settle(area, data, semester) {
  const effects = [{
    id: `operations:tuition:${semester}`,
    budget: data.tuition.students * data.tuition.perStudent,
    reason: `등록금 (${data.tuition.students.toLocaleString('ko-KR')}명)`,
    source: 'operations',
  }];
  const current = area.accrual[semester];
  if (current) {
    for (const [key, item] of Object.entries(current.items)) {
      const budget = Math.round(item.income - item.expense);
      if (budget !== 0) effects.push({ id: `operations:${key}:${semester}`, budget, reason: item.reason, source: 'operations' });
    }
    if (current.days > 0) {
      const average = (current.convenience + current.housing) / 2 / current.days;
      const { baseline, divisor, maxChange } = data.satisfaction;
      const satisfaction = round1(clamp((average - baseline) / divisor, -maxChange, maxChange));
      if (satisfaction !== 0) {
        effects.push({ id: `operations:satisfaction:${semester}`, satisfaction, reason: '편의시설·기숙사 만족도', source: 'operations' });
      }
    }
  }
  const { [semester]: _settled, ...rest } = area.accrual;
  return { effects, area: { ...area, accrual: rest } };
}

// 다른 기능(학생 반응 등)이 getState().operations.summary로 읽는 요약 값입니다.
// 형태를 바꾸면 IMPLEMENTATION_PLAN.md 4단계 「정한 내용」을 먼저 고칩니다.
export function summarize(area, data) {
  const score = scores(area, data);
  const dorms = {};
  for (const dorm of data.dorms) {
    const result = dormResult(area, data, dorm);
    dorms[dorm.id] = {
      buildingId: dorm.buildingId,
      name: dorm.name,
      capacity: dorm.capacity,
      openBeds: result.openBeds,
      applicants: result.applicants,
      occupants: result.occupants,
      waiting: result.waiting,
      emptyBeds: result.emptyBeds,
      fee: result.fee,
    };
  }
  const facilities = {};
  for (const facility of data.facilities) {
    const result = facilityResult(area, facility);
    facilities[facility.id] = { buildingId: facility.buildingId, name: facility.name, type: facility.type, mode: result.mode, convenience: result.convenience };
  }
  return { convenience: score.convenience, housing: score.housing, feeLevel: feeLevelKey(area, data), dorms, facilities };
}
