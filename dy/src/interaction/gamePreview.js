// 실제 학교 정보와 구분되는 화면 예시용 안내입니다.
const categories = {
  study: [
    { name: '학산도서관', number: '06', type: '학습 시설', description: '학생들의 학습과 자료 탐색을 지원하는 공간입니다.', metric: '학습 만족도', value: '82 / 100', note: '열람 공간과 학습 환경을 살펴보세요.' },
    { name: '정보기술대학', number: '07', type: '교육 시설', description: '전공 수업과 실습이 이루어지는 공간입니다.', metric: '실습 환경', value: '개선 필요', note: '학생들이 실습 장비 개선을 요청하고 있어요.' },
    { name: '공과대학', number: '08', type: '교육 시설', description: '공학 분야의 수업과 실험을 위한 공간입니다.', metric: '교육 환경', value: '양호', note: '수업과 실험 환경을 꾸준히 관리해 보세요.' },
  ],
  life: [
    { name: '제1기숙사', number: '18-1', type: '주거 시설', description: '학생들이 캠퍼스에서 생활하는 주거 공간입니다.', metric: '주거 만족도', value: '64 / 100', note: '학생들이 기숙사 자리 부족을 이야기하고 있어요.' },
    { name: '학생회관', number: '17', type: '학생 생활', description: '학생들의 교내 활동과 생활을 지원하는 공간입니다.', metric: '생활 편의성', value: '78 / 100', note: '학생들의 일상에 필요한 시설을 살펴보세요.' },
  ],
  research: [
    { name: '공동실험실습관', number: '09', type: '연구 시설', description: '실험과 실습을 위한 공간입니다.', metric: '연구 환경', value: '양호', note: '연구실과 실험 장비의 운영 상태를 살펴보세요.' },
    { name: '제2공동실험실습관', number: '27', type: '연구 시설', description: '교육과 연구 활동을 지원하는 공간입니다.', metric: '연구 역량', value: '72 / 100', note: '학교의 연구 기반을 발전시킬 수 있어요.' },
  ],
};
const list = document.querySelector('#facility-list');
const detail = document.querySelector('#facility-detail');
function selectFacility(facility, selectedButton) {
  detail.closest('.left-panel').classList.add('show-building-info');
  list.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button === selectedButton)));
  detail.replaceChildren();
  const type = document.createElement('span');
  type.className = 'detail-type';
  type.textContent = facility.type;
  const title = document.createElement('h3');
  title.textContent = facility.name;
  const description = document.createElement('p');
  description.textContent = facility.description;
  detail.append(type, title, description);
  if (facility.metric) {
    const metric = document.createElement('div');
    metric.className = 'detail-metric';
    const label = document.createElement('span');
    label.textContent = facility.metric;
    const value = document.createElement('b');
    value.textContent = facility.value;
    metric.append(label, value);
    detail.append(metric);
  }
  const note = document.createElement('small');
  note.textContent = facility.note;
  detail.append(note);
}
function selectCategory(category) {
  list.replaceChildren();
  document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  for (const facility of categories[category]) {
    const button = document.createElement('button');
    const number = document.createElement('span');
    number.textContent = facility.number;
    const name = document.createElement('b');
    name.textContent = facility.name;
    button.append(number, name);
    button.addEventListener('click', () => selectFacility(facility, button));
    list.append(button);
  }
  selectFacility(categories[category][0], list.firstElementChild);
}
document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => selectCategory(button.dataset.category)));
selectCategory('study');

export function showBuildingInformation(building) {
  const number = building.name.match(/\((\d+(?:-\d+)?)\)/)?.[1];
  for (const [category, facilities] of Object.entries(categories)) {
    const facility = facilities.find(item => item.number === number);
    if (facility) {
      selectCategory(category);
      const button = list.querySelectorAll('button')[facilities.indexOf(facility)];
      selectFacility(facility, button);
      return;
    }
  }
  selectFacility({
    name: building.name,
    type: number ? number + '호관' : '캠퍼스 시설',
    description: '인천대학교 송도캠퍼스 지도에 포함된 건물입니다.',
    note: '상세 시설 안내는 확인 후 보완합니다.',
  });
}
