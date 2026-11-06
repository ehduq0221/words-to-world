// 편의시설·기숙사 운영 계산. 화면이나 게임 상태에 의존하지 않는 순수 함수만 둡니다.
// area는 게임 상태의 operations 영역, data는 public/data/operations.json입니다.

export function createInitialArea() {
  return { modes: {}, feeLevel: null, openRates: {}, switchCount: 0, accrual: {} };
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

// 하루치 수입·지출과 점수를 학기별로 쌓습니다. 학기 중간에 운영 방식을 바꿔도 운영한 날짜만큼 정산됩니다.
export function accrueDay(area, data, semester) {
  const days = data.daysPerSemester;
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
