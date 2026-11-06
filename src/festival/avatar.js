import * as THREE from 'three';

// 축제 전용 창작 캐릭터. 얼굴·의상은 선택 팔레트로 바꾸고 관절은 개별 애니메이션합니다.
export function createFestivalAvatar({ jacket = '#536b88', skin = '#f0d0ae', hair = '#352c29', stage = false } = {}) {
  const person = new THREE.Group();
  const mat = color => new THREE.MeshStandardMaterial({ color, roughness: .8 });
  const outfit = mat(jacket), skinMat = mat(skin), hairMat = mat(hair), pants = mat('#303847'), shoes = mat('#faf5ea'), ink = mat('#242a36'), shirt = mat('#f5eedf');
  function ellipsoid(parent, x, y, z, sx, sy, sz, material) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }
  function capsule(parent, x, y, z, radius, length, material) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 8), material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  ellipsoid(person, 0, 2.8, 0, .93, 1.16, .53, outfit);
  ellipsoid(person, 0, 2.9, .48, .38, .86, .07, shirt);
  // 열린 재킷의 칼라, 소매 끝, 작은 학교 배지와 지퍼.
  [-1, 1].forEach(side => {
    const lapel = capsule(person, side * .38, 3.45, .47, .1, .5, outfit); lapel.rotation.z = side * -.35;
    capsule(person, side * .43, 1.05, 0, .3, 1.2, pants);
    ellipsoid(person, side * .43, .22, .22, .36, .22, .57, shoes);
    ellipsoid(person, side * .43, .09, .23, .37, .07, .58, ink);
  });
  ellipsoid(person, -.57, 3.2, .48, .12, .14, .05, shoes);
  capsule(person, 0, 4.02, 0, .28, .25, skinMat);
  ellipsoid(person, 0, 4.87, 0, .85, .98, .73, skinMat);
  [-1, 1].forEach(side => {
    ellipsoid(person, side * .83, 4.8, 0, .17, .26, .18, skinMat);
    ellipsoid(person, side * .3, 4.98, .66, .105, .14, .06, ink);
    ellipsoid(person, side * .28, 5.03, .711, .032, .043, .015, shoes);
    ellipsoid(person, side * .43, 4.66, .65, .16, .065, .025, mat('#d89485'));
    const brow = capsule(person, side * .31, 5.23, .64, .035, .17, hairMat); brow.rotation.z = Math.PI / 2;
  });
  ellipsoid(person, 0, 4.77, .73, .09, .11, .1, skinMat);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.16, .025, 4, 10, Math.PI), ink); smile.rotation.z = Math.PI; smile.position.set(0, 4.55, .695); person.add(smile);
  ellipsoid(person, 0, 5.48, -.1, .88, .52, .75, hairMat);
  // 비스듬한 앞머리와 머리카락 묶음을 겹쳐 자연스러운 실루엣을 만듭니다.
  for (let i = 0; i < 5; i++) {
    const lock = ellipsoid(person, (i - 2) * .29, 5.45 - i * .06, .47, .28, .35 + i * .035, .25, hairMat); lock.rotation.z = -.35;
  }
  const longHair = new THREE.Group(); person.add(longHair);
  ellipsoid(longHair, 0, 4.45, -.57, .88, 1.1, .3, hairMat);
  [-1, 1].forEach(side => ellipsoid(longHair, side * .73, 4.6, -.12, .23, .98, .45, hairMat));
  longHair.visible = false;
  const ponytail = ellipsoid(person, .15, 4.85, -.94, .4, .95, .4, hairMat); ponytail.visible = false;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.72, 1.03, .85, 12), outfit); skirt.position.y = 1.95; skirt.visible = false; person.add(skirt);
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group(); pivot.position.set(side * 1.02, 3.5, 0); person.add(pivot);
    capsule(pivot, 0, -.55, 0, .27, .72, outfit);
    capsule(pivot, 0, -1.12, 0, .22, .36, skinMat);
    ellipsoid(pivot, 0, -1.51, .03, .25, .3, .24, skinMat);
    pivot.rotation.z = side * .12; return pivot;
  });
  if (stage) {
    const mic = capsule(arms[1], 0, -1.5, .31, .1, .55, ink); mic.rotation.x = Math.PI / 2;
    ellipsoid(arms[1], 0, -1.5, .65, .15, .15, .17, ink);
  }
  return { person, outfit, skin: skinMat, hair: hairMat, arms, longHair, ponytail, skirt };
}
