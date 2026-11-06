const DAY=86400000;
const stamp=date=>Date.UTC(date.year,date.month-1,date.day);
export const historyDate=ms=>new Date(ms).toISOString().slice(0,10);
export function metricHistory(state,metric,range=90,initialDate){
 if(!['budget','satisfaction','reputation'].includes(metric))throw new Error('지표를 확인해 주세요.');
 const entries=state.ledger.map((entry,index)=>({day:stamp(entry.date),value:entry[metric]||0,index})).sort((a,b)=>a.day-b.day||a.index-b.index);
 const end=stamp(state.time.date),first=Math.min(stamp(initialDate),entries[0]?.day??end);
 const start=range==='all'?first:Math.max(first,end-(Number(range)-1)*DAY);
 let value=state.metrics[metric]-entries.reduce((sum,e)=>sum+e.value,0),index=0;
 while(index<entries.length&&entries[index].day<start)value+=entries[index++].value;
 const step=Math.max(1,Math.ceil(((end-start)/DAY+1)/180)),points=[];
 for(let day=start;day<=end;){
  const until=Math.min(end,day+(step-1)*DAY),open=value;let high=value,low=value;
  while(index<entries.length&&entries[index].day<=until){value+=entries[index++].value;high=Math.max(high,value);low=Math.min(low,value);}
  points.push({date:historyDate(until),open,high,low,close:value});day=until+DAY;
 }
 return points;
}
