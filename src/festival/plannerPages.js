// 가수 선택과 현재 라인업을 함께 보여 주고 보조 화면만 탭으로 전환합니다.
export function createPlannerPages(root) {
  const definitions = [['artists', '가수·라인업'], ['settings', '장소·축제 구성'], ['library', '불러오기·저장한 조합']];
  const workspace = document.createElement('div'); workspace.className = 'f-workspace';
  const viewport = document.createElement('div'); viewport.className = 'f-page-viewport';
  const track = document.createElement('div'); track.className = 'f-page-track'; viewport.append(track); workspace.append(viewport);
  const pages = definitions.map(([id, title]) => {
    const page = document.createElement('section'); page.className = `f-page f-page-${id}`; page.id = `f-page-${id}`;
    page.setAttribute('aria-label', title); page.tabIndex = -1; track.append(page); return page;
  });
  const examples = document.createElement('details'); examples.className = 'f-example-drawer';
  examples.innerHTML = '<summary>✦ 예시 조합에서 시작하기</summary>';
  examples.append(root.querySelector('.f-presets')); root.querySelector('.festival-heading').remove();
  pages[0].append(examples, root.querySelector('.f-artists'));
  const sidebar = document.createElement('aside'); sidebar.className = 'f-current-plan'; sidebar.setAttribute('aria-label', '현재 기획안과 선택 라인업');
  sidebar.innerHTML = '<div class="f-overview" aria-live="polite"></div>';
  sidebar.append(root.querySelector('.f-poster'), root.querySelector('.f-reaction')); workspace.append(sidebar);
  const settings = root.querySelector('.f-planning > .f-card');
  settings.querySelector('h2').textContent = '장소와 축제 구성';
  settings.querySelector('.f-eyebrow').textContent = 'MAKE IT YOURS';
  sidebar.prepend(settings.querySelector('.f-cost'));
  const pyro = settings.querySelector('.f-fireworks');
  pyro.querySelector('legend').textContent = '🎆 폭죽 설정';
  const notes = pyro.querySelectorAll('p');
  notes[0].textContent = '여러 시점을 함께 선택할 수 있어요.';
  notes[1].textContent = '선택한 무대 기준의 하늘 위치입니다.';
  sidebar.querySelector('.f-poster').after(pyro);
  pages[1].append(settings); pages[2].append(root.querySelector('.f-library'));
  root.querySelector('.f-layout').remove();
  const nav = document.createElement('nav'); nav.className = 'f-page-nav'; nav.setAttribute('aria-label', '축제 스튜디오 화면');
  nav.innerHTML = `<div class="f-page-steps">${definitions.map(([id, title]) => `<button data-page="${id}" aria-controls="f-page-${id}"><b>${title}</b></button>`).join('')}</div>`;
  root.querySelector('#f-message').after(nav, workspace);
  let current = 0;
  function goTo(id, focus = false) {
    if (id === 'venue') id = 'settings';
    if (id === 'effects' || id === 'fireworks') { pyro.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    if (id === 'lineup' || id === 'welcome') id = 'artists';
    const index = typeof id === 'number' ? id : definitions.findIndex(([key]) => key === id);
    current = Math.max(0, Math.min(pages.length - 1, index));
    track.style.transform = `translateX(-${current * 100}%)`;
    pages.forEach((page, i) => { page.inert = i !== current; page.setAttribute('aria-hidden', String(i !== current)); });
    nav.querySelectorAll('[data-page]').forEach((button, i) => { if (i === current) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); });
    if (focus) pages[current].focus({ preventScroll: true });
  }
  nav.addEventListener('click', event => { const button = event.target.closest('[data-page]'); if (button) goTo(button.dataset.page, true); });
  const library = document.createElement('button'); library.textContent = '↗ 불러오기 · 저장한 조합'; library.dataset.openLibrary = '';
  library.onclick = () => goTo('library', true); root.querySelector('.f-toolbar [data-action="save"]').after(library);
  goTo('artists'); return { goTo };
}
