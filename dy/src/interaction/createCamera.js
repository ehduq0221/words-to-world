import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';

export function createCamera(renderer, bounds) {
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 8000);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(center.x, 0, center.z);
  controls.minDistance = 70;
  controls.maxDistance = span * 4;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.enableDamping = false;
  controls.screenSpacePanning = false;
  controls.addEventListener('start', () => { renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end', () => { renderer.domElement.style.cursor = 'grab'; });
  renderer.domElement.style.cursor = 'grab';
  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function fit(width, height) {
    resize(width, height);
    const distance = span * 1.35 / Math.min(camera.aspect, 1);
    camera.position.set(center.x + distance * .35, distance * .85, center.z + distance * .75);
    controls.update();
  }
  return { camera, controls, resize, fit };
}
