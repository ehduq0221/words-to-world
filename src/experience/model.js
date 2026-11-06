export function requestGoal(state) {
  const date=state.time.date,quarter=Math.ceil(date.month/3),period=`${date.year}-Q${quarter}`;
  const count=state.ledger.filter(e=>e.source==='decisions'&&e.date.year===date.year&&Math.ceil(e.date.month/3)===quarter).length;
  const id='experience:requests:'+period;
  const earned=state.ledger.some(e=>e.id===id);
  return {year:date.year,quarter,count,earned,effect:count>=3&&!earned?{id,satisfaction:1,reputation:2,reason:`${period} 학생 요청 목표 달성`,source:'experience'}:null};
}
export function feedbackText(entry) {
  return [['satisfaction','학생 만족도'],['reputation','학교 평판']].filter(([key])=>entry[key]).map(([key,label])=>`${label} ${entry[key]>0?'+':''}${entry[key]}`).join(' · ');
}
