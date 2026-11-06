import * as THREE from 'three';

// 직접 생성한 입자 폭죽. 영상·외부 이미지·음원을 사용하지 않습니다.
export function createFireworks(parent, reducedMotion) {
  const count = 210, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size: 1.2, vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  const particles = new THREE.Points(geometry, material); particles.visible = false; parent.add(particles);
  let age = 10;
  const palette = [new THREE.Color('#ffd390'), new THREE.Color('#ffa2d7'), new THREE.Color('#95d8ff')];
  return {
    burst() { age = 0; particles.visible = true; },
    reset() { age = 10; particles.visible = false; },
    update(dt) {
      age += dt;
      if (age > 3.2) { particles.visible = false; return; }
      material.opacity = Math.min(1, (3.2 - age) / 1.6);
      for (let i = 0; i < count; i++) {
        const shell = Math.floor(i / 70), theta = i * 2.399963, vertical = (i % 70) / 35 - 1;
        const radius = Math.sqrt(1 - vertical * vertical), t = reducedMotion ? .9 : Math.max(0, age - shell * .25);
        const spread = reducedMotion ? 17 : 25 * t / (1 + t * .7);
        positions[i * 3] = (shell - 1) * 30 + Math.cos(theta) * radius * spread;
        positions[i * 3 + 1] = 63 + vertical * spread - (reducedMotion ? 0 : t * t * 4);
        positions[i * 3 + 2] = -10 + Math.sin(theta) * radius * spread;
        colors[i * 3] = palette[shell].r; colors[i * 3 + 1] = palette[shell].g; colors[i * 3 + 2] = palette[shell].b;
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    },
  };
}
