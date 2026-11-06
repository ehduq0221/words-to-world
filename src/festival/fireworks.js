import * as THREE from 'three';

// 캠퍼스 규모의 상승 궤적·구형 폭발·잔광. 무대 축소 배율을 적용하지 않습니다.
export function createFireworks(parent, reducedMotion) {
  const shells = 7, sparks = 120, trails = 4, count = shells * sparks * trails;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  const context = canvas.getContext('2d'), gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'white'); gradient.addColorStop(.15, '#ffffffee'); gradient.addColorStop(1, '#ffffff00');
  context.fillStyle = gradient; context.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({ size: 6.5, map: texture, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const particles = new THREE.Points(geometry, material); particles.visible = false; particles.frustumCulled = false; parent.add(particles);
  const palette = ['#ffe3a3', '#ffa8df', '#98dfff', '#b8ffb3', '#ffbb8c', '#c8aeff', '#fff6d5'].map(c => new THREE.Color(c));
  let age = 20;
  return {
    burst() { age = 0; particles.visible = true; },
    reset() { age = 20; particles.visible = false; },
    dispose() { texture.dispose(); },
    update(dt) {
      age += dt;
      if (age > 7) { particles.visible = false; return; }
      for (let shell = 0; shell < shells; shell++) for (let spark = 0; spark < sparks; spark++) for (let trail = 0; trail < trails; trail++) {
        const i = ((shell * sparks + spark) * trails + trail) * 3;
        const local = reducedMotion ? 1.5 : age - shell * .42 - trail * .035;
        const burstAge = local - .75;
        const active = local >= 0 && local < 4.1;
        const theta = spark * 2.399963, vertical = spark / (sparks - 1) * 2 - 1, radial = Math.sqrt(Math.max(0, 1 - vertical * vertical));
        const centerX = Math.sin(shell * 2.4) * 72, height = 125 + (shell % 3) * 27;
        if (burstAge < 0) {
          positions[i] = centerX; positions[i + 1] = active ? Math.max(0, local / .75) * height : -3000;
          positions[i + 2] = -(shell % 2) * 15;
        } else {
          const spread = 115 * burstAge / (1 + burstAge * .7);
          positions[i] = centerX + Math.cos(theta) * radial * spread;
          positions[i + 1] = height + vertical * spread - burstAge * burstAge * 6;
          positions[i + 2] = Math.sin(theta) * radial * spread - (shell % 2) * 15;
        }
        if (!active) positions[i + 1] = -3000;
        const intensity = active ? (burstAge < 0 ? .8 : Math.max(0, 1 - burstAge / 3.5)) * (1 - trail * .18) : 0;
        colors[i] = palette[shell].r * intensity; colors[i + 1] = palette[shell].g * intensity; colors[i + 2] = palette[shell].b * intensity;
      }
      geometry.attributes.position.needsUpdate = true; geometry.attributes.color.needsUpdate = true;
    },
  };
}
