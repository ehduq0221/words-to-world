export async function loadCampus() {
  const response = await fetch(new URL('../../public/data/campus.json', import.meta.url));
  if (!response.ok) throw new Error('캠퍼스 데이터를 불러올 수 없습니다.');
  const data = await response.json();
  if (!Array.isArray(data.buildings) || data.buildings.length === 0) {
    throw new Error('건물 데이터가 비어 있습니다.');
  }
  for (const building of data.buildings) {
    if (!Array.isArray(building.outline) || building.outline.length < 3 ||
        !building.outline.every(point => point.length === 2 && point.every(Number.isFinite)) ||
        !Number.isFinite(building.height) || building.height <= 0) {
      throw new Error('건물의 위치 또는 높이 데이터가 올바르지 않습니다.');
    }
  }
  return data.buildings;
}
