import * as THREE from 'three';

export function createSelectionHighlight(container, scene) {
  const marker = document.createElement('div');
  marker.className = 'selection-highlight';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  container.append(marker);
  const outline = new THREE.Group();
  scene.add(outline);
  const material = new THREE.LineBasicMaterial({ color: 0xe79a33, depthTest: false });
  let bounds = null;
  const point = new THREE.Vector3();
  function setSelection(meshes) {
    for (const child of [...outline.children]) {
      child.geometry.dispose();
      outline.remove(child);
    }
    bounds = new THREE.Box3();
    for (const mesh of meshes) {
      bounds.expandByObject(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), material);
      edges.matrixAutoUpdate = false;
      edges.matrix.copy(mesh.matrixWorld);
      edges.renderOrder = 20;
      outline.add(edges);
    }
    if (bounds.isEmpty()) bounds = null;
    marker.hidden = !bounds;
  }
  function update(camera, width, height) {
    if (!bounds) return;
    bounds.getCenter(point).project(camera);
    const x = (point.x + 1) * width / 2;
    const y = (1 - point.y) * height / 2;
    marker.hidden = point.z < -1 || point.z > 1 || x < 0 || x > width || y < 0 || y > height;
    if (marker.hidden) return;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const px of [bounds.min.x, bounds.max.x]) for (const py of [bounds.min.y, bounds.max.y]) for (const pz of [bounds.min.z, bounds.max.z]) {
      point.set(px, py, pz).project(camera);
      const sx = (point.x + 1) * width / 2;
      const sy = (1 - point.y) * height / 2;
      left = Math.min(left, sx); right = Math.max(right, sx);
      top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    const w = Math.min(width - 12, Math.max(44, right - left + 18));
    const h = Math.min(height - 12, Math.max(44, bottom - top + 18));
    marker.style.width = w + 'px'; marker.style.height = h + 'px';
    marker.style.left = Math.max(6, Math.min(width - w - 6, (left + right - w) / 2)) + 'px';
    marker.style.top = Math.max(6, Math.min(height - h - 6, (top + bottom - h) / 2)) + 'px';
  }
  return { setSelection, update };
}
