// 건물 안내는 지도 ID, 매장 위치는 operations.json을 기준으로 연결합니다.
const typeNames = { cafeteria: '식당', cafe: '카페', restaurant: '음식점', store: '편의점·매점' };
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
async function readJson(path) {
  const response = await fetch(new URL(path, import.meta.url));
  if (!response.ok) throw new Error('시설 안내 자료를 불러올 수 없습니다.');
  return response.json();
}

export async function initFacilityExplorer(buildings, onSelect) {
  const [guide, operations] = await Promise.all([
    readJson('../../public/data/facilities.json'),
    readJson('../../public/data/operations.json'),
  ]);
  const records = new Map(buildings.map(building => [building.id, building]));
  const byId = new Map(buildings.map(building => [building.id, records.get(building.selectionGroupId) || building]));
  const listedBuildings = buildings.filter(building => !building.selectionGroupId || building.selectionGroupId === building.id);
  const places = operations.facilities;
  const ids = new Set();
  for (const place of places) {
    if (ids.has(place.id) || !byId.has(place.buildingId)) throw new Error('시설 ID 또는 연결된 지도 건물을 확인해 주세요.');
    ids.add(place.id);
  }
  const list = document.querySelector('#facility-list');
  const detail = document.querySelector('#facility-detail');
  const search = document.querySelector('#facility-search');
  const filter = document.querySelector('#food-filter');
  const count = document.querySelector('#facility-result-count');
  const categories = guide.categories;
  const categoryNames = Object.fromEntries(categories.map(item => [item.id, item.name]));
  let category = 'all';
  let selectedBuildingId = null;
  let selectedPlaceId = null;
  const normalize = value => value.toLocaleLowerCase('ko-KR').replace(/\s/g, '');
  const titleOf = building => guide.buildings[building.id]?.name || building.name;
  const foodPlaces = () => places.filter(place => place.type !== 'store');

  function markSelection() {
    list.querySelectorAll('button').forEach(button => {
      const selected = button.dataset.placeId
        ? button.dataset.placeId === selectedPlaceId
        : button.dataset.buildingId === selectedBuildingId && !selectedPlaceId;
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function placeCard(place) {
    const card = element('section', 'place-card');
    card.dataset.placeId = place.id;
    card.classList.toggle('is-selected', place.id === selectedPlaceId);
    card.append(element('span', 'place-type', typeNames[place.type]), element('h4', '', place.name));
    // 층·호실은 공식 안내에 명시된 문자열 그대로 표시합니다. 실내 좌표를 추정하지 않습니다.
    card.append(element('p', 'place-location', place.location));
    const button = element('button', 'locate-place', '지도에서 보기');
    button.type = 'button';
    button.setAttribute('aria-label', place.name + ' 지도에서 보기');
    button.addEventListener('click', () => onSelect(byId.get(place.buildingId), { placeId: place.id, focusMap: true }));
    card.append(button);
    return card;
  }

  function renderList() {
    const query = normalize(search.value.trim());
    filter.hidden = category !== 'food';
    let entries;
    if (category === 'food') {
      entries = foodPlaces().filter(place => (!filter.value || place.type === filter.value || (filter.value === 'restaurant' && place.type === 'cafeteria')) &&
        normalize(place.name + place.location).includes(query)).map(place => ({ building: byId.get(place.buildingId), place }));
    } else {
      entries = listedBuildings.filter(building => {
        const info = guide.buildings[building.id];
        const matchesCategory = category === 'all' || info?.category === category;
        const text = [titleOf(building), building.name, info?.number || '', ...(info?.aliases || []), info?.description || ''].join(' ');
        return matchesCategory && normalize(text).includes(query);
      }).map(building => ({ building }));
      if (query && category === 'all') {
        entries.push(...places.filter(place => normalize(place.name + place.location).includes(query)).map(place => ({ building: byId.get(place.buildingId), place })));
      }
      entries.sort((a, b) => (guide.buildings[a.building.id]?.number || '999').localeCompare(guide.buildings[b.building.id]?.number || '999', 'ko', { numeric: true }) || titleOf(a.building).localeCompare(titleOf(b.building), 'ko'));
    }
    list.replaceChildren();
    count.textContent = category === 'food' ? entries.length + '개 매장' : entries.filter(item => !item.place).length + '개 지도 시설' + (entries.some(item => item.place) ? ' · 매장 ' + entries.filter(item => item.place).length + '곳' : '');
    for (const { building, place } of entries) {
      const button = element('button', '');
      button.type = 'button';
      button.dataset.buildingId = building.id;
      if (place) button.dataset.placeId = place.id;
      const info = guide.buildings[building.id];
      const badge = element('span', '', place ? (place.type === 'cafe' ? '카페' : place.type === 'store' ? '매점' : '식당') : (info?.number || '시설'));
      const text = element('div', 'facility-item-text');
      text.append(element('b', '', place ? place.name : titleOf(building)));
      if (place) text.append(element('small', '', place.location));
      else text.append(element('small', '', categoryNames[info?.category] + (info?.verification === 'needs-review' ? ' · 정보 확인 중' : '')));
      button.append(badge, text);
      button.addEventListener('click', () => onSelect(building, { placeId: place?.id, focusMap: true }));
      list.append(button);
    }
    if (!entries.length) list.append(element('p', 'facility-empty', '검색 결과가 없습니다.'));
    markSelection();
  }

  function showBuildingInformation(building, placeId = null) {
    selectedBuildingId = building.id;
    selectedPlaceId = placeId;
    const info = guide.buildings[building.id];
    detail.closest('.left-panel').classList.add('show-building-info');
    detail.replaceChildren();
    detail.append(element('span', 'detail-type', (info?.number ? info.number + '호관 · ' : '') + (categoryNames[info?.category] || categoryNames.other)),
      element('h3', '', titleOf(building)), element('p', '', info?.description || '상세 시설 안내를 확인 중입니다.'));
    if (info?.verification === 'needs-review') detail.append(element('p', 'verification-note', '이 시설의 공식 명칭·용도 또는 지도 대응을 확인 중입니다.'));
    if (info?.note) detail.append(element('p', 'verification-note', info.note));
    if (info?.rooms?.length) {
      detail.append(element('h4', 'inside-heading', '주요 시설·용도'));
      const rooms = element('ul', 'building-rooms');
      for (const room of info.rooms) {
        const item = element('li', '');
        item.append(element('strong', '', room.name), element('span', '', room.location));
        rooms.append(item);
      }
      detail.append(rooms);
    }
    const evidence = guide.sources[info?.source];
    if (evidence) {
      const source = element('a', 'facility-source', evidence.title);
      source.href = evidence.url; source.target = '_blank'; source.rel = 'noreferrer';
      detail.append(source);
      if (evidence.checkedAt) detail.append(element('small', 'source-date', '자료 확인: ' + evidence.checkedAt));
    }
    const inside = places.filter(place => byId.get(place.buildingId)?.id === building.id);
    if (inside.length) {
      detail.append(element('h4', 'inside-heading', '이 건물의 식음·편의시설'));
      const sorted = [...inside].sort((a, b) => Number(b.id === placeId) - Number(a.id === placeId));
      sorted.forEach(place => detail.append(placeCard(place)));
      const source = element('a', 'facility-source', '위치 정보: 인천대학교 공식 안내');
      source.href = operations.sources.find(item => item.item === '편의시설 위치와 운영 주체').url;
      source.target = '_blank'; source.rel = 'noreferrer';
      detail.append(source, element('small', 'location-precision', '지도는 소속 건물을 표시합니다. 실내 위치는 층·호실 안내를 확인해 주세요.'));
    }
    markSelection();
  }

  const navigation = document.querySelector('.category-tabs');
  navigation.replaceChildren();
  for (const item of categories) {
    const button = element('button', '', item.name);
    button.type = 'button'; button.dataset.category = item.id;
    button.setAttribute('aria-pressed', String(item.id === category));
    navigation.append(button);
  }
  document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      category = button.dataset.category;
      document.querySelectorAll('[data-category]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      search.value = '';
      renderList();
    });
  });
  search.addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  renderList();
  return {
    showBuildingInformation,
    getBuildingName: titleOf,
    getMapLabel(building) {
      const info = guide.buildings[building.id];
      return (info?.mapLabel || titleOf(building)) + (info?.number ? ' (' + info.number + ')' : '');
    },
  };
}
