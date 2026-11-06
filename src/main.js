import * as THREE from 'three';
import { initCharacterMap } from './character/card.js?v=3';
import { loadCampus } from './data/loadCampus.js';
import { createCampus } from './scene/createCampus.js?v=building-selection-2';
import { createCamera } from './interaction/createCamera.js';
import { createLabels } from './interaction/createLabels.js?v=building-selection-2';
import { showBuildingInformation } from './interaction/gamePreview.js?v=building-selection-2';

async function start() {
  if (!await initCharacterMap()) return;
  const container = document.querySelector('#map');
  const status = document.querySelector('#status');
  try {
    const buildings = await loadCampus();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7ede8);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x738b76, 2.3));
    const sunlight = new THREE.DirectionalLight(0xffffff, 2);
    sunlight.position.set(-300, 700, 400);
    scene.add(sunlight);
    const campus = createCampus(buildings);
    scene.add(campus.group);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0xe2e9df }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    scene.add(ground);
    const { camera, controls, resize, fit } = createCamera(renderer, campus.bounds);
    const selectedMaterial = new THREE.MeshLambertMaterial({ color: 0x7da98b });
    let selectedMesh = null;
    let previousMaterial = null;
    function selectBuilding(building) {
      if (selectedMesh) selectedMesh.material = previousMaterial;
      selectedMesh = campus.meshes.find(mesh => mesh.userData.building.id === building.id);
      if (selectedMesh) {
        previousMaterial = selectedMesh.material;
        selectedMesh.material = selectedMaterial;
      }
      showBuildingInformation(building);
      render();
    }
    const updateLabels = createLabels(container, campus.anchors, selectBuilding);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let press = null;
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) {
        press = null;
        return;
      }
      press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointermove', event => {
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) press = null;
    });
    canvas.addEventListener('pointercancel', () => { press = null; });
    canvas.addEventListener('pointerup', event => {
      const started = press;
      press = null;
      if (!started || started.id !== event.pointerId) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        (event.clientX - rect.left) / rect.width * 2 - 1,
        -(event.clientY - rect.top) / rect.height * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(campus.meshes, false)[0];
      if (hit) selectBuilding(hit.object.userData.building);
    });
    function render() {
      renderer.render(scene, camera);
      updateLabels(camera, container.clientWidth, container.clientHeight);
    }
    function onResize() {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      resize(width, height);
      render();
    }
    fit(container.clientWidth, container.clientHeight);
    controls.addEventListener('change', render);
    window.addEventListener('resize', onResize);
    status.hidden = true;
    onResize();
  } catch (error) {
    status.textContent = '맵을 열 수 없습니다. 로컬 서버 실행과 WebGL 지원 여부를 확인해 주세요.';
    console.error(error);
  }
}
start();
