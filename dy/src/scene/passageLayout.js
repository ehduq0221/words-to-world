// 참고 이미지의 좌우·상하 방향에 맞춘 캠퍼스 축입니다.
const AXIS_LENGTH = Math.hypot(0.782, 0.623);
const RIGHT_X = -0.782 / AXIS_LENGTH;
const RIGHT_Z = -0.623 / AXIS_LENGTH;
const DOWN_X = 0.623 / AXIS_LENGTH;
const DOWN_Z = -0.782 / AXIS_LENGTH;

// 빨간선의 세로 통로 4개와 위·아래 가로 통로 2개에 간격을 더합니다.
const VERTICAL_PASSAGES = [-180, -45, 43, 150];
const HORIZONTAL_PASSAGES = [-200, 254];
const EXTRA_WIDTH = 24;

function bandOffset(value, passages) {
  const band = passages.filter(boundary => value > boundary).length;
  return (band - passages.length / 2) * EXTRA_WIDTH;
}

export function getPassageOffset(outline) {
  const horizontal = outline.map(([x, z]) => x * RIGHT_X + z * RIGHT_Z);
  const vertical = outline.map(([x, z]) => x * DOWN_X + z * DOWN_Z);
  const centerX = (Math.min(...horizontal) + Math.max(...horizontal)) / 2;
  const centerZ = (Math.min(...vertical) + Math.max(...vertical)) / 2;
  const across = bandOffset(centerX, VERTICAL_PASSAGES);
  const along = bandOffset(centerZ, HORIZONTAL_PASSAGES);
  return {
    x: across * RIGHT_X + along * DOWN_X,
    z: across * RIGHT_Z + along * DOWN_Z,
  };
}
