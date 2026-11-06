import * as THREE from 'three';
import { getState, subscribe, applyEffect } from '../game/index.js';
import { formatWon, eventIdOf } from '../decisions/model.js';
import { requestGoal, feedbackText } from './model.js';
import { readCharacter } from '../character/storage.js';
import { renderAvatar, resolveAvatarIndex } from '../character/avatars.js?v=4';
import { baseAvatar } from '../character/baseAvatar.js?v=4';

export async function initExperience({container,anchors}) {
  const response=await fetch(new URL('../../public/data/decisions.json',import.meta.url));
  if(!response.ok)throw new Error('목표 데이터를 불러올 수 없습니다.');
  const {events}=await response.json();
  const profile=readCharacter();
  document.querySelector('#narrator-portrait').innerHTML=renderAvatar(baseAvatar,resolveAvatarIndex(profile.avatar,profile.gender));
  document.querySelector('#narrator-name').textContent=profile.name+' · 캠퍼스 안내';
  window.addEventListener('campus:event-open',event=>{document.querySelector('#narrator-line').textContent=event.detail.title+' 학생의 이야기를 듣고 결정해 주세요.';});
  let selected=null,previous=null,sound=false,audio=null;
  window.addEventListener('campus:select',event=>{selected=event.detail.buildingId;});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layer=document.createElement('div');layer.className='feedback-layer';container.append(layer);
  const popups=[],animations=new Map();
  const anchorById=new Map(anchors.map(anchor=>[anchor.building.id,anchor]));
  const soundButton=document.querySelector('#sound-toggle');
  soundButton.addEventListener('click',()=>{sound=!sound;soundButton.textContent=sound?'소리 켜짐':'소리 꺼짐';soundButton.setAttribute('aria-pressed',String(sound));if(sound)tone();});
  function tone() {
    if(!sound)return;
    try {
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.type='sine';oscillator.frequency.setValueAtTime(520,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(880,audio.currentTime+.12);
      gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.22);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.23);
    }catch{/* 음향이 지원되지 않아도 게임은 계속됩니다. */}
  }
  function metric(id,value,formatter) {
    const el=document.querySelector(id),old=animations.get(id);
    if(old)cancelAnimationFrame(old.frame);
    const from=old?.value??value;
    if(reduced||from===value){el.textContent=formatter(value);animations.set(id,{value});return;}
    const began=performance.now(),animation={value:from,frame:0};animations.set(id,animation);
    function step(now){const t=Math.min(1,(now-began)/650);animation.value=from+(value-from)*(1-(1-t)**3);el.textContent=formatter(animation.value);if(t<1)animation.frame=requestAnimationFrame(step);}
    animation.frame=requestAnimationFrame(step);
  }
  function showEffect(entry) {
    const event=events.find(event=>event.id===eventIdOf(entry.id));
    const anchor=anchorById.get(event?.buildingId||selected);
    const element=document.createElement('div');element.className='floating-effect';
    const title=document.createElement('b');title.textContent=entry.source==='experience'?'목표 달성!':entry.satisfaction>0?'개선 완료!':'결정 반영';
    const detail=document.createElement('span');detail.textContent=feedbackText(entry)||'결정을 기록했습니다.';element.append(title,detail);layer.append(element);
    popups.push({anchor,element,began:performance.now()});tone();
    document.querySelector('#narrator-line').textContent=title.textContent+' '+(feedbackText(entry)||'지표 변화 없음')+(entry.source==='decisions'?'. 어제 결정한 조치가 오늘 반영됐어요.':'.');
  }
  subscribe(state=>{
    const {budget,satisfaction,reputation}=state.metrics;
    metric('#hud-budget',budget,n=>'₩ '+formatWon(Math.round(n)));
    metric('#hud-satisfaction',satisfaction,n=>String(Math.round(n)));
    metric('#hud-reputation',reputation,n=>String(Math.round(n)));
    document.querySelector('#hud-budget-note').textContent='누적 증감 '+formatWon(budget-state.initialBudget,true);
    document.querySelector('#hud-satisfaction-note').textContent=satisfaction>=85?'학생들이 만족하고 있어요':'학생의 이야기를 들어 주세요';
    document.querySelector('#hud-reputation-note').textContent=reputation>=70?'좋은 평가를 받고 있어요':'학교의 신뢰를 쌓아 주세요';
    document.querySelector('#sat-gauge').style.width=satisfaction+'%';document.querySelector('#rep-gauge').style.width=reputation+'%';
    if(previous){const known=new Set(previous.ledger.map(e=>e.id));for(const entry of state.ledger)if(!known.has(entry.id)&&['decisions','experience'].includes(entry.source))showEffect(entry);}
    previous=state;
    const {year,quarter,count,earned,effect}=requestGoal(state);
    document.querySelector('#goal-period').textContent=`${year}년 ${quarter}분기 목표`;
    document.querySelector('#goal-title').textContent=earned?'학생의 목소리에 귀 기울인 총장님!':'학생 요청 3건에 응답하기';
    document.querySelector('#goal-progress').value=Math.min(3,count);
    document.querySelector('#goal-detail').textContent=earned?'완료 · 학생 만족도 +1 · 학교 평판 +2':`${Math.min(3,count)} / 3 · 보상: 만족도 +1 · 평판 +2`;
    // 반복 알림 중에도 고유 ID로 한 번만 보상합니다.
    if(effect)applyEffect(effect);
  });
  const projected=new THREE.Vector3();
  return {
    getLightingMode:()=>document.querySelector('#lighting-mode').value,
    update(camera,width,height){
      const now=performance.now();
      for(let i=popups.length-1;i>=0;i--){const p=popups[i],age=(now-p.began)/2200;if(age>=1){p.element.remove();popups.splice(i,1);continue;}
        let x=width/2,y=height/2;
        if(p.anchor){projected.copy(p.anchor.position).project(camera);x=(projected.x+1)*width/2;y=(1-projected.y)*height/2;p.element.hidden=projected.z>1||projected.z< -1;}
        p.element.style.left=Math.max(110,Math.min(width-110,x))+'px';p.element.style.top=Math.max(80,Math.min(height-100,y))-(reduced?0:age*48)+'px';p.element.style.opacity=String(Math.min(1,(1-age)*3));
      }
    },
  };
}
