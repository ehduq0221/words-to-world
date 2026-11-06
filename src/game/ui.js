import { getState, subscribe, advanceDays, setPaused, setSpeed, saveGame, loadGame, newGame, getConfig } from './index.js';
import { dateKey } from './store.js';
import { formatWon } from '../decisions/model.js';
export function initGameUI() {
  const notice=document.querySelector('#game-notice');
  const menu=document.querySelector('#game-menu');
  const report=document.querySelector('#ledger-dialog');
  const tell=text=>{notice.textContent=text;};
  const guard=action=>()=>{try{action();}catch(error){tell(error.message);}};
  document.querySelector('#game-menu-open').addEventListener('click',()=>menu.showModal());
  document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
  document.querySelector('#time-toggle').addEventListener('click',guard(()=>setPaused(!getState().time.paused)));
  document.querySelector('#game-speed').addEventListener('change',event=>guard(()=>setSpeed(Number(event.target.value)))());
  document.querySelector('#save-game').addEventListener('click',guard(()=>{saveGame();tell('게임을 저장했습니다.');}));
  document.querySelector('#load-game').addEventListener('click',guard(()=>{loadGame();tell('저장한 날짜와 운영 상태를 불러왔습니다.');menu.close();}));
  document.querySelector('#new-game').addEventListener('click',()=>document.querySelector('#new-game-confirm').showModal());
  document.querySelector('#confirm-new-game').addEventListener('click',guard(()=>{newGame();document.querySelector('#new-game-confirm').close();menu.close();tell('새 임기를 시작합니다. 캐릭터 정보는 유지했습니다.');}));
  document.querySelector('#ledger-open').addEventListener('click',()=>report.showModal());
  subscribe(state=>{
    const {date,paused,speed,semester}=state.time;
    document.querySelector('#game-semester').textContent=paused?'일시정지':'운영 중';
    document.querySelector('#time-toggle').textContent=paused?'▶ 진행':'Ⅱ 일시정지';
    document.querySelector('#time-toggle').setAttribute('aria-pressed',String(!paused));
    document.querySelector('#game-speed').value=String(speed);
    const key=dateKey(date).slice(0,7);
    const monthly=state.ledger.filter(entry=>dateKey(entry.date).startsWith(key));
    const income=monthly.reduce((s,e)=>s+Math.max(0,e.budget),0),expense=monthly.reduce((s,e)=>s+Math.max(0,-e.budget),0);
    document.querySelector('#finance-income').textContent=formatWon(income,true);
    document.querySelector('#finance-expense').textContent=formatWon(-expense);
    document.querySelector('#finance-balance').textContent=formatWon(income-expense,true)+' 원';
    document.querySelector('#budget-reconciled').textContent='시작 예산 + 누적 정산 = '+formatWon(state.metrics.budget)+' 원';
    const entries=document.querySelector('#ledger-entries');
    entries.replaceChildren(...state.ledger.slice(-100).reverse().map(entry=>{
      const li=document.createElement('li');
      const text=document.createElement('span');text.textContent=`${dateKey(entry.date)} · ${entry.reason}`;
      const amount=document.createElement('b');amount.textContent=entry.budget?formatWon(entry.budget,true)+' 원':`만족도 ${entry.satisfaction>0?'+':''}${entry.satisfaction} · 평판 ${entry.reputation>0?'+':''}${entry.reputation}`;
      li.append(text,amount);return li;
    }));
    if(!entries.children.length){const empty=document.createElement('li');empty.textContent='아직 정산 내역이 없습니다.';entries.append(empty);}
    const evaluation=state.evaluations.at(-1);
    document.querySelector('#term-evaluation').textContent=evaluation?`${evaluation.semester} 임기 평가 ${evaluation.grade} · ${evaluation.score}점`:'첫 학기 평가를 준비하고 있어요';
    const today=dateKey(date);
    const calendar=getConfig().calendar.events.filter(event=>today>=event.start&&today<=event.end);
    document.querySelector('#calendar-label').textContent=calendar.map(event=>event.title).join(' · ') || ([7,8,1,2].includes(date.month)?'방학 · 다음 학기 준비':date.month===4?'봄 캠퍼스 · 벚꽃':'캠퍼스 운영');
    document.querySelector('#calendar-label').dataset.kind=calendar.some(event=>/시험/.test(event.title))?'exam':'normal';
  });
  // 브라우저를 떠난 동안 날짜를 진행시키지 않습니다.
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&getState()&&!getState().time.paused)guard(()=>setPaused(true))();});
  let elapsed=0,last=performance.now();
  setInterval(()=>{
    const now=performance.now(),delta=Math.min(now-last,1000);last=now;
    const state=getState();if(!state||state.time.paused||document.hidden){elapsed=0;return;}
    elapsed+=delta*state.time.speed;
    if(elapsed>=getConfig().dayDurationMs){elapsed=0;try{advanceDays(1);}catch(error){try{setPaused(true);}catch{}tell(error.message);}}
  },150);
}
