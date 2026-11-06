import * as THREE from 'three';

export function createLabels(container, anchors, onSelect) {
  const layer = document.createElement('div');
  layer.className = 'labels';
  const entries = anchors.map(anchor => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'building-label';
    element.textContent = anchor.name;
    element.setAttribute('aria-label', anchor.name + ' 정보 보기');
    element.addEventListener('click', () => onSelect(anchor.building));
    layer.append(element);
    return { ...anchor, element };
  });
  container.append(layer);
  const projected = new THREE.Vector3();
  let selectedId = null;
  function update(camera, width, height) {
    const occupied = [];
    const sorted = [...entries].sort((a, b) => Number(b.building.id === selectedId) - Number(a.building.id === selectedId) || camera.position.distanceToSquared(a.position) - camera.position.distanceToSquared(b.position));
    for (const entry of sorted) {
      projected.copy(entry.position).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const labelWidth = entry.element.offsetWidth;
      const labelHeight = entry.element.offsetHeight;
      const rect = { left: x - labelWidth / 2, right: x + labelWidth / 2, top: y - labelHeight, bottom: y };
      const outside = projected.z < -1 || projected.z > 1 || rect.left < 8 || rect.right > width - 8 || rect.top < 8 || rect.bottom > height - 8;
      const overlaps = occupied.some(other => rect.left < other.right + 4 && rect.right > other.left - 4 && rect.top < other.bottom + 4 && rect.bottom > other.top - 4);
      const visible = !outside && !overlaps;
      entry.element.style.visibility = visible ? 'visible' : 'hidden';
      entry.element.tabIndex = visible ? 0 : -1;
      if (visible) occupied.push(rect);
      entry.element.style.transform = 'translate(' + rect.left + 'px,' + rect.top + 'px)';
    }
  }
  update.setSelected = id => {
    selectedId = id;
    entries.forEach(entry => entry.element.classList.toggle('is-selected', entry.building.id === id));
  };
  return update;
}
