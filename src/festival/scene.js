import * as THREE from 'three';
import { loadCampus } from '../data/loadCampus.js';
import { createCampus } from '../scene/createCampus.js';
import { createCamera } from '../interaction/createCamera.js';

const themes = {
  indie: { sky: 0xc98d79, ground: 0x84736b, main: 0xffb76d, accent: 0xffe5ad },
  idol: { sky: 0x141b49, ground: 0x303955, main: 0xff62c5, accent: 0x60b9ff },
  hiphop: { sky: 0x22132e, ground: 0x3b2944, main: 0xff3e59, accent: 0xb455ff },
};

export async function createFestivalScene(container, venueId) {
  const buildings = await loadCampus();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  const campus = createCampus(buildings);
  scene.add(campus.group);
  const ambient = new THREE.HemisphereLight(0xffe7d3, 0x252343, 2);
  scene.add(ambient);
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x84736b });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1; scene.add(ground);
  const venue = campus.meshes.find(m => m.userData.building.id === venueId);
  if (!venue) throw new Error('캠퍼스에서 축제 장소를 찾을 수 없습니다.');
  const bounds = new THREE.Box3().setFromObject(venue);
  const center = bounds.getCenter(new THREE.Vector3());
  // 선택 건물 앞의 게임용 임시 행사 배치입니다. 실제 시설 배치와 다릅니다.
  const origin = new THREE.Vector3(center.x, 0, bounds.max.z + 40);
  const group = new THREE.Group(); group.position.copy(origin); scene.add(group);
  const mats = [];
  function material(color, emissive = false) {
    const mat = new THREE.MeshLambertMaterial({ color, ...(emissive ? { emissive: color, emissiveIntensity: 1 } : {}) });
    mats.push(mat); return mat;
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
  // Performers are abstract game characters, not portraits of real artists.
  [-8, 0, 8].forEach(x => {
    box(x, 11, 2, 2, 6, 2, white);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6), white); head.position.set(x, 16, 2); group.add(head);
  });
  const crowd = [];
  const bodyGeo = new THREE.BoxGeometry(1.5, 3, 1.5), headGeo = new THREE.SphereGeometry(.95, 6, 5), stickGeo = new THREE.BoxGeometry(.35, 3, .35);
  for (let i = 0; i < 168; i++) {
    const person = new THREE.Group();
    person.position.set((i % 14 - 6.5) * 4.7, 0, 23 + Math.floor(i / 14) * 4.4);
    const body = new THREE.Mesh(bodyGeo, i % 3 ? dark : white); body.position.y = 2; person.add(body);
    const head = new THREE.Mesh(headGeo, white); head.position.y = 4.5; person.add(head);
    const stick = new THREE.Mesh(stickGeo, i % 2 ? glow : accent); stick.position.set(1.2, 5, 0); person.add(stick);
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
  const { camera, controls, resize } = createCamera(renderer, campus.bounds);
  camera.position.set(origin.x + 100, 100, origin.z + 165);
  controls.target.set(origin.x, 13, origin.z + 25); controls.minDistance = 60; controls.maxDistance = 1800; controls.update();
  let genre = 'indie', elapsed = 0, playing = true, frame, previous = performance.now(), finale = false, disposed = false;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function theme(value) {
    genre = value;
    const t = themes[genre]; scene.background = new THREE.Color(t.sky); scene.fog = new THREE.Fog(t.sky, 450, 1800);
    groundMaterial.color.setHex(t.ground); glow.color.setHex(t.main); glow.emissive.setHex(t.main);
    accent.color.setHex(t.accent); accent.emissive.setHex(t.accent); point.color.setHex(t.main);
    beams.forEach((b, i) => b.material.color.setHex(i % 2 ? t.accent : t.main));
  }
  theme(genre);
  const observer = new ResizeObserver(() => {
    if (disposed) return;
    const w = container.clientWidth, h = container.clientHeight;
    if (w && h) { renderer.setSize(w, h); resize(w, h); }
  }); observer.observe(container);
  function animate(now) {
    if (disposed) return;
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (playing) elapsed += dt;
    const t = reducedMotion ? 0 : elapsed;
    crowd.forEach((person, i) => {
      const phase = t * (genre === 'indie' ? 1.4 : genre === 'idol' ? 5 : 7) + i * .7;
      person.rotation.z = Math.sin(phase) * (genre === 'indie' ? .07 : .14);
      person.position.y = genre === 'indie' ? 0 : Math.max(0, Math.sin(phase)) * (genre === 'hiphop' ? 2.8 : 1.5);
    });
    beams.forEach((beam, i) => { beam.rotation.z = Math.sin(t * (genre === 'indie' ? .3 : genre === 'idol' ? 1.7 : 2.3) + i) * .55; beam.rotation.x = Math.cos(t * .7 + i) * .4; });
    // Continuous, non-strobing light motion.
    point.intensity = genre === 'indie' ? 8 : 10 + Math.sin(t * 2) * 2;
    confetti.visible = finale;
    if (finale && playing && !reducedMotion) {
      for (let i = 0; i < 240; i++) { positions[i * 3 + 1] -= dt * 10; if (positions[i * 3 + 1] < 2) positions[i * 3 + 1] = 80; }
      particles.attributes.position.needsUpdate = true;
    }
    controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate);
  }
  resize(container.clientWidth, container.clientHeight); frame = requestAnimationFrame(animate);
  return {
    theme,
    configure(extras) { booths.visible = extras.includes('booths'); crowd.forEach(p => { p.children[2].visible = extras.includes('lights') || genre === 'indie'; }); },
    setFinale(value) { finale = value; },
    setPreparation(progress) { group.scale.setScalar(reducedMotion ? 1 : Math.max(.01, Math.min(1, progress))); },
    setPlaying(value) { playing = value; },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
      const geometries = new Set(), materials = new Set();
      scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m)); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
