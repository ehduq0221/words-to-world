import {waitingEvents} from './model.js';
export const CARE_POLICY={graceDays:7,repeatDays:7,satisfactionPerRequest:.75,reputationPerRequest:.4};
function drift(value,baseline,normal,high,peak){
 const rate=value>90?peak:value>80?high:normal;
 return value>baseline?Math.min(value-baseline,rate):0;
}
export function neglectedRequests(events,state,limit=3){
 return waitingEvents(events,state,limit).map(event=>({event,age:Math.max(0,state.time.dayCount-(state.decisions.releasedOn?.[event.id]??state.time.dayCount))}));
}
export function careEffect(events,state,limit=3){
 if(state.time.dayCount<=0)return null;
 const waiting=neglectedRequests(events,state,limit);
 const overdue=waiting.filter(item=>item.age>=CARE_POLICY.graceDays&&(item.age-CARE_POLICY.graceDays)%CARE_POLICY.repeatDays===0);
 const pressure=overdue.reduce((sum,item)=>sum+(item.age>=21?2:1),0);
 const satisfaction=-(drift(state.metrics.satisfaction,76,.05,.15,.3)+Math.min(3,pressure*CARE_POLICY.satisfactionPerRequest));
 const reputation=-(drift(state.metrics.reputation,68,.03,.1,.2)+Math.min(2,pressure*CARE_POLICY.reputationPerRequest));
 if(!satisfaction&&!reputation)return null;
 const date=state.time.date,key=`${date.year}-${String(date.month).padStart(2,'0')}-${String(date.day).padStart(2,'0')}`;
 return {id:`care:${key}`,satisfaction:Math.round(satisfaction*10000)/10000,reputation:Math.round(reputation*10000)/10000,reason:overdue.length?`미처리 안건 ${overdue.length}건 장기 방치 · 일상 유지관리`:'시간 경과에 따른 일상 유지관리',source:'campus-care'};
}
