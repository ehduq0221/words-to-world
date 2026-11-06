import * as THREE from 'three';

// 공식 사진에서 관찰한 특징을 단순한 입체와 반복 부재로 재구성한 검토용 모델입니다.
// 바닥 외곽선은 기존 데이터이며, 층 구성·창 간격·세부 비율은 실측이 아닙니다.
const R={x:-.7821357123,z:-.6231081186},D={x:.6231081186,z:-.7821357123};
const project=([x,z])=>[x*R.x+z*R.z,x*D.x+z*D.z];
export function makeDetailedBuilding(building,design){
 const group=new THREE.Group(),points=building.outline.map(project);
 const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
 const minZ=Math.min(...points.map(p=>p[1])),maxZ=Math.max(...points.map(p=>p[1]));
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const ring=points.map(([x,z])=>[x-cx,z-cz]),W=maxX-minX,L=maxZ-minZ,H=building.height;
 const materials=new Map(),boxes=new Map();
 function mat(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:color===design.glass?.32:.85,metalness:color===design.glass?.25:0,side:THREE.DoubleSide}));return materials.get(color);}
 function box(w,h,d,x,y,z,color,angle=0){if(w<=0||h<=0||d<=0)return;const entries=boxes.get(color)||[];entries.push({w,h,d,x,y,z,angle});boxes.set(color,entries);}
 function extrude(lo,hi,color,scaleX=1,scaleZ=1){
  const shape=new THREE.Shape();
  function trace(path,coords){coords.forEach(([x,z],i)=>i?path.lineTo(x*scaleX,-z*scaleZ):path.moveTo(x*scaleX,-z*scaleZ));path.closePath();}
  trace(shape,ring);for(const hole of building.holes){const path=new THREE.Path();trace(path,hole.map(project).map(([x,z])=>[x-cx,z-cz]));shape.holes.push(path);}
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:hi-lo,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,lo,0);
  group.add(new THREE.Mesh(geometry,[mat(design.roof),mat(color)]));
 }
 const frame=design.kind==='college'?'#d0c6b5':'#dbe0dc',dark='#354952';
 function glazedEdge(a,b,bottom,top,{spacing=2.5,floors=2,margin=.45}={}){
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<1)return;
  const angle=-Math.atan2(dz,dx),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,ux=dx/length,uz=dz/length;
  // 두 면에 조금씩 돌출되는 얇은 패널로 어느 방향에서도 벽과 겹쳐 깜박이지 않습니다.
  const width=Math.max(.1,length-margin*2),height=top-bottom,y=(bottom+top)/2;
  box(width,height,.32,mx,y,mz,design.glass,angle);
  for(const v of [bottom,top])box(width+.24,.23,.55,mx,v,mz,frame,angle);
  const count=Math.max(1,Math.round(width/spacing));
  for(let i=0;i<=count;i++){const off=-width/2+width*i/count;box(.16,height,.6,mx+ux*off,y,mz+uz*off,frame,angle);}
  for(let f=1;f<floors;f++)box(width,.21,.55,mx,bottom+height*f/floors,mz,frame,angle);
 }
 function entrance(x,z,width){
  box(width,H*.16,.45,x,H*.08,z,dark);
  box(.18,H*.16,.65,x,H*.08,z+.12,frame);
  box(width+2,.45,3,x,H*.17,z+.8,frame);
  for(let i=0;i<3;i++)box(width+3+i*.8,.24,1.4,x,.12+i*.24,z+1.5+(2-i)*.55,'#bfc6b9');
 }
 if(design.kind==='library'){
  // 붉은 하부, 안으로 물린 유리 중층, 전면으로 돌출된 회색 상부.
  extrude(0,H*.27,design.base);
  extrude(H*.27,H*.63,design.glass,.86,.85);
  extrude(H*.63,H,design.wall);
  box(W*1.005,.55,L*1.005,0,H+.28,0,'#c9cecc');
  const frontZ=L*.425+.2;
  glazedEdge([-W*.41,frontZ],[W*.41,frontZ],.45,H*.62,{spacing:3,floors:4});
  glazedEdge([W*.43,-L*.40],[W*.43,L*.40],H*.27,H*.62,{spacing:3,floors:3});
  // 돌출된 상부를 받치는 기둥과 깊은 처마를 강조합니다.
  for(const x of [-W*.43,W*.43])box(1.3,H*.63,1.3,x,H*.315,L*.46,'#e2e4df');
  const faceZ=L*.49+.45,slots=Math.max(12,Math.round(W/4));
  for(let i=0;i<slots;i++){
   const x=-W*.45+W*.9*(i+.5)/slots;
   box(1.4,H*.27,.7,x,H*.81,faceZ,design.glass);
   box(.22,H*.32,1,x-1.0,H*.81,faceZ,frame);
  }
  // 측면에는 같은 세로 창 리듬을 사용합니다.
  for(let i=0;i<12;i++){const z=-L*.43+L*.86*(i+.5)/12;box(.6,H*.27,1.1,W*.495,H*.81,z,design.glass);}
  entrance(0,frontZ+.2,W*.13);
  box(W*.87,.5,1.4,0,H*.625,L*.45,'#47585b');
 }else if(design.kind==='college'){
  // ㄷ자 동은 유지하고 낮춘 몸체 위에 양끝의 열린 프레임을 세웁니다.
  const top=H*.86;extrude(0,top,design.wall);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(length>9)glazedEdge(a,b,H*.12,top-.6,{spacing:2.6,floors:5,margin:length>35?7:.9});
  }
  const front=L*.38;
  for(const x of [-W*.38,W*.38]){
   const opening=W*.13,pillar=1.55,frameTop=H*1.14,frameBottom=top-.15;
   for(const side of [-1,1])box(pillar,frameTop-frameBottom,3.0,x+side*opening/2,(frameTop+frameBottom)/2,front,design.base);
   box(opening+pillar,1.8,3.0,x,frameTop,front,design.base);
   box(opening+pillar+.45,.35,3.4,x,frameTop+1.05,front,'#efaa60');
  }
  // 층별 띠는 유리를 가로지르는 얇은 밝은 슬래브로만 표현합니다.
  
  for(let f=1;f<5;f++)box(W*.78,.45,.7,0,H*.12+(top-H*.12)*f/5,L*.48,'#b7b2a5');
  entrance(W*.05,L*.48,W*.14);
 }else{
  // 낮은 로비와 높은 무대부, 둥근 공연장 볼륨을 분리합니다.
  const top=H*.77;extrude(0,top,design.wall);
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(length>1.8)glazedEdge(a,b,.6,top-.65,{spacing:2.9,floors:2,margin:.18});
  }
  box(W*.27,H*.4,L*.38,-W*.29,top+H*.2,-L*.22,design.wall);
  box(W*.27+.4,.24,L*.38+.4,-W*.29,top+H*.4+.12,-L*.22,design.roof);
  for(let i=0;i<14;i++)box(.16,H*.29,.4,-W*.415+W*.25*i/13,top+H*.2,-L*.027,'#58676a');
  // 곡선 매스의 청회색 지붕과 성긴 리브. 내부 구조를 모델링하지 않습니다.
  const rx=W*.215,rz=L*.178,ry=H*.42,dx=W*.255,dz=L*.295;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1,24,8,0,Math.PI*2,0,Math.PI/2),mat('#94afb0'));
  dome.scale.set(rx,ry,rz);dome.position.set(dx,top+.08,dz);group.add(dome);
  for(let i=0;i<12;i++){
   const angle=i*Math.PI*2/12,vertices=[];
   for(let j=0;j<=12;j++){const t=j/12*Math.PI/2;vertices.push(new THREE.Vector3(dx+Math.cos(angle)*(rx+.08)*Math.sin(t),top+.13+(ry+.08)*Math.cos(t),dz+Math.sin(angle)*(rz+.08)*Math.sin(t)));}
   group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),new THREE.LineBasicMaterial({color:'#d3dfd9'})));
  }
  entrance(-W*.27,L*.12,W*.17);
 }
 const dummy=new THREE.Object3D(),unit=new THREE.BoxGeometry(1,1,1);
 for(const [color,entries]of boxes){
  const mesh=new THREE.InstancedMesh(unit,mat(color),entries.length);
  entries.forEach((e,i)=>{dummy.position.set(e.x,e.y,e.z);dummy.rotation.set(0,e.angle,0);dummy.scale.set(e.w,e.h,e.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});group.add(mesh);
 }
 group.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
 return group;
}
