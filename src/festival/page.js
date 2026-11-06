import {initFestival} from './index.js';
import {festivalSeason} from './season.js';
async function start(){
 try{
  const response=await fetch(new URL('../../public/data/festival-schedule.json',import.meta.url),{cache:'no-store'});if(!response.ok)throw new Error('축제 일정을 읽을 수 없습니다.');
  const schedule=await response.json();let date=null;
  try{date=JSON.parse(localStorage.getItem('words-to-world:save'))?.state?.time?.date;}catch{}
  const season=date&&festivalSeason(date,schedule);
  document.querySelector('#festival-season-info').textContent=season?`${date.year}년 ${season.name} · 대운동장`:'대운동장 · 축제 기획 미리보기';
  await initFestival();
 }catch(error){document.querySelector('#festival').textContent=error.message;console.error(error);}
}
start();
