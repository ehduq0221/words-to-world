import {getState,subscribe,setPaused} from '../game/index.js';
import {festivalSeason} from './season.js';
export async function initFestivalMapEvent({container,anchors}){
 const response=await fetch(new URL('../../public/data/festival-schedule.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error('축제 시즌 설정을 불러오지 못했습니다.');
 const schedule=await response.json(),anchor=anchors.find(a=>a.building.id===schedule.venueId);if(!anchor)throw new Error('축제 운동장을 찾을 수 없습니다.');
 const layer=document.createElement('div');layer.className='festival-event-layer';
 const button=document.createElement('button');button.type='button';button.className='festival-map-event';button.innerHTML='<b>!</b><span>대동제</span>';button.hidden=true;layer.append(button);container.append(layer);
 const banner=document.createElement('p');banner.className='festival-season-banner';banner.hidden=true;container.append(banner);
 button.addEventListener('click',()=>{if(!festivalSeason(getState().time.date,schedule))return;setPaused(true);window.location.href=new URL('../../festival.html',import.meta.url).href;});
 let season=null;
 subscribe(state=>{season=festivalSeason(state.time.date,schedule);button.hidden=!season;banner.hidden=!season;if(season){button.setAttribute('aria-label',`대운동장 ${season.name} 축제 창 열기`);banner.textContent=`♫ ${season.name} 시즌 · 대운동장의 !에서 축제 참여`;}});
 return {update(camera,width,height){if(!season)return;const p=anchor.position.clone().project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2-48;button.hidden=p.z< -1||p.z>1||x<0||x>width||y<0||y>height;if(!button.hidden){button.style.left=x+'px';button.style.top=y+'px';}}};
}
