import * as THREE from 'three';

// 무대 배율과 무관한 캠퍼스 하늘 규모의 연속 폭죽입니다.
export function createFireworks(parent, reducedMotion) {
  const shells = 5, sparks = 96, trails = 3, count = shells * sparks * trails;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'white'); gradient.addColorStop(.2, '#ffffffed'); gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient; context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({ size: 5, map: texture, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(geometry, material); particles.visible = false; particles.frustumCulled = false; parent.add(particles);
  let age = 10;
  const palette = ['#ffd390', '#ffa2d7', '#95d8ff', '#c8ff9d', '#ffb38d'].map(color => new THREE.Color(color));
  return {
    burst() { age = 0; particles.visible = true; },
    reset() { age = 10; particles.visible = false; },
    dispose() { texture.dispose(); },
    update(dt) {
      age += dt;
      if (age > 5.2) { particles.visible = false; return; }
      for (let shell = 0; shell < shells; shell++) {
        for (let spark = 0; spark < sparks; spark++) {
          const theta = spark * 2.399963, vertical = spark / (sparks - 1) * 2 - 1;
          const radius = Math.sqrt(Math.max(0, 1 - vertical * vertical));
          for (let trail = 0; trail < trails; trail++) {
            const i = ((shell * sparks + spark) * trails + trail) * 3;
            const time = reducedMotion ? .8 : age - shell * .48 - trail * .045;
            const active = time >= 0 && time < 3.2;
            const spread = Math.max(0, 90 * time / (1 + time * .65));
            positions[i] = (shell - 2) * 36 + Math.cos(theta) * radius * spread;
            positions[i + 1] = active ? 120 + (shell % 2) * 30 + vertical * spread - (reducedMotion ? 0 : time * time * 7) : -2000;
            positions[i + 2] = -25 - (shell % 2) * 25 + Math.sin(theta) * radius * spread;
            const glow = active ? Math.max(0, 1 - time / 3.2) * (1 - trail * .24) : 0;
            colors[i] = palette[shell].r * glow; colors[i + 1] = palette[shell].g * glow; colors[i + 2] = palette[shell].b * glow;
          }
        }
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    },
  };
}
