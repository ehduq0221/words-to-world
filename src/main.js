import * as THREE from 'three';
import { initCharacterMap } from './character/card.js?v=4';
import { loadCampus } from './data/loadCampus.js';
import { createCampus } from './scene/createCampus.js?v=group-selection-3';
import { createCamera } from './interaction/createCamera.js';
import { createLabels } from './interaction/createLabels.js?v=group-selection-3';
import { initFacilityExplorer } from './interaction/gamePreview.js';
import { publishBuildingSelection } from './interaction/buildingSelection.js';
import { createSelectionHighlight } from './interaction/selectionHighlight.js';
import { initDecisions } from './decisions/index.js';
import { initGame, initCalendar, startGame, getState } from './game/index.js';
import { initMetricHistory } from './game/history.js';
import { initFestivalMapEvent } from './festival/mapEvent.js';
import { initGameUI } from './game/ui.js';
import { initOperations } from './operations/index.js';
import { initReactions } from './reactions/index.js';
import { createScenery } from './experience/scenery.js';
import { initExperience } from './experience/index.js';

async function start() {
  if (!await initCharacterMap()) return;
  const container = document.querySelector('#map');
  const status = document.querySelector('#status');
  try {
    await initGame();
    initGameUI();
    initMetricHistory();
    await initCalendar();
    const buildings = await loadCampus();
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7ede8);
    const ambient = new THREE.HemisphereLight(0xffffff, 0x738b76, 2.3);
    scene.add(ambient);
    const sunlight = new THREE.DirectionalLight(0xffffff, 2);
    sunlight.position.set(-300, 700, 400);
    scene.add(sunlight);
    const campus = createCampus(buildings);
    scene.add(campus.group);
    const scenery = createScenery(buildings, scene);
    const { camera, controls, resize, fit } = createCamera(renderer, campus.bounds.clone().union(scenery.bounds));
    const selectionTint = new THREE.Color(0xe9b56b);
    const selectionHighlight = createSelectionHighlight(container, scene);
    let selectedMesh = null;
    let selectedMeshes = [];
    const previousMaterials = new Map();
    function selectBuilding(building, { placeId = null, focusMap = false } = {}) {
      building = buildings.find(item => item.id === building.selectionGroupId) || building;
      for (const mesh of selectedMeshes) {
        const tinted = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        tinted.forEach(material => material.dispose());
        mesh.material = previousMaterials.get(mesh);
      }
      previousMaterials.clear();
      selectedMeshes = campus.meshes.filter(mesh => mesh.userData.building.id === building.id);
      selectedMesh = campus.meshes.find(mesh => mesh.userData.building.id === building.id);
      for (const mesh of selectedMeshes) {
        previousMaterials.set(mesh, mesh.material);
        const tint = material => {
          const selected = material.clone();
          selected.color?.lerp(selectionTint, .15);
          selected.emissive?.setHex(0x201408);
          return selected;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(tint) : tint(mesh.material);
      }
      selectionHighlight.setSelection(selectedMeshes);
      updateLabels.setSelected(building.id);
      explorer.showBuildingInformation(building, placeId);
      if (focusMap && selectedMesh) {
        const bounds = new THREE.Box3();
        selectedMeshes.forEach(mesh => bounds.expandByObject(mesh));
        const center = bounds.getCenter(new THREE.Vector3());
        center.y = 0;
        camera.position.add(center.clone().sub(controls.target));
        controls.target.copy(center);
        controls.update();
      }
      publishBuildingSelection({ ...building, name: explorer.getBuildingName(building) });
      render();
    }
    const explorer = await initFacilityExplorer(buildings, selectBuilding);
    campus.anchors.forEach(anchor => { anchor.name = explorer.getMapLabel(anchor.building); });
    const updateLabels = createLabels(container, campus.anchors, selectBuilding);
    let decisions = null;
    let experience = null;
    let festivalEvent = null;
    await Promise.all([initOperations(), initReactions()]);
    decisions = await initDecisions({ container, anchors: campus.anchors, onSelect: selectBuilding, onChange: render });
    festivalEvent = await initFestivalMapEvent({ container, anchors: campus.anchors });
    experience = await initExperience({ container, anchors: campus.anchors });
    try { startGame(); } catch (error) {
      document.querySelector('#game-notice').textContent = error.message + ' 메뉴에서 새 게임으로 다시 시작할 수 있습니다.';
    }
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
      selectionHighlight.update(camera, container.clientWidth, container.clientHeight);
      decisions?.update(camera, container.clientWidth, container.clientHeight);
      experience?.update(camera, container.clientWidth, container.clientHeight);
      festivalEvent?.update(camera, container.clientWidth, container.clientHeight);
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
    selectBuilding(buildings.find(building => building.id === 'way/367504016') || buildings[0]);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let lastFrame = 0, elapsed = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      if (document.hidden) { lastFrame = now; return; }
      if (now - lastFrame < 33) return;
      elapsed += Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
      const daylight = scenery.update(reducedMotion ? 0 : elapsed, getState(), experience.getLightingMode());
      sunlight.intensity = .3 + daylight * 1.7;
      ambient.intensity = .5 + daylight * 1.8;
      scene.background.setRGB(.15 + daylight * .67, .22 + daylight * .67, .25 + daylight * .57);
      render();
    }
    requestAnimationFrame(animate);
  } catch (error) {
    status.textContent = error.message || '맵을 열 수 없습니다. 로컬 서버와 WebGL 지원 여부를 확인해 주세요.';
    console.error(error);
  }
}
start();
