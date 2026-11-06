import * as THREE from 'three';
import { getPassageOffset } from '../scene/passageLayout.js';
const R={x:-.782,z:-.623},D={x:.623,z:-.782};
const norm=Math.hypot(R.x,R.z);for(const v of [R,D]){v.x/=norm;v.z/=norm;}
const world=(h,v,y=0)=>new THREE.Vector3(R.x*h+D.x*v,y,R.z*h+D.z*v);
function inside(x,z,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}

export function createScenery(buildings,scene) {
 let seed=240503;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const outlines=buildings.map(building=>{const o=getPassageOffset(building.outline);return building.outline.map(([x,z])=>[x+o.x,z+o.z]);});
 const coords=outlines.flat().map(([x,z])=>({h:x*R.x+z*R.z,v:x*D.x+z*D.z}));
 const minH=Math.min(...coords.map(p=>p.h))-60,maxH=Math.max(...coords.map(p=>p.h))+60;
 const minV=Math.min(...coords.map(p=>p.v))-60,maxV=Math.max(...coords.map(p=>p.v))+60;
 const group=new THREE.Group();group.name='living-campus';scene.add(group);
 function free(h,v,pad=7){const p=world(h,v);return !outlines.some(poly=>[[0,0],[pad,0],[-pad,0],[0,pad],[0,-pad]].some(([x,z])=>inside(p.x+x,p.z+z,poly)));}
 // 캠퍼스 장식 범위와 별개로 바닥을 넓게 유지해 섬처럼 보이는 가장자리를 없앱니다.
 const grassMaterial=new THREE.MeshLambertMaterial({color:0x80b85d,flatShading:true,side:THREE.DoubleSide});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(20000,20000,20,20).rotateX(-Math.PI/2),grassMaterial);
 ground.position.y=-.4;ground.name='continuous-ground';group.add(ground);
 const roadSegments=[],routes=[];
 function addRoad(points,along){let run=[];
   const flush=()=>{if(run.length>=3)routes.push(run);run=[];};
   for(const p of points){if(!free(p.h,p.v,9)){flush();continue;}run.push(p);
    if(run.length>1){const prev=run.at(-2);roadSegments.push({h:(p.h+prev.h)/2,v:(p.v+prev.v)/2,along});}
   }flush();
 }
 for(const h of [-216,-57,55,186,235]){const points=[];for(let v=minV+25;v<maxV-25;v+=12)points.push({h,v});addRoad(points,true);}
 for(const v of [-212,266,180]){const points=[];for(let h=minH+25;h<maxH-25;h+=12)points.push({h,v});addRoad(points,false);}
 const road=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0xd7d6ba,side:THREE.DoubleSide}),roadSegments.length);
 const dummy=new THREE.Object3D();
 roadSegments.forEach((p,i)=>{dummy.position.copy(world(p.h,p.v,.02));dummy.rotation.set(0,-Math.atan2(R.z,R.x),0);dummy.scale.set(p.along?9:12.5,1,p.along?12.5:9);dummy.updateMatrix();road.setMatrixAt(i,dummy.matrix);});group.add(road);
 const trees=[];for(let attempt=0;attempt<1800&&trees.length<85;attempt++){
  const h=minH+25+random()*(maxH-minH-50),v=minV+25+random()*(maxV-minV-50);
  if(free(h,v,12)&&!roadSegments.some(p=>Math.hypot(p.h-h,p.v-v)<18)&&!trees.some(t=>Math.hypot(t.h-h,t.v-v)<20))trees.push({h,v,size:.8+random()*.7});
 }
 const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1,1.5,7,5),new THREE.MeshLambertMaterial({color:0x846448,flatShading:true}),trees.length);
 const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(6.8,0),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),trees.length);
 trees.forEach((t,i)=>{dummy.rotation.set(0,i,0);dummy.scale.setScalar(t.size);dummy.position.copy(world(t.h,t.v,3));dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=10*t.size;dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new THREE.Color(0x458b44));});group.add(trunks,leaves);
 const count=Math.min(28,routes.length*3),actors=Array.from({length:count},(_,i)=>({route:routes[i%routes.length],phase:random(),speed:2.5+random()*3}));
 const heads=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.8,0),new THREE.MeshLambertMaterial({color:0xf0c898,flatShading:true}),count);
 const bodies=new THREE.InstancedMesh(new THREE.ConeGeometry(2.4,5,5),new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),count);
 const legs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,3,1),new THREE.MeshLambertMaterial({color:0x3a4c53}),count*2);
 const outfits=[0x2b7760,0xe4b15a,0xf4e9d0,0xc36d5c,0x5a7c9d];actors.forEach((a,i)=>bodies.setColorAt(i,new THREE.Color(outfits[i%outfits.length])));
 group.add(heads,bodies,legs);
 for(const mesh of [heads,bodies,legs])mesh.frustumCulled=false;
 let lastMonth=null;
 function update(elapsed,state,mode='auto'){
  const month=state?.time.date.month||3;
  if(month!==lastMonth){lastMonth=month;trees.forEach((t,i)=>{
    const color=[3,4].includes(month)?(i%3?0xe6b3c4:0x68a95b):[10,11].includes(month)?[0xc28a45,0xd4ac55,0x7f9e4a][i%3]:[12,1,2].includes(month)?0xb9ccb2:0x458b44;leaves.setColorAt(i,new THREE.Color(color));
   });if(leaves.instanceColor)leaves.instanceColor.needsUpdate=true;grassMaterial.color.setHex([12,1,2].includes(month)?0xa6baa0:0x80b85d);}
  actors.forEach((a,i)=>{
   const route=a.route,total=route.length-1,progress=(a.phase*total+elapsed*a.speed/12)%(total*2),step=progress>total?total*2-progress:progress;
   const j=Math.min(total-1,Math.floor(step)),mix=step-j,p=route[j],q=route[j+1];const h=p.h+(q.h-p.h)*mix,v=p.v+(q.v-p.v)*mix;
   dummy.rotation.set(0,Math.atan2(q.h-p.h,q.v-p.v),0);dummy.scale.set(1,1,1);dummy.position.copy(world(h,v,5));dummy.updateMatrix();bodies.setMatrixAt(i,dummy.matrix);dummy.position.y=8.4;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);
   for(let leg=0;leg<2;leg++){dummy.position.copy(world(h+(leg?1:-1)*.7,v+Math.sin(elapsed*7+i+leg*Math.PI)*.7,1.5));dummy.updateMatrix();legs.setMatrixAt(i*2+leg,dummy.matrix);}
  });for(const mesh of [heads,bodies,legs])mesh.instanceMatrix.needsUpdate=true;
  const daylight=mode==='night'?.15:mode==='day'?1:Math.max(.15,(Math.sin(elapsed/45)+1)/2);
  return daylight;
 }
 update(0,null,'day');
 return {update,bounds:new THREE.Box3().setFromPoints([world(minH,minV),world(maxH,maxV),world(minH,maxV),world(maxH,minV)]),studentCount:count,treeCount:trees.length};
}
