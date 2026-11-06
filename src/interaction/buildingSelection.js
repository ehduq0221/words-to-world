// 모든 지도·시설 목록 선택은 main.js의 동일한 선택 함수를 통과합니다.
export function publishBuildingSelection(building) {
  const actions = document.querySelector('#facility-actions');
  actions.replaceChildren();
  actions.dataset.buildingId = building.id;
  window.dispatchEvent(new CustomEvent('campus:select', {
    detail: { buildingId: building.id, name: building.name },
  }));
}
