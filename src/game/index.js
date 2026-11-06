import { createGameStore } from './store.js';
export { dateKey, semesterOf } from './store.js';
// 학생 반응은 통합된 5단계에 연결합니다. 모든 기능은 이 진입점을 사용합니다.
export { addReaction, registerDialogues } from '../reactions/index.js';
let store=null,config=null;
export async function initGame() {
  const response=await fetch(new URL('../../public/data/game.json',import.meta.url));
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
