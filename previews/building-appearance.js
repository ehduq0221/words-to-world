import * as THREE from 'three';
import { makeDetailedBuilding } from '../src/scene/createDetailedBuilding.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { buildingDesigns as designs } from '../src/scene/buildingAppearance.js';
const materialCache=new Map();
const material=color=>{if(!materialCache.has(color))materialCache.set(color,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));return materialCache.get(color);};
const R={x:-.7821357123,z:-.6231081186},D={x:.6231081186,z:-.7821357123};
const project=([x,z])=>[x*R.x+z*R.z,x*D.x+z*D.z];
function makeModel(building,design,proposed){
 if(proposed)return makeDetailedBuilding(building,design);
 const group=new THREE.Group();const outline=building.outline.map(project),holes=building.holes.map(r=>r.map(project));
 const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0])),minZ=Math.min(...outline.map(p=>p[1])),maxZ=Math.max(...outline.map(p=>p[1]));
 const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
 const shape=new THREE.Shape();
 function ring(path,points){points.forEach(([x,z],i)=>i?path.lineTo(x-centerX,-z+centerZ):path.moveTo(x-centerX,-z+centerZ));path.closePath();}
 ring(shape,outline);for(const h of holes){const path=new THREE.Path();ring(path,h);shape.holes.push(path);}
 const H=building.height;
 const geo=new THREE.ExtrudeGeometry(shape,{depth:H,bevelEnabled:false,steps:1});geo.rotateX(-Math.PI/2);
 group.add(new THREE.Mesh(geo,material('#c7d8d0')));
 return group;
}
function makeView(element,model){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));element.append(renderer.domElement);
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff9ed','#87967f',1.7));const sun=new THREE.DirectionalLight('#fffdf2',2.1);sun.position.set(-70,150,100);scene.add(sun);scene.add(model);
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const span=Math.max(size.x,size.z,size.y*2),camera=new THREE.PerspectiveCamera(36,1,.1,5000);
 const controls=new OrbitControls(camera,renderer.domElement);controls.target.copy(center);controls.enablePan=false;controls.minDistance=span*.5;controls.maxDistance=span*4;controls.maxPolarAngle=Math.PI*.48;
 const floor=new THREE.Mesh(new THREE.CircleGeometry(span*.68,64).rotateX(-Math.PI/2),material('#e0e9d5'));floor.position.y=-.3;scene.add(floor);
 const render=()=>renderer.render(scene,camera);
 function resize(){renderer.setSize(element.clientWidth,element.clientHeight);camera.aspect=element.clientWidth/element.clientHeight;camera.updateProjectionMatrix();render();}
 function reset(){const d=span*1.8;camera.position.set(center.x+d*.55,center.y+d*.7,center.z+d*.8);controls.target.copy(center);controls.update();resize();}
 reset();return {camera,controls,render,resize,reset};
}
try {
 const response=await fetch('../public/data/campus.json');if(!response.ok)throw Error('건물 데이터를 불러올 수 없습니다.');
 const {buildings}=await response.json();const views=[];
 for(const design of designs){
  const building=buildings.find(b=>b.id===design.id);if(!building)throw Error(design.title+' 형상을 찾을 수 없습니다.');
  const card=document.createElement('article');card.className='card';
  card.innerHTML=`<div class="card-head"><span class="number">${design.number}호관</span><h2>${design.title}</h2><button class="expand-view" aria-expanded="false">크게 보기</button><p>기존 외곽선 · 입면과 주요 구조 보완</p></div><div class="view current"><span>현재 · 공통 녹색</span></div><div class="view proposed"><span>상세 제안 · 입면과 구조</span></div><div class="palette"></div><div class="card-foot"><p>${design.description}</p><a href="${design.source}" target="_blank" rel="noreferrer">참고한 인천대학교 공식 사진 ↗</a></div>`;
  document.querySelector('#cards').append(card);
  const palette=card.querySelector('.palette');for(const [key,label] of [['wall','외벽'],['base','하부'],['roof','지붕'],['glass','유리']]){const chip=document.createElement('span');chip.className='swatch';const dot=document.createElement('i');dot.style.background=design[key];chip.append(dot,document.createTextNode(label));palette.append(chip);}
  const pair=[makeView(card.querySelector('.current'),makeModel(building,design,false)),makeView(card.querySelector('.proposed'),makeModel(building,design,true))];
  // 같은 건물의 비교 시점을 동기화합니다.
  let syncing=false;for(let i=0;i<2;i++)pair[i].controls.addEventListener('change',()=>{if(syncing)return;syncing=true;const from=pair[i],to=pair[1-i];to.camera.position.copy(from.camera.position);to.controls.target.copy(from.controls.target);to.controls.update();pair.forEach(v=>v.render());syncing=false;});
  pair[1].camera.position.copy(pair[0].camera.position);pair[1].controls.target.copy(pair[0].controls.target);pair[1].controls.update();pair.forEach(v=>v.render());views.push(...pair);
  card.querySelector('.expand-view').addEventListener('click',event=>{
   const expanded=card.classList.toggle('is-expanded');event.target.textContent=expanded?'접기':'크게 보기';event.target.setAttribute('aria-expanded',String(expanded));pair.forEach(v=>v.resize());
  });
 }
 document.querySelector('#reset').addEventListener('click',()=>views.forEach(view=>view.reset()));
 window.addEventListener('resize',()=>views.forEach(view=>view.resize()));document.querySelector('#status').hidden=true;
}catch(error){document.querySelector('#status').textContent=error.message;console.error(error);}
