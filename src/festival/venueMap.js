// 독립 기획 화면의 위치 안내도. 원본 건물 좌표를 같은 캠퍼스 축으로 투영합니다.
export async function createVenueMap(container, venues, onSelect) {
  const response = await fetch(new URL('../../public/data/campus.json', import.meta.url));
  if (!response.ok) throw new Error('위치 안내도 데이터를 불러오지 못했습니다.');
  const { buildings } = await response.json();
  const project = ([x, z]) => [x * -.782 + z * -.623, x * .623 + z * -.782];
  const points = buildings.flatMap(b => b.outline.map(project));
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const maxX = Math.max(...points.map(p => p[0])), maxY = Math.max(...points.map(p => p[1]));
  const ns = 'http://www.w3.org/2000/svg';
  const element = (name, attrs) => { const el = document.createElementNS(ns, name); Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value)); return el; };
  const svg = element('svg', { viewBox: `${minX - 45} ${minY - 45} ${maxX - minX + 90} ${maxY - minY + 90}`, role: 'group', 'aria-label': '캠퍼스 위치 안내도. 대운동장 또는 초록 B를 선택하세요.' });
  buildings.forEach(building => {
    const outline = building.outline.map(project);
    svg.append(element('polygon', { points: outline.map(p => p.join(',')).join(' '), fill: building.kind === 'sports-field' ? '#b6d59c' : building.id === 'way/367512822' ? '#96b3a0' : '#d3e0d6', stroke: '#adc4b3', 'stroke-width': 1 }));
  });
  venues.forEach((venue, i) => {
    const anchor = buildings.find(b => b.id === venue.anchorBuildingId);
    if (!anchor) return;
    const center = project([(Math.min(...anchor.outline.map(p => p[0])) + Math.max(...anchor.outline.map(p => p[0]))) / 2, (Math.min(...anchor.outline.map(p => p[1])) + Math.max(...anchor.outline.map(p => p[1]))) / 2]);
    const label = element('text', { x: center[0], y: center[1] + 32, 'font-size': 18, 'text-anchor': 'middle', fill: '#2c563d' });
    label.textContent = anchor.kind === 'sports-field' ? anchor.name : '19호관'; svg.append(label);
    const x = center[0] + venue.rightOffset, y = center[1] + venue.downOffset;
    const g = element('g', { 'data-venue': venue.id, tabindex: 0, role: 'button', 'aria-pressed': 'false', 'aria-label': venue.name });
    g.append(element('rect', { x: x - 22, y: y - 12, width: 44, height: 24, rx: 4, fill: '#59d978', stroke: '#267442', 'stroke-width': 2 }));
    const text = element('text', { x, y: y + 6, 'font-size': 18, 'text-anchor': 'middle', fill: '#163d24', 'font-weight': 'bold' }); text.textContent = venue.label || String(i + 1); g.append(text);
    g.addEventListener('click', () => onSelect(venue.id));
    g.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(venue.id); } });
    svg.append(g);
  });
  container.replaceChildren(svg);
  const note = document.createElement('small'); note.textContent = '대운동장·B를 눌러 선택 · 게임용 캠퍼스 위치 안내도'; container.append(note);
}
