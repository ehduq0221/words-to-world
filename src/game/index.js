import { createGameStore } from './store.js';
export { dateKey, semesterOf } from './store.js';
// 학생 반응은 통합된 5단계에 연결합니다. 모든 기능은 이 진입점을 사용합니다.
export { addReaction, registerDialogues } from '../reactions/index.js';
let store=null,config=null;
export async function initGame() {
  const response=await fetch(new URL('../../public/data/game.json',import.meta.url), { cache: 'no-store' });
  if(!response.ok)throw new Error('게임 설정을 불러올 수 없습니다.');
  config=await response.json();
  store=createGameStore({config,storage:localStorage});
  return config;
}
const call=name=>(...args)=>{if(!store)throw new Error('게임 초기화를 먼저 실행해 주세요.');return store[name](...args);};
export const registerArea=call('registerArea'),getState=call('getState'),updateArea=call('updateArea'),applyEffect=call('applyEffect');
export const subscribe=call('subscribe'),onTimeAdvance=call('onTimeAdvance'),onSettlement=call('onSettlement'),onSettlementEnd=call('onSettlementEnd');
export const startGame=call('startGame'),saveGame=call('saveGame'),loadGame=call('loadGame'),newGame=call('newGame');
export const advanceDays=call('advanceDays'),setPaused=call('setPaused'),setSpeed=call('setSpeed');
export const getConfig=()=>config;


// 달력과 시간 진행은 같은 상태를 읽습니다. 별도의 날짜/저장 인스턴스를 만들지 않습니다.
export async function initCalendar() {
  const { createCalendarView } = await import('./calendarView.js');
  const trigger = document.querySelector('#game-date'), panel = document.querySelector('#game-calendar');
  if (!trigger || !panel) return null;
  const data = getConfig();
  const view = createCalendarView({ trigger, panel, label: trigger.querySelector('#game-date-label'), sub: trigger.querySelector('#game-date-sub'), events: data.calendar.events, source: data.calendar.source, today: data.initialDate });
  let previous = '';
  subscribe(state => {
    const date = state.time.date, key = `${date.year}-${date.month}-${date.day}`;
    if (key !== previous) { previous = key; view.setDate(date); }
  });
  return view;
}
