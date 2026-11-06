const KEY = 'words-to-world:save';
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = object => {
  if (object && typeof object === 'object' && !Object.isFrozen(object)) {
    Object.values(object).forEach(freeze); Object.freeze(object);
  }
  return object;
};
export const dateKey = date => `${date.year}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`;
export const semesterOf = ({ year, month }) => month >= 3 && month <= 8 ? `${year}-1` : month >= 9 ? `${year}-2` : `${year-1}-2`;
export function validDate(date) {
  if (!date || !['year','month','day'].every(key=>Number.isInteger(date[key]))) return false;
  const d = new Date(Date.UTC(date.year,date.month-1,date.day));
  return d.getUTCFullYear()===date.year && d.getUTCMonth()+1===date.month && d.getUTCDate()===date.day;
}
export function createGameStore({ config, storage }) {
  const factories = new Map();
  const hooks = { change:new Set(), time:new Set(), settlement:new Set(), end:new Set() };
  let state = null, depth = 0, notifying = false, pending = false, advancing = false;
  const listen = key => listener => { hooks[key].add(listener); return ()=>hooks[key].delete(listener); };
  function notify() {
    pending = true;
    if (notifying || depth) return;
    notifying = true;
    try {
      let cycles=0;
      while(pending) {
        if(++cycles>50) throw new Error('상태 갱신이 반복되고 있습니다.');
        pending=false;
        for(const listener of hooks.change) listener(state);
      }
    } finally { notifying=false; }
  }
  function save(next = state) { if (!next) throw new Error('저장할 게임이 없습니다. 메뉴에서 새 게임을 시작해 주세요.'); storage.setItem(KEY, JSON.stringify({version:1,state:next})); return true; }
  function commit(next) {
    const frozen=freeze(next);
    if(!depth) save(frozen);
    state=frozen; notify();
  }
  function transaction(action) {
    const before=state; depth++;
    try { action(); if(depth===1) save(); }
    catch(error) { state=before; pending=false; throw error; }
    finally { depth--; }
    if(!depth) notify();
  }
  function normalize(saved) {
    const s=saved?.state;
    if(saved?.version!==1 || !validDate(s?.time?.date) || !s?.metrics || !Array.isArray(s?.ledger) || !Array.isArray(s?.settled) || !Array.isArray(s?.evaluations) ||
      !Number.isSafeInteger(s.metrics.budget) || !['satisfaction','reputation'].every(k=>Number.isFinite(s.metrics[k])&&s.metrics[k]>=0&&s.metrics[k]<=100) ||
      !s.ledger.every(e=>typeof e.id==='string'&&['budget','satisfaction','reputation'].every(k=>Number.isFinite(e[k]))&&validDate(e.date)) ||
      new Set(s.ledger.map(e=>e.id)).size!==s.ledger.length || !Number.isSafeInteger(s.initialBudget) || s.initialBudget+s.ledger.reduce((n,e)=>n+e.budget,0)!==s.metrics.budget) throw new Error('저장 데이터 형식을 확인할 수 없습니다. 기존 저장은 유지했습니다.');
    const restored=clone(s);
    restored.time={...restored.time,semester:semesterOf(restored.time.date),paused:true,speed:[1,4,12].includes(restored.time.speed)?restored.time.speed:1};
    for(const [name,factory] of factories) restored[name]={...factory(),...(restored[name]||{})};
    return restored;
  }
  function initial() {
    const metrics=clone(config.initialMetrics), date=clone(config.initialDate);
    const next={time:{date,semester:semesterOf(date),paused:true,speed:1,dayCount:0},metrics,initialBudget:metrics.budget,ledger:[],settled:[],evaluations:[]};
    for(const [name,factory] of factories) next[name]=factory();
    return next;
  }
  function applyEffect({id,budget=0,satisfaction=0,reputation=0,reason='',source=''}) {
    if(!state || typeof id!=='string' || !id || ![budget,satisfaction,reputation].every(Number.isFinite)) throw new Error('게임 효과가 올바르지 않습니다.');
    if(state.ledger.some(e=>e.id===id))return false;
    const clamp=n=>Math.max(0,Math.min(100,n));
    const metrics={budget:state.metrics.budget+Math.round(budget),satisfaction:clamp(state.metrics.satisfaction+satisfaction),reputation:clamp(state.metrics.reputation+reputation)};
    if(!Number.isSafeInteger(metrics.budget))throw new Error('예산 범위를 확인해 주세요.');
    const actual=Object.fromEntries(Object.keys(metrics).map(k=>[k,Math.round((metrics[k]-state.metrics[k])*10000)/10000]));
    commit({...state,metrics,ledger:[...state.ledger,{id,...actual,reason,source,date:clone(state.time.date),semester:state.time.semester}]});
    return true;
  }
  function settle(semester) {
    if(state.settled.includes(semester))return false;
    transaction(()=>{
      commit({...state,settled:[...state.settled,semester]});
      for(const fn of hooks.settlement) fn({semester});
      applyEffect({id:`game:base-cost:${semester}`,budget:-config.semesterBaseCost,reason:'학기 기본 운영비 (게임 설정)',source:'game'});
      const {budget,satisfaction,reputation}=state.metrics;
      const score=Math.round((satisfaction+reputation)/2);
      commit({...state,evaluations:[...state.evaluations,{semester,budget,satisfaction,reputation,score,grade:score>=85?'A':score>=70?'B':score>=55?'C':'D'}]});
      for(const fn of hooks.end) fn({semester,budget:state.metrics.budget});
    }); return true;
  }
  return {
    registerArea(name,factory) {
      if(state)throw new Error('게임 시작 전에 영역을 등록해 주세요.');
      if(['time','metrics','ledger','settled','evaluations','initialBudget','__proto__','constructor','prototype'].includes(name)||factories.has(name))throw new Error('상태 영역 이름이 중복됩니다.');
      factories.set(name,factory);
    },
    getState:()=>state,
    updateArea(name,updater) { if(!factories.has(name)||!state)throw new Error('등록된 영역이 필요합니다.');commit({...state,[name]:updater(state[name])}); },
    applyEffect, subscribe:listen('change'), onTimeAdvance:listen('time'), onSettlement:listen('settlement'), onSettlementEnd:listen('end'),
    startGame() {
      if(state)return state;
      const raw=storage.getItem(KEY);
      state=freeze(raw?normalize(JSON.parse(raw)):initial());notify();return state;
    },
    saveGame:()=>save(),
    loadGame() {const raw=storage.getItem(KEY);if(!raw)throw new Error('저장된 게임이 없습니다.');const restored=normalize(JSON.parse(raw));commit(restored);return state;},
    newGame() {commit(initial());return state;},
    setPaused(paused) {commit({...state,time:{...state.time,paused:Boolean(paused)}});},
    setSpeed(speed) {if(![1,4,12].includes(speed))throw new Error('지원하지 않는 속도입니다.');commit({...state,time:{...state.time,speed}});},
    advanceDays(count=1) {
      if(!state||advancing||!Number.isInteger(count)||count<1||count>3660)throw new Error('진행할 날짜를 확인해 주세요.');
      advancing=true;
      try {for(let i=0;i<count;i++)transaction(()=>{
        const {date,semester}=state.time;
        const d=new Date(Date.UTC(date.year,date.month-1,date.day+1));const next={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()};
        if(semesterOf(next)!==semester)settle(semester);
        commit({...state,time:{...state.time,date:next,semester:semesterOf(next),dayCount:state.time.dayCount+1}});
        for(const fn of hooks.time)fn({date:clone(next),semester:semesterOf(next)});
      });}finally{advancing=false;}
    },
  };
}
