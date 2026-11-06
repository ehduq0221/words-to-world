import {getState,getConfig,subscribe} from './index.js';
import {metricHistory} from './historyModel.js';
import {formatWon} from '../decisions/model.js';
const names={budget:'운영 예산',satisfaction:'학생 만족도',reputation:'학교 평판'};
const fmt=(metric,value)=>metric==='budget'?formatWon(Math.round(value))+' 원':Number(value.toFixed(2)).toLocaleString('ko-KR')+'점';
export function initMetricHistory(){
 const root=document.querySelector('#metrics-history');
 root.innerHTML=`<p class="history-intro">운영 기록으로 보는 학교의 변화</p><div class="history-metrics" role="group" aria-label="차트 지표"></div><div class="history-tools"><span id="history-period"></span><div role="group" aria-label="차트 기간"><button data-range="30">1개월</button><button data-range="90">3개월</button><button data-range="180">6개월</button><button data-range="all">전체</button></div></div><div class="history-readout"><b id="history-value"></b><span id="history-change"></span><small id="history-date"></small></div><div class="history-plot"><svg viewBox="0 0 760 260" role="img" aria-label="운영 지표 추이" id="history-svg"></svg></div><label class="history-inspect">날짜별 확인<input id="history-cursor" type="range" min="0" max="0" value="0" aria-label="차트 날짜 선택"></label><p class="history-footnote">실제 게임 정산 기록 기준 · 날짜별 종가/최고/최저 · 표시할 기록이 없는 날은 이전 값을 유지합니다.</p>`;
 const cards=root.querySelector('.history-metrics');
 for(const [key,title]of Object.entries(names)){
  const button=document.createElement('button');button.dataset.metric=key;button.innerHTML=`<span>${title}</span><strong></strong><small></small>`;cards.append(button);
 }
 let metric='budget',range=90,points=[],xs=[],ys=[];
 const svg=root.querySelector('svg'),cursor=root.querySelector('#history-cursor');
 const ns='http://www.w3.org/2000/svg';
 const node=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));if(text!==undefined)n.textContent=text;return n;};
 function inspect(index){
  const p=points[index];if(!p)return;
  const delta=p.close-p.open;
  root.querySelector('#history-value').textContent=fmt(metric,p.close);
  root.querySelector('#history-change').textContent=(delta>0?'+':'')+fmt(metric,delta)+' (당일)';
  root.querySelector('#history-change').dataset.direction=delta<0?'down':'up';
  root.querySelector('#history-date').textContent=`${p.date} · 최고 ${fmt(metric,p.high)} · 최저 ${fmt(metric,p.low)}`;
  svg.querySelector('#history-crosshair')?.remove();
  const group=node('g',{id:'history-crosshair'});group.append(node('line',{x1:xs[index],x2:xs[index],y1:16,y2:222,stroke:'#99b09f','stroke-dasharray':'4 4'}),node('circle',{cx:xs[index],cy:ys[index],r:4,fill:'#fff',stroke:'#2d8b61','stroke-width':2}));svg.append(group);cursor.value=String(index);
 }
 function render(state=getState()){
  if(!state)return;
  for(const button of cards.children){const key=button.dataset.metric,series=metricHistory(state,key,range,getConfig().initialDate),delta=state.metrics[key]-series[0].open;button.setAttribute('aria-pressed',String(key===metric));button.querySelector('strong').textContent=fmt(key,state.metrics[key]);button.querySelector('small').textContent=`기간 증감 ${delta>0?'+':''}${fmt(key,delta)}`;}
  points=metricHistory(state,metric,range,getConfig().initialDate);
  root.querySelectorAll('[data-range]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.range===String(range))));
  root.querySelector('#history-period').textContent=points[0].date+' ~ '+points.at(-1).date;
  let min=Math.min(...points.map(p=>p.low)),max=Math.max(...points.map(p=>p.high));const margin=Math.max((max-min)*.15,metric==='budget'?1000000:1);min-=margin;max+=margin;
  if(metric!=='budget'){min=Math.max(0,min);max=Math.min(100,max);}
  const x=i=>48+i/Math.max(1,points.length-1)*650,y=v=>222-(v-min)/(max-min)*200;
  xs=points.map((p,i)=>x(i));ys=points.map(p=>y(p.close));svg.replaceChildren();
  const defs=node('defs',{}),gradient=node('linearGradient',{id:'history-fill',x1:0,y1:0,x2:0,y2:1});gradient.append(node('stop',{offset:'0%', 'stop-color':'#4aa477','stop-opacity':'.28'}),node('stop',{offset:'100%', 'stop-color':'#4aa477','stop-opacity':'.01'}));defs.append(gradient);svg.append(defs);
  for(let i=0;i<=4;i++){const value=min+(max-min)*i/4,yy=y(value);svg.append(node('line',{x1:48,x2:698,y1:yy,y2:yy,stroke:'#dce8df','stroke-dasharray':'3 4'}),node('text',{x:704,y:yy+3,'font-size':9,fill:'#819588'},metric==='budget'?formatWon(Math.round(value)):value.toFixed(0)));}
  const path=points.map((p,i)=>(i?'L':'M')+xs[i]+','+ys[i]).join(' ');
  svg.append(node('path',{d:path+` L${xs.at(-1)},222 L${xs[0]},222 Z`,fill:'url(#history-fill)'}),node('path',{d:path,fill:'none',stroke:'#318a60','stroke-width':2.5,'stroke-linejoin':'round'}));
  if(points.length===1)svg.append(node('circle',{cx:xs[0],cy:ys[0],r:4,fill:'#318a60'}));
  for(const i of [...new Set([0,Math.floor((points.length-1)/2),points.length-1])])svg.append(node('text',{x:xs[i],y:245,'font-size':10,fill:'#819588','text-anchor':i===0?'start':i===points.length-1?'end':'middle'},points[i].date.slice(5)));
  cursor.max=String(points.length-1);inspect(points.length-1);
  svg.setAttribute('aria-label',`${names[metric]} 추이, ${points[0].date}부터 ${points.at(-1).date}까지, 현재 ${fmt(metric,state.metrics[metric])}`);
 }
 root.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.dataset.metric){metric=button.dataset.metric;render();}if(button?.dataset.range){range=button.dataset.range==='all'?'all':Number(button.dataset.range);render();}});
 cursor.addEventListener('input',()=>inspect(Number(cursor.value)));
 svg.addEventListener('pointermove',event=>{const rect=svg.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*760;inspect(Math.max(0,Math.min(points.length-1,Math.round((x-48)/650*(points.length-1)))));});
 svg.addEventListener('pointerleave',()=>inspect(points.length-1));
 document.querySelector('#game-menu-open').addEventListener('click',()=>render());
 subscribe(state=>{if(document.querySelector('#game-menu').open)render(state);});
}
