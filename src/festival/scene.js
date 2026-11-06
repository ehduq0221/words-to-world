import * as THREE from 'three';
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
  const ghost = campus.meshes[0].material.clone(); ghost.transparent = true; ghost.opacity = .13; ghost.depthWrite = false;
  const originalMaterials = new Map(campus.meshes.map(mesh => [mesh, mesh.material]));
  const nearby = campus.meshes.filter(mesh => {
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    return Math.hypot(c.x - origin.x, c.z - origin.z) < 170;
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
  // 실제 외모·안무를 모사하지 않는 게임용 무대 캐릭터입니다.
  const performers = [];
  const wardrobe = [0xeee1ff, 0x9ddfce, 0xffb6d2, 0xb0cafa, 0xffdba0, 0xdfb7f4];
  for (let i = 0; i < 6; i++) {
    const person = new THREE.Group(); group.add(person);
    const outfit = material(wardrobe[i]), skin = material(0xe9bea0), hair = material(i % 2 ? 0x543b35 : 0x252332);
    box(0, 9, 0, 2.4, 4, 1.6, outfit, person);
    box(-.7, 5.8, 0, .8, 3, .9, dark, person); box(.7, 5.8, 0, .8, 3, .9, dark, person);
    box(0, 12.2, 0, 2, 2, 1.8, skin, person); box(0, 13.2, -.2, 2.2, 1, 1.9, hair, person);
    const arms = [-1, 1].map(side => { const pivot = new THREE.Group(); pivot.position.set(side * 1.5, 10, 0); person.add(pivot); box(0, -1.3, 0, .7, 3, .8, outfit, pivot); return pivot; });
    performers.push({ person, arms, outfit });
  }
  const decor = new THREE.Group(); group.add(decor);
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 512;
  const screenTexture = new THREE.CanvasTexture(screenCanvas); screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(41, 22), screenMaterial); screen.position.set(0, 19, -7.9); group.add(screen);
  const crowd = [];
  const bodyGeo = new THREE.BoxGeometry(1.5, 3, 1.5), headGeo = new THREE.SphereGeometry(.95, 6, 5), stickGeo = new THREE.BoxGeometry(.35, 3, .35);
  const crowdClothes = [0x7a9bc1, 0xb9789c, 0x698d70, 0xc9a16c, 0x8b7cbb, 0xb1c4c1].map(c => material(c));
  const skinTones = [0xf0c5a3, 0xd5a17d, 0xb67d58].map(c => material(c));
  const hairMat = material(0x2d2832);
  for (let i = 0; i < 168; i++) {
    const person = new THREE.Group();
    person.position.set((i % 14 - 6.5) * 4.7, 0, 23 + Math.floor(i / 14) * 4.4);
    const body = new THREE.Mesh(bodyGeo, crowdClothes[i % crowdClothes.length]); body.position.y = 2; person.add(body);
    const head = new THREE.Mesh(headGeo, skinTones[i % 3]); head.position.y = 4.5; person.add(head);
    const stick = new THREE.Mesh(stickGeo, i % 2 ? glow : accent); stick.position.set(1.2, 5, 0); person.add(stick);
    box(0, 5.1, -.15, 1.7, .7, 1.5, hairMat, person);
    crowd.push(person); group.add(person);
  }
  const booths = new THREE.Group(); group.add(booths);
  [-48, 48].forEach(x => {
    [30, 50, 70].forEach(z => { box(x, 4, z, 12, 8, 10, white, booths); box(x, 9, z, 14, 2, 12, glow, booths); });
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
  let genre = 'indie', elapsed = 0, playing = true, frame, previous = performance.now(), finale = false, disposed = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const skyEffects = new THREE.Group(); skyEffects.position.copy(origin); skyEffects.rotation.y = group.rotation.y;
  scene.add(skyEffects);
  const fireworks = createFireworks(skyEffects, reducedMotion);
  let fireworkPosition = 'stage-back';
  function theme(value) {
    genre = value;
    const t = themes[genre];
    scene.background = new THREE.Color(profile.sky || t.sky); scene.fog = overview ? null : new THREE.Fog(profile.sky || t.sky, 600, 2200);
    groundMaterial.color.setHex(t.ground);
    glow.color.set(profile.colors[0]); glow.emissive.set(profile.colors[0]);
    accent.color.set(profile.colors[1]); accent.emissive.set(profile.colors[1]); point.color.set(profile.colors[0]);
    beams.forEach((beam, i) => { beam.material.color.set(profile.colors[i % 2]); });
  }
  function setArtist(artist) {
    profile = getArtistProfile(artist); theme(artist.genre);
    performers.forEach(({ outfit }, i) => outfit.color.set(profile.colors[i % 2]));
    const ctx = screenCanvas.getContext('2d');
    ctx.fillStyle = '#101525'; ctx.fillRect(0, 0, 1024, 512);
    const gradient = ctx.createLinearGradient(0, 0, 1024, 512);
    gradient.addColorStop(0, profile.colors[0]); gradient.addColorStop(1, profile.colors[1]);
    ctx.fillStyle = gradient; ctx.fillRect(14, 14, 996, 484);
    ctx.fillStyle = '#172039'; ctx.textAlign = 'center';
    ctx.font = 'bold 25px sans-serif'; ctx.fillText(profile.title, 512, 115);
    let fontSize = 78; do { ctx.font = `bold ${fontSize}px sans-serif`; fontSize -= 2; } while (ctx.measureText(artist.name).width > 925 && fontSize > 22);
    ctx.fillText(artist.name, 512, 265); ctx.font = '24px sans-serif'; ctx.fillText('FANTASY LIVE · SONGDO CAMPUS', 512, 380);
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
    campus.meshes.forEach(mesh => { mesh.material = originalMaterials.get(mesh); });
    if (outlineMaterial) outlineMaterial.opacity = mode === 'inside' ? .15 : .7;
    scene.fog = overview ? null : new THREE.Fog(profile.sky, 600, 2200);
    if (mode === 'inside') {
      nearby.forEach(({ mesh }) => { mesh.material = ghost; });
      camera.position.copy(localPoint(visitorX, 9, visitorZ)); controls.target.copy(localPoint(visitorX * .15, 19, -5));
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
    if (restoreView && elapsed > skyUntil) { const next = restoreView; restoreView = null; applyView(next); }
    performers.forEach(({ person, arms }, i) => {
      person.position.x = (i - 2.5) * 5;
      person.position.z = profile.formation === 'arc' ? Math.abs(i - 2.5) * 1.4 : profile.formation === 'zigzag' ? (i % 2) * 4 : 0;
      person.visible = profile.formation !== 'solo' || i === 2;
      const beat = t * profile.tempo / 60 * Math.PI;
      person.position.y = profile.dance === 'bounce' ? Math.max(0, Math.sin(beat + i)) * 1.1 : 0;
      person.rotation.z = Math.sin(beat * (profile.dance === 'wave' ? .35 : .7) + i * .4) * .08;
      arms.forEach((arm, side) => { arm.rotation.z = Math.sin(beat * .5 + i + side) * (profile.dance === 'sharp' ? 1.4 : .8); });
    });
    decor.rotation.z = profile.design === 'bloom' ? Math.sin(t * .4) * .02 : 0;
    crowd.forEach((person, i) => {
      const phase = t * (genre === 'indie' ? 1.4 : genre === 'idol' ? 5 : 7) + i * .7;
      person.rotation.z = Math.sin(phase) * (genre === 'indie' ? .07 : .14);
      person.position.y = genre === 'indie' ? 0 : Math.max(0, Math.sin(phase)) * (elapsed < cheerUntil ? 5 : genre === 'hiphop' ? 2.8 : 1.5);
    });
    beams.forEach((beam, i) => { beam.rotation.z = Math.sin(t * (genre === 'indie' ? .3 : genre === 'idol' ? 1.7 : 2.3) + i) * .55; beam.rotation.x = Math.cos(t * .7 + i) * .4; });
    // Continuous, non-strobing light motion.
    point.intensity = genre === 'indie' ? 8 : 10 + Math.sin(t * 2) * 2;
    confetti.visible = finale;
    if (finale && playing && !reducedMotion) {
      for (let i = 0; i < 240; i++) { positions[i * 3 + 1] -= dt * 10; if (positions[i * 3 + 1] < 2) positions[i * 3 + 1] = 80; }
      particles.attributes.position.needsUpdate = true;
    }
    fireworks.update(playing ? dt : 0);
    controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
  }
  resize(container.clientWidth, container.clientHeight); frame = requestAnimationFrame(animate);
  return {
    theme, setArtist,
    setView(mode) { restoreView = null; applyView(mode); },
    setFireworkPosition(id) { positionFireworks(id); if (view === 'fireworks') applyView('fireworks'); },
    moveVisitor(dx, dz) { visitorX = THREE.MathUtils.clamp(visitorX + dx, -25, 25); visitorZ = THREE.MathUtils.clamp(visitorZ + dz, 38, 145); restoreView = null; applyView('inside'); },
    cheer() { cheerUntil = elapsed + 2; },
    burstFireworks() { fireworks.burst(); if (!restoreView) restoreView = view; skyUntil = elapsed + 7.2; applyView('fireworks'); },
    resetFireworks() { fireworks.reset(); },
    configure(extras) { booths.visible = extras.includes('booths'); crowd.forEach(p => { p.children[2].visible = extras.includes('lights') || genre === 'indie'; }); },
    setFinale(value) { finale = value; },
    setPreparation(progress) { group.scale.setScalar(baseScale * (reducedMotion ? 1 : Math.max(.01, Math.min(1, progress)))); },
    setPlaying(value) { playing = value; },
    dispose() {
      disposed = true; screenTexture.dispose(); fireworks.dispose(); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); ghost.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
