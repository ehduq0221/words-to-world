import * as THREE from 'three';
import { createFestivalAvatar } from './avatar.js';
import { getPerformanceEnvironment } from './environment.js';
import { createFireworks } from './fireworks.js';
import { getArtistProfile, FIREWORK_SITES } from './profiles.js';
import { loadCampus } from '../data/loadCampus.js';
import { createCampus } from '../scene/createCampus.js';
import { createCamera } from '../interaction/createCamera.js';

const themes = {
  indie: { sky: 0xc98d79, ground: 0x84736b, main: 0xffb76d, accent: 0xffe5ad },
  idol: { sky: 0x141b49, ground: 0x303955, main: 0xff62c5, accent: 0x60b9ff },
  hiphop: { sky: 0x22132e, ground: 0x3b2944, main: 0xff3e59, accent: 0xb455ff },
};

export async function createFestivalScene(container, location) {
  const buildings = await loadCampus();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const campus = createCampus(buildings);
  scene.add(campus.group);
  const outlineMaterial = campus.group.children.find(object => object.isLineSegments)?.material;
  if (outlineMaterial) { outlineMaterial.transparent = true; outlineMaterial.opacity = .7; }
  const ambient = new THREE.HemisphereLight(0xffe7d3, 0x252343, 2);
  scene.add(ambient);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x84736b });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1; scene.add(ground);
  const venue = campus.meshes.find(m => m.userData.building.id === (location.anchorBuildingId || location.id));
  if (!venue) throw new Error('캠퍼스에서 축제 장소를 찾을 수 없습니다.');
  const bounds = new THREE.Box3().setFromObject(venue);
  const center = bounds.getCenter(new THREE.Vector3());
  // 사용자 이미지의 오른쪽·아래쪽을 캠퍼스 월드 좌표로 변환합니다.
  const axisLength = Math.hypot(.782, .623);
  const right = new THREE.Vector3(-.782 / axisLength, 0, -.623 / axisLength);
  const down = new THREE.Vector3(.623 / axisLength, 0, -.782 / axisLength);
  const compact = Boolean(location.anchorBuildingId);
  const baseScale = location.scale || 1;
  const origin = compact ? new THREE.Vector3(center.x, 0, center.z).addScaledVector(right, location.rightOffset).addScaledVector(down, location.downOffset) : new THREE.Vector3(center.x, 0, bounds.max.z + 40);
  const group = new THREE.Group(); group.position.copy(origin);
  if (compact) group.rotation.y = Math.atan2(down.x, down.z);
  group.scale.setScalar(baseScale); scene.add(group);
  const marker = new THREE.Mesh(new THREE.RingGeometry(24, 27, 40), new THREE.MeshBasicMaterial({ color: 0x80f599, side: THREE.DoubleSide, transparent: true, opacity: .85 }));
  marker.rotation.x = -Math.PI / 2; marker.position.copy(origin); marker.position.y = .2; marker.visible = false; scene.add(marker);
  // 좁은 야외 위치를 건물 지붕이 가리지 않도록 근처 건물은 무대 보기에서 반투명 처리합니다.
  const firstMaterial = campus.meshes[0].material;
  const ghost = (Array.isArray(firstMaterial) ? firstMaterial[1] || firstMaterial[0] : firstMaterial).clone(); ghost.transparent = true; ghost.opacity = .13; ghost.depthWrite = false;
  const originalMaterials = new Map(campus.meshes.map(mesh => [mesh, mesh.material]));
  const nearby = campus.meshes.filter(mesh => {
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    return mesh.userData.building.kind !== 'sports-field' && Math.hypot(c.x - origin.x, c.z - origin.z) < 170;
  }).map(mesh => ({ mesh, original: mesh.material }));

  function material(color, emissive = false) {
    const mat = new THREE.MeshLambertMaterial({ color, ...(emissive ? { emissive: color, emissiveIntensity: 1 } : {}) });
    return mat;
  }
  function box(x, y, z, width, height, depth, mat, parent = group) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  const dark = material(0x222b39), white = material(0xf5e9df), glow = material(0xffb76d, true), accent = material(0xffe5ad, true);
  box(0, 3, 0, 52, 6, 22, dark);
  box(0, 19, -9, 42, 23, 2, glow);
  [-27, 27].forEach(x => { box(x, 18, 0, 2, 36, 2, dark); box(x, 8, 0, 7, 14, 7, dark); });
  box(0, 36, 0, 56, 2, 3, dark);
  // 사진 참고: 대운동장의 트러스 타워·학교 이름·세로 LED 배너.
  const inuViolet = material(0x914fe8, true);
  const trussMetal = material(0xb1bacb), inuBlue = material(0x17284a), tentGold = material(0xe4c16a);
  function strut(a, b, radius = .22) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 5), trussMetal);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); group.add(mesh);
  }
  for (const x of [-34, 34]) {
    for (const side of [-1, 1]) strut([x + side * 2, 0, -4], [x + side * 2, 52, -4]);
    for (let y = 0; y < 48; y += 8) { strut([x - 2, y, -4], [x + 2, y + 8, -4]); strut([x + 2, y, -4], [x - 2, y + 8, -4]); }
  }
  strut([-36, 52, -4], [36, 52, -4], .35); strut([-36, 55, -4], [36, 55, -4], .35);
  for (let x = -36; x < 36; x += 8) strut([x, 52, -4], [x + 8, 55, -4]);
  const brandCanvas = document.createElement('canvas'); brandCanvas.width = 1024; brandCanvas.height = 128;
  const brandContext = brandCanvas.getContext('2d'); brandContext.fillStyle = '#152340'; brandContext.fillRect(0, 0, 1024, 128);
  brandContext.fillStyle = '#f3e9c7'; brandContext.font = 'bold 49px sans-serif'; brandContext.textAlign = 'center'; brandContext.fillText('인천대학교 · CAMPUS FESTIVAL', 512, 78);
  const brandTexture = new THREE.CanvasTexture(brandCanvas); brandTexture.colorSpace = THREE.SRGBColorSpace;
  const brandMaterial = new THREE.MeshBasicMaterial({ map: brandTexture });
  const brandSign = new THREE.Mesh(new THREE.PlaneGeometry(72, 9), brandMaterial); brandSign.position.set(0, 59, -3); group.add(brandSign);
  [-42, 42].forEach(x => {
    box(x, 23, -3, 7, 46, 3, inuBlue);
    const strip = box(x, 24, -1.3, 4, 41, .4, inuViolet); strip.userData.inuBanner = true;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(23, 3.2), brandMaterial); sign.rotation.z = Math.PI / 2; sign.position.set(x, 25, -.9); group.add(sign);
  });
  // 실제 외모·안무를 모사하지 않는 게임용 무대 캐릭터입니다.
  const performers = [];
  const wardrobe = [0xeee1ff, 0x9ddfce, 0xffb6d2, 0xb0cafa, 0xffdba0, 0xdfb7f4];
  for (let i = 0; i < 6; i++) {
    const actor = createFestivalAvatar({ jacket: wardrobe[i], hair: i % 2 ? '#543b35' : '#252332', stage: true });
    actor.person.scale.setScalar(1.55); actor.person.position.y = 6; group.add(actor.person);
    performers.push(actor);
  }
  const decor = new THREE.Group(); group.add(decor);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 512;
  const screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(41, 22), screenMaterial); screen.position.set(0, 19, -7.9); group.add(screen);
  const crowd = [];
  const bodyGeo = new THREE.CapsuleGeometry(.7, 1.6, 3, 8), headGeo = new THREE.SphereGeometry(.95, 12, 8), stickGeo = new THREE.BoxGeometry(.35, 3, .35);
  const crowdClothes = [0x7a9bc1, 0xb9789c, 0x698d70, 0xc9a16c, 0x8b7cbb, 0xb1c4c1].map(c => material(c));
  const skinTones = [0xf0c5a3, 0xd5a17d, 0xb67d58].map(c => material(c));
  const hairMat = material(0x2d2832);
  const crowdHairGeo = new THREE.SphereGeometry(.99, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55);
  for (let i = 0; i < 168; i++) {
    const person = new THREE.Group();
    person.position.set((i % 14 - 6.5) * 4.7, 0, 23 + Math.floor(i / 14) * 4.4);
    const body = new THREE.Mesh(bodyGeo, crowdClothes[i % crowdClothes.length]); body.position.y = 2; person.add(body);
    const head = new THREE.Mesh(headGeo, skinTones[i % 3]); head.position.y = 4.5; person.add(head);
    const stick = new THREE.Mesh(stickGeo, i % 2 ? glow : accent); stick.position.set(1.2, 5, 0); person.add(stick);
    const cap = new THREE.Mesh(crowdHairGeo, hairMat); cap.position.set(0, 4.6, 0); person.add(cap);
    crowd.push(person); group.add(person);
  }
  const visitorRig = createFestivalAvatar();
  const visitor = visitorRig.person; visitor.name = 'selected-festival-student'; visitor.rotation.y = Math.PI; group.add(visitor);
  const visitorJacket = visitorRig.outfit, visitorSkin = visitorRig.skin, visitorHair = visitorRig.hair;
  const visitorLongHair = visitorRig.longHair, visitorArm = visitorRig.arms[0];
  const visitorGlow = material(0xc6ff70, true);
  const myStick = new THREE.Group(); myStick.position.set(0, -1.6, .1); visitorArm.add(myStick);
  box(0, -.1, 0, .18, .6, .18, white, myStick);
  const stickBulb = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), visitorGlow); stickBulb.position.y = -.6; myStick.add(stickBulb);
  let jumpStarted = -100;
  const visitorHalo = new THREE.Mesh(new THREE.RingGeometry(1.8, 2.1, 32), new THREE.MeshBasicMaterial({ color: 0xf3f4a7, side: THREE.DoubleSide })); visitorHalo.rotation.x = -Math.PI / 2; visitorHalo.position.y = .4; visitor.add(visitorHalo);
  const visitorTagCanvas = document.createElement('canvas'); visitorTagCanvas.width = 256; visitorTagCanvas.height = 64;
  const visitorTagTexture = new THREE.CanvasTexture(visitorTagCanvas);
  const visitorTag = new THREE.Sprite(new THREE.SpriteMaterial({ map: visitorTagTexture, transparent: true, depthTest: false })); visitorTag.position.y = 7.3; visitorTag.scale.set(4.5, 1.2, 1); visitor.add(visitorTag);
  let visitorWaveUntil = 0, visitorName = '체험용 학생';
  // 무대(앞끝 z=11)와 첫 관객 열(z=23) 사이의 펜스·안내 통로.
  const fence = new THREE.Group(); fence.name = 'festival-barrier'; group.add(fence);
  const steel = material(0xb8c6cb), safetyLime = material(0xd5ff36), uniform = material(0x25344a), reflective = material(0xf5ffe0, true);
  for (let x = -36; x <= 36; x += 6) {
    box(x, 2.5, 18, .45, 5, .45, steel, fence); box(x, .2, 18, 3, .4, 2.5, steel, fence);
  }
  for (const y of [1.6, 4.7]) box(0, y, 18, 72, .4, .45, steel, fence);
  for (let x = -34; x < 36; x += 2) box(x, 3.1, 18, .2, 2.8, .25, steel, fence);
  const staff = new THREE.Group(); staff.name = 'festival-stewards'; group.add(staff);
  const staffArms = [];
  const badgeCanvas = document.createElement('canvas'); badgeCanvas.width = 128; badgeCanvas.height = 48;
  const badgeContext = badgeCanvas.getContext('2d'); badgeContext.fillStyle = '#d5ff36'; badgeContext.fillRect(0, 0, 128, 48);
  badgeContext.fillStyle = '#172a32'; badgeContext.textAlign = 'center'; badgeContext.font = 'bold 30px sans-serif'; badgeContext.fillText('STAFF', 64, 35);
  const badgeTexture = new THREE.CanvasTexture(badgeCanvas); badgeTexture.colorSpace = THREE.SRGBColorSpace;
  const badgeMaterial = new THREE.MeshBasicMaterial({ map: badgeTexture });
  [-40, -18, 18, 40].forEach((x, i) => {
    const steward = new THREE.Group(); steward.position.set(x, 0, 14); steward.scale.setScalar(1.12); staff.add(steward);
    box(-.45, 1, 0, .65, 2, .8, uniform, steward); box(.45, 1, 0, .65, 2, .8, uniform, steward);
    box(0, 2.9, 0, 1.9, 2, 1.2, safetyLime, steward);
    box(0, 2.5, .62, 1.95, .22, .08, reflective, steward); box(0, 3.5, .62, 1.95, .22, .08, reflective, steward);
    box(-.55, 3, .65, .18, 1.9, .08, reflective, steward); box(.55, 3, .65, .18, 1.9, .08, reflective, steward);
    box(0, 4.65, 0, 1.4, 1.4, 1.2, skinTones[i % 3], steward); box(0, 5.4, .2, 1.7, .35, 1.7, uniform, steward);
    [-1, 1].forEach(side => { const arm = new THREE.Group(); arm.position.set(side * 1.2, 3.6, 0); box(0, -.8, 0, .5, 1.7, .6, uniform, arm); steward.add(arm); staffArms.push(arm); });
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .45), badgeMaterial); badge.position.set(0, 3.1, .7); steward.add(badge);
  });
  const backCount = 396;
  const backBodies = new THREE.InstancedMesh(bodyGeo, white, backCount), backHeads = new THREE.InstancedMesh(headGeo, white, backCount), backSticks = new THREE.InstancedMesh(stickGeo, glow, backCount);
  const backHair = new THREE.InstancedMesh(crowdHairGeo, hairMat, backCount);
  group.add(backBodies, backHeads, backSticks, backHair);
  const backDummy = new THREE.Object3D();
  for (let i = 0; i < backCount; i++) { backBodies.setColorAt(i, crowdClothes[i % crowdClothes.length].color); backHeads.setColorAt(i, skinTones[i % 3].color); }
  const booths = new THREE.Group(); group.add(booths);
  [-48, 48].forEach(x => {
    [30, 50, 70].forEach(z => { box(x, 4, z, 12, 8, 10, white, booths); const roof = new THREE.Mesh(new THREE.ConeGeometry(10, 7, 4), tentGold); roof.rotation.y = Math.PI / 4; roof.position.set(x, 11, z); booths.add(roof); });
  });
  const beams = [];
  for (let i = 0; i < 6; i++) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(8, 85, 8, 1, true), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe5ad : 0xffb76d, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(-24 + i * 9.6, 45, 4); group.add(beam); beams.push(beam);
  }
  const point = new THREE.PointLight(0xffb76d, 12, 220, 1); point.position.set(0, 28, 25); group.add(point);
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) { positions[i * 3] = Math.sin(i * 17.3) * 65; positions[i * 3 + 1] = (i % 60) + 20; positions[i * 3 + 2] = 15 + (i % 70); }
  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const confetti = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xffd7ed, size: 1.2 })); group.add(confetti);
  const { camera, controls, resize, fit } = createCamera(renderer, campus.bounds);
  function focusFestival() {
    const factor = 1 / Math.min(container.clientWidth / container.clientHeight, 1);
    camera.position.copy(origin).addScaledVector(right, 190 * factor).addScaledVector(down, 260 * factor);
    camera.position.y = 300 * factor;
    controls.target.copy(origin).addScaledVector(down, 15); controls.target.y = 55;
    controls.update();
    campus.meshes.forEach(mesh => { mesh.material = originalMaterials.get(mesh); });
    scene.updateMatrixWorld(true);
    const stageTarget = origin.clone().addScaledVector(down, 20 * baseScale); stageTarget.y = 8 * baseScale;
    const direction = stageTarget.clone().sub(camera.position);
    const occluders = new THREE.Raycaster(camera.position, direction.clone().normalize(), 0, direction.length());
    occluders.intersectObjects(campus.meshes, false).forEach(hit => { hit.object.material = ghost; });
  }
  controls.minDistance = 1; controls.maxDistance = 3000; focusFestival();
  let overview = false, view = 'outside', restoreView = null, skyUntil = 0, cheerUntil = 0;
  let visitorX = 0, visitorZ = 100;
  let profile = getArtistProfile({ id: 'default', name: 'OUR CAMPUS', genre: 'indie', colors: ['#ffb76d', '#ffe5ad'] });
  let environment = getPerformanceEnvironment('17:00');
  const targetSky = new THREE.Color(environment.sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(27, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd7a0 }));
  sun.position.copy(origin).addScaledVector(right, -350).addScaledVector(down, -500); sun.position.y = 160; scene.add(sun);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe6efff }));
  moon.position.copy(origin).addScaledVector(right, 360).addScaledVector(down, -600); moon.position.y = 330; moon.visible = false; scene.add(moon);
  const starGeometry = new THREE.BufferGeometry(), starPositions = new Float32Array(250 * 3);
  for (let i = 0; i < 250; i++) { const angle = i * 2.399963; starPositions[i * 3] = origin.x + Math.cos(angle) * (600 + i % 200); starPositions[i * 3 + 1] = 280 + i % 350; starPositions[i * 3 + 2] = origin.z + Math.sin(angle) * (600 + i % 200); }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xe5eeff, size: 2.5, transparent: true, opacity: .8 })); stars.visible = false; scene.add(stars);
  let genre = 'indie', elapsed = 0, playing = true, frame, previous = performance.now(), finale = false, disposed = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skyEffects = new THREE.Group(); skyEffects.position.copy(origin); skyEffects.rotation.y = group.rotation.y;
  scene.add(skyEffects);
  const fireworks = createFireworks(skyEffects, reducedMotion);
  let fireworkPosition = 'stage-back';
  // 사진의 송도 야경에서 영감을 받은 가상 실루엣입니다. 실제 건물 좌표가 아닙니다.
  const city = new THREE.Group(); city.position.copy(origin); city.rotation.y = group.rotation.y; scene.add(city);
  const cityMaterial = material(0x172137), windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffde97 });
  const cityLights = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 3), windowMaterial, 22 * 40);
  const cityDummy = new THREE.Object3D(); let windowIndex = 0;
  for (let i = 0; i < 22; i++) {
    const x = (i - 10.5) * 53, height = 80 + i % 5 * 21, z = -800 - i % 3 * 35;
    box(x, height / 2, z, 32, height, 27, cityMaterial, city);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 5; col++) {
      cityDummy.position.set(x - 12 + col * 6, 8 + row * (height - 15) / 8, z + 13.6); cityDummy.updateMatrix(); cityLights.setMatrixAt(windowIndex++, cityDummy.matrix);
    }
  }
  city.add(cityLights);
  function theme(value) {
    genre = value;
    const t = themes[genre];
    targetSky.set(environment.sky);
    if (!scene.background) scene.background = targetSky.clone();
    scene.fog = overview ? null : new THREE.Fog(environment.sky, 600, 2200);
    ambient.intensity = environment.ambient; ambient.color.set(environment.phase === 'sunset' ? 0xffdfc4 : 0xc8d8ff);
    cityLights.visible = environment.phase !== 'sunset';
    sun.visible = environment.phase === 'sunset'; moon.visible = environment.phase === 'night'; stars.visible = environment.phase === 'night';
    groundMaterial.color.setHex(environment.ground);
    glow.color.set(profile.colors[0]); glow.emissive.set(profile.colors[0]);
    accent.color.set(profile.colors[1]); accent.emissive.set(profile.colors[1]); point.color.set(profile.colors[0]);
    beams.forEach((beam, i) => { beam.material.color.set(profile.colors[i % 2]); });
  }
  function setArtist(artist) {
    profile = getArtistProfile(artist); theme(artist.genre);
    performers.forEach(({ outfit, longHair, ponytail, skirt }, i) => {
      outfit.color.set(profile.colors[i % 2]);
      const female = profile.cast.gender === 'female';
      longHair.visible = female ? i % 3 !== 2 : i % 4 === 3;
      longHair.scale.y = female && i % 3 === 0 ? .65 : 1;
      ponytail.visible = female && i % 3 === 2; skirt.visible = female && i % 2 === 1;
    });
    const ctx = screenCanvas.getContext('2d');
    ctx.fillStyle = '#101525'; ctx.fillRect(0, 0, 1024, 512);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 512);
    gradient.addColorStop(0, profile.colors[0]); gradient.addColorStop(1, profile.colors[1]);
    ctx.fillStyle = gradient; ctx.fillRect(14, 14, 996, 484);
    ctx.fillStyle = '#172039'; ctx.textAlign = 'center';
    ctx.font = 'bold 25px sans-serif'; ctx.fillText(profile.title, 512, 115);
    let fontSize = 78; do { ctx.font = `bold ${fontSize}px sans-serif`; fontSize -= 2; } while (ctx.measureText(artist.name).width > 925 && fontSize > 22);
    ctx.fillText(artist.name, 512, 265); ctx.font = '24px sans-serif'; ctx.fillText('INCHEON NATIONAL UNIVERSITY · LIVE', 512, 380);
    screenTexture.needsUpdate = true;
    decor.children.slice().forEach(child => { child.geometry?.dispose(); decor.remove(child); });
    if (profile.design === 'crown' || profile.design === 'prism') {
      for (let i = 0; i < 5; i++) {
        const height = profile.design === 'crown' ? 8 + (2 - Math.abs(i - 2)) * 4 : 10 + i % 2 * 6;
        const panel = box((i - 2) * 10, 38 + height / 2, -8, 7, height, 1, i % 2 ? accent : glow, decor);
        if (profile.design === 'prism') panel.rotation.z = .35;
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(5 + i, .5, 6, 30), i % 2 ? glow : accent);
        ring.position.set((i - 2) * 12, 39 + Math.sin(i) * 3, -8); decor.add(ring);
      }
    }
  }
  function localPoint(x, y, z) {
    const p = origin.clone();
    if (compact) p.addScaledVector(right, x * baseScale).addScaledVector(down, z * baseScale);
    else { p.x += x * baseScale; p.z += z * baseScale; }
    p.y = y * baseScale; return p;
  }
  function applyView(mode) {
    view = mode; overview = mode === 'map'; marker.visible = overview;
    controls.maxPolarAngle = mode === 'inside' ? Math.PI * .6 : Math.PI / 2 - .06;
    camera.fov = mode === 'inside' ? 55 : 40; camera.updateProjectionMatrix();
    campus.meshes.forEach(mesh => { mesh.material = originalMaterials.get(mesh); });
    if (outlineMaterial) outlineMaterial.opacity = mode === 'inside' ? .15 : .7;
    scene.fog = overview ? null : new THREE.Fog(environment.sky, 600, 2200);
    if (mode === 'inside') {
      nearby.forEach(({ mesh }) => { mesh.material = ghost; });
      camera.position.copy(localPoint(visitorX + 5, 12, visitorZ + 22)); controls.target.copy(localPoint(visitorX * .15, 7, visitorZ - 42));
    } else if (mode === 'fireworks') {
      const factor = 1 / Math.min(container.clientWidth / container.clientHeight, 1);
      camera.position.copy(skyEffects.position).addScaledVector(right, 170 * factor).addScaledVector(down, 380 * factor); camera.position.y = 145 * factor;
      controls.target.copy(skyEffects.position); controls.target.y = 100;
    } else if (mode === 'map') {
      controls.target.copy(campus.bounds.getCenter(new THREE.Vector3())); controls.target.y = 0; fit(container.clientWidth, container.clientHeight);
    } else focusFestival();
    controls.update();
  }
  function positionFireworks(id) {
    fireworkPosition = FIREWORK_SITES.some(s => s.id === id) ? id : 'stage-back';
    const site = FIREWORK_SITES.find(s => s.id === fireworkPosition);
    skyEffects.position.copy(fireworkPosition === 'campus-center' ? campus.bounds.getCenter(new THREE.Vector3()) : origin);
    skyEffects.position.y = 0;
    if (fireworkPosition !== 'campus-center') skyEffects.position.addScaledVector(right, site.x).addScaledVector(down, site.z);
  }
  theme(genre);
  const observer = new ResizeObserver(() => {
    if (disposed) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w && h) { renderer.setSize(w, h); resize(w, h); }
  }); observer.observe(container);
  function animate(now) {
    if (disposed) return;
    const dt = Math.min((now - previous) / 1000, .25); previous = now;
    if (playing) elapsed += dt;
    const t = reducedMotion ? 0 : elapsed;
    scene.background.lerp(targetSky, Math.min(1, dt * 2));
    if (restoreView && elapsed > skyUntil) { const next = restoreView; restoreView = null; applyView(next); }
    performers.forEach(({ person, arms }, i) => {
      const count = profile.cast.count || (profile.formation === 'solo' ? 1 : 6);
      person.position.x = (i - (count - 1) / 2) * 5;
      person.position.z = profile.formation === 'arc' ? Math.abs(i - 2.5) * 1.4 : profile.formation === 'zigzag' ? (i % 2) * 4 : 0;
      person.visible = i < count;
      const beat = t * profile.tempo / 60 * Math.PI;
      person.position.y = 6 + (profile.dance === 'bounce' ? Math.max(0, Math.sin(beat + i)) * 1.1 : 0);
      person.rotation.z = Math.sin(beat * (profile.dance === 'wave' ? .35 : .7) + i * .4) * .08;
      arms.forEach((arm, side) => { arm.rotation.z = Math.sin(beat * .5 + i + side) * (profile.dance === 'sharp' ? 1.4 : .8); });
    });
    const jumpPhase = Math.min(1, (elapsed - jumpStarted) / .85);
    visitor.position.set(visitorX, .3 + (reducedMotion ? 0 : Math.sin(jumpPhase * Math.PI) * 3.5), visitorZ);
    visitorRig.arms[1].rotation.z = elapsed - jumpStarted < .85 ? -2.6 : .12;
    visitorArm.rotation.z = elapsed < visitorWaveUntil ? 2.5 + Math.sin(t * 3) * .45 : .2;
    for (let i = 0; i < backCount; i++) {
      const x = (i % 22 - 10.5) * 4, z = 79 + Math.floor(i / 22) * 3;
      const jump = genre === 'indie' ? 0 : Math.max(0, Math.sin(t * 4 + i)) * (elapsed < cheerUntil ? 3 : 1.3);
      const hidden = Math.hypot(x - visitorX, z - visitorZ) < 4 || (view === 'inside' && z > visitorZ && Math.abs(x - visitorX) < 12) || (view === 'inside' && z > visitorZ - 8 && Math.abs(x - visitorX) < 5);
      backDummy.scale.setScalar(hidden ? 0 : 1); backDummy.rotation.set(0, 0, Math.sin(t + i) * .04);
      backDummy.position.set(x, 2 + jump, z); backDummy.updateMatrix(); backBodies.setMatrixAt(i, backDummy.matrix);
      backDummy.position.y = 4.5 + jump; backDummy.updateMatrix(); backHeads.setMatrixAt(i, backDummy.matrix);
      backDummy.position.y = 4.6 + jump; backDummy.updateMatrix(); backHair.setMatrixAt(i, backDummy.matrix);
      backDummy.position.set(x + 1.2, 5 + jump, z); backDummy.updateMatrix(); backSticks.setMatrixAt(i, backDummy.matrix);
    }
    backBodies.instanceMatrix.needsUpdate = true; backHeads.instanceMatrix.needsUpdate = true; backHair.instanceMatrix.needsUpdate = true; backSticks.instanceMatrix.needsUpdate = true;
    staffArms.forEach((arm, i) => { arm.rotation.z = Math.sin(t * .6 + i) * .09; });
    decor.rotation.z = profile.design === 'bloom' ? Math.sin(t * .4) * .02 : 0;
    crowd.forEach((person, i) => {
      person.visible = Math.hypot(person.position.x - visitorX, person.position.z - visitorZ) > 2.5;
      const phase = t * (genre === 'indie' ? 1.4 : genre === 'idol' ? 5 : 7) + i * .7;
      person.rotation.z = Math.sin(phase) * (genre === 'indie' ? .07 : .14);
      person.position.y = genre === 'indie' ? 0 : Math.max(0, Math.sin(phase)) * (elapsed < cheerUntil ? 5 : genre === 'hiphop' ? 2.8 : 1.5);
    });
    beams.forEach((beam, i) => { beam.rotation.z = Math.sin(t * (genre === 'indie' ? .3 : genre === 'idol' ? 1.7 : 2.3) + i) * .55; beam.rotation.x = Math.cos(t * .7 + i) * .4; });
    // Continuous, non-strobing light motion.
    point.intensity = (genre === 'indie' ? 8 : 10 + Math.sin(t * 2) * 2) * environment.light;
    confetti.visible = finale;
    if (finale && playing && !reducedMotion) {
      for (let i = 0; i < 240; i++) { positions[i * 3 + 1] -= dt * 10; if (positions[i * 3 + 1] < 2) positions[i * 3 + 1] = 80; }
      particles.attributes.position.needsUpdate = true;
    }
    fireworks.update(playing ? dt : 0);
    controls.update(); renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  resize(container.clientWidth, container.clientHeight); frame = requestAnimationFrame(animate);
  return {
    theme, setArtist,
    setPerformanceTime(time) { environment = getPerformanceEnvironment(time); theme(genre); },
    setView(mode) { restoreView = null; applyView(mode); },
    setFireworkPosition(id) { positionFireworks(id); if (view === 'fireworks') applyView('fireworks'); },
    moveVisitor(dx, dz) { visitorX = THREE.MathUtils.clamp(visitorX + dx, -25, 25); visitorZ = THREE.MathUtils.clamp(visitorZ + dz, 26, 145); restoreView = null; applyView('inside'); },
    cheer() { cheerUntil = elapsed + 2; if (elapsed - jumpStarted >= .85) jumpStarted = elapsed; visitorWaveUntil = elapsed + 1.5; },
    waveLightstick(color) { cheerUntil = elapsed + 1.5; visitorWaveUntil = elapsed + 1.5; if (color) { visitorGlow.color.set(color); visitorGlow.emissive.set(color); } },
    setVisitor(student) { visitorName = student.name;
      const ctx = visitorTagCanvas.getContext('2d'); ctx.clearRect(0, 0, 256, 64); ctx.fillStyle = '#18342ded'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#e9ffd5'; ctx.font = 'bold 27px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${student.selected ? '나' : '체험'} · ${student.name}`, 128, 43, 242); visitorTagTexture.needsUpdate = true;
      visitorJacket.color.set(student.jacket); visitorSkin.color.set(student.skin); visitorHair.color.set(student.hair); visitorLongHair.visible = student.hairstyle !== 'short'; visitorLongHair.scale.y = student.hairstyle === 'bob' ? .55 : 1; },
    capturePhoto() {
      renderer.render(scene, camera);
      const photo = document.createElement('canvas'); photo.width = renderer.domElement.width; photo.height = renderer.domElement.height;
      const ctx = photo.getContext('2d'); ctx.drawImage(renderer.domElement, 0, 0);
      ctx.fillStyle = '#10172bcc'; ctx.fillRect(0, photo.height - 58, photo.width, 58); ctx.fillStyle = 'white';
      ctx.font = `${Math.min(18, Math.max(10, photo.width / 45))}px sans-serif`;
      ctx.fillText(`${visitorName}의 축제 · ${profile.artistName} · INCHEON NATIONAL UNIVERSITY`, 18, photo.height - 34, photo.width - 36);
      ctx.fillText('© OpenStreetMap contributors · ODbL', 18, photo.height - 13, photo.width - 36);
      return photo.toDataURL('image/png');
    },
    burstFireworks() { fireworks.burst(); if (!restoreView) restoreView = view; skyUntil = elapsed + 7.2; applyView('fireworks'); },
    resetFireworks() { fireworks.reset(); },
    configure(extras) { backSticks.visible = extras.includes('lights'); booths.visible = extras.includes('booths'); crowd.forEach(p => { p.children[2].visible = extras.includes('lights') || genre === 'indie'; }); },
    setFinale(value) { finale = value; },
    setPreparation(progress) { group.scale.setScalar(baseScale * (reducedMotion ? 1 : Math.max(.01, Math.min(1, progress)))); },
    setPlaying(value) { playing = value; },
    dispose() {
      disposed = true; visitorTagTexture.dispose(); brandTexture.dispose(); badgeTexture.dispose(); screenTexture.dispose(); fireworks.dispose(); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); ghost.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
