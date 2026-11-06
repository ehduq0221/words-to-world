import * as THREE from 'three';

// 사용자 제공 지도의 상대 배치를 바탕으로 한 게임용 운동장입니다.
export function createSportsField(building, offset) {
  const { center, right, down, width, length } = building.layout;
  const group = new THREE.Group();
  const point = (h, v, y = .3) => new THREE.Vector3(
    center[0] + right[0] * h + down[0] * v + offset.x,
    y,
    center[1] + right[1] * h + down[1] * v + offset.z,
  );
  // 양 끝을 반원으로 단순화한 달리기 트랙입니다.
  const radius = width / 2;
  const straight = length / 2 - radius;
  function stadium(r) {
    const points = [];
    for (let i = 0; i <= 24; i++) {
      const angle = Math.PI * i / 24;
      points.push([Math.cos(angle) * r, -straight - Math.sin(angle) * r]);
    }
    for (let i = 0; i <= 24; i++) {
      const angle = Math.PI + Math.PI * i / 24;
      points.push([Math.cos(angle) * r, straight - Math.sin(angle) * r]);
    }
    return points;
  }
  const boundary = stadium(radius);
  const shape = new THREE.Shape(boundary.map(([x, z]) => new THREE.Vector2(x, z)));
  const geometry = new THREE.ShapeGeometry(shape);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const p = point(positions.getX(i), positions.getY(i), .18);
    positions.setXYZ(i, p.x, p.y, p.z);
  }
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: 0xc7b7a2, side: THREE.DoubleSide }));
  surface.userData.building = building;
  group.add(surface);
  const white = new THREE.LineBasicMaterial({ color: 0xf5f5e9 });
  function line(points, closed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([h, v]) => point(h, v)));
    group.add(closed ? new THREE.LineLoop(geometry, white) : new THREE.Line(geometry, white));
  }
  for (let lane = 0; lane < 4; lane++) line(stadium(radius - 2 - lane * 3), true);
  const pitch = new THREE.PlaneGeometry(62, 100);
  const pitchPositions = pitch.attributes.position;
  for (let i = 0; i < pitchPositions.count; i++) {
    const p = point(pitchPositions.getX(i), pitchPositions.getY(i), .25);
    pitchPositions.setXYZ(i, p.x, p.y, p.z);
  }
  pitch.computeVertexNormals();
  const grass = new THREE.Mesh(pitch, new THREE.MeshLambertMaterial({ color: 0x9db58d, side: THREE.DoubleSide }));
  grass.userData.building = building;
  group.add(grass);
  line([[-31, -50], [31, -50], [31, 50], [-31, 50]], true);
  line([[-31, 0], [31, 0]]);
  line(Array.from({ length: 32 }, (_, i) => [Math.cos(i * Math.PI / 16) * 9, Math.sin(i * Math.PI / 16) * 9]), true);
  for (const sign of [-1, 1]) {
    line([[-18, sign * 50], [-18, sign * 34], [18, sign * 34], [18, sign * 50]]);
    line([[-9, sign * 50], [-9, sign * 44], [9, sign * 44], [9, sign * 50]]);
  }
  const marker = point(0, 0, 3);
  return { group, meshes: [surface, grass], anchor: marker };
}
