import * as THREE from 'three';
import { getPassageOffset } from './passageLayout.js';

function traceRing(path, points) {
  // Shape 좌표를 회전한 뒤 원본의 두 번째 좌표가 월드 Z가 되도록 합니다.
  points.forEach(([x, z], index) => {
    if (index === 0) path.moveTo(x, -z);
    else path.lineTo(x, -z);
  });
  path.closePath();
}

export function createCampus(buildings) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: 0xc7d8d0 });
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x849f92 });
  const anchors = [];
  const meshes = [];
  for (const building of buildings) {
    const shape = new THREE.Shape();
    traceRing(shape, building.outline);
    for (const ring of building.holes) {
      const hole = new THREE.Path();
      traceRing(hole, ring);
      shape.holes.push(hole);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: building.height, bevelEnabled: false, steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    const offset = getPassageOffset(building.outline);
    geometry.translate(offset.x, 0, offset.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.building = building;
    meshes.push(mesh);
    group.add(mesh);
    group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), lineMaterial));
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    center.y = building.height + 4;
    if (building.showLabel !== false) {
      anchors.push({
        name: building.name,
        position: center,
        building,
      });
    }
  }
  const bounds = new THREE.Box3().setFromObject(group);
  return { group, bounds, anchors, meshes };
}
