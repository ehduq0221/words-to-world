import { FIREWORK_SITES } from './profiles.js';
import { createPlan, readPlans, writePlans, totalCost, expectedReaction, validatePlan, FIREWORK_MOMENTS, availableFireworks } from './plans.js';

const won = value => `${value.toLocaleString('ko-KR')}원`;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 독립 실행·나중 게임 연결에서 같은 진입 함수를 사용합니다. 게임 상태를 읽거나 바꾸지 않습니다.
export async function initFestival() {
  const root = document.querySelector('#festival');
  if (!root) throw new Error('#festival 영역이 필요합니다.');
  const response = await fetch(new URL('../../public/data/festival.json', import.meta.url));
  if (!response.ok) throw new Error('축제 후보 데이터를 불러오지 못했습니다.');
  const data = await response.json();
  let plan = createPlan(data), saved = [], filter = 'all', dirty = false, savingBlocked = false, previewing = false;
  const comparison = new Set();
  try { saved = readPlans(data); } catch (error) { savingBlocked = true; setTimeout(() => message(`저장한 기획안을 읽지 못했습니다. ${error.message}`), 0); }
  root.innerHTML = `<div class="festival-heading"><div><span class="f-eyebrow">WORDS TO WORLD / CAMPUS FESTIVAL</span><h1>송도캠퍼스,<br>오늘은 대동제.</h1><p>좋아하는 목소리, 함께할 친구들.<br>인천대학교에서 꿈꾸던 하루를 먼저 만나 보세요.</p></div><div class="f-stamp">ONE DAY<br><b>OUR<br>YOUTH</b><span>송도캠퍼스</span></div></div>
    <nav class="f-toolbar"><button data-action="new">＋ 새 기획안</button><button data-action="save" class="primary">기획안 저장</button><button data-action="quick-preview">⚡ 빠르게 보기</button><button data-action="preview" class="preview-button">▷ 축제 체험하기</button></nav>
    <p id="f-message" role="status" aria-live="polite"></p>
    <section class="f-presets" aria-label="예시 라인업"><span class="f-eyebrow">차트에서 골라 본 우리의 하루</span><div class="f-preset-list"></div><p class="f-chart-source"></p></section>
    <div class="f-layout"><section class="f-card f-artists"><div class="f-section-title"><div><span class="f-eyebrow">01 / YOUR ARTISTS</span><h2>누구와 함께할까요?</h2></div><span class="f-selected-count"></span></div>
      <p class="f-muted">실제 가수 후보 · 최대 3팀 · 섭외비와 공연 연출은 게임용 설정</p><nav class="f-filters" aria-label="가수 장르"><button data-filter="all">전체</button><button data-filter="indie">노을·밴드 연출</button><button data-filter="idol">아이돌</button><button data-filter="hiphop">힙합·그루브 연출</button></nav><div class="f-candidates"></div></section>
    <aside class="f-planning"><section class="f-card"><span class="f-eyebrow">02 / MAKE IT YOURS</span><h2>나만의 하루 만들기</h2>
      <label>기획안 이름<input id="f-name" maxlength="60"></label>
      <label>우리의 무대<select id="f-venue"></select></label><p class="f-venue-note"></p><div class="f-location-map" aria-label="축제 장소 위치 안내"></div>
      <label>총예산 (원)<input id="f-budget" type="number" min="0" max="1000000000000" step="1" required></label>
      <div class="f-extras"></div><fieldset class="f-fireworks"><legend>하늘에 남길 순간 · 폭죽 설정</legend><p class="f-muted">원하는 시점을 여러 개 선택하세요. 가수가 부족한 구간은 선택할 수 없어요.</p><div class="f-firework-options"></div><label>폭죽을 터뜨릴 위치<select id="f-firework-position"></select></label><p class="f-muted">선택한 야외무대를 기준으로 하늘 위치를 정합니다. 캠퍼스 중앙은 전체 지도 중앙입니다.</p><button data-action="fireworks-preview">🎆 폭죽만 미리보기</button></fieldset><div class="f-cost" aria-live="polite"></div></section>
      <section class="f-poster" aria-label="선택한 공연 라인업 포스터"><small>INCHEON NATIONAL UNIVERSITY</small><h2 class="f-poster-name"></h2><p>ONE DAY · SONGDO CAMPUS</p><ol class="f-lineup"></ol><div class="f-poster-bottom">함께라서 더 빛나는 우리의 밤 ✦</div></section>
      <blockquote class="f-reaction"></blockquote></aside></div>
    <section class="f-card f-library"><div class="f-section-title"><div><span class="f-eyebrow">03 / YOUR COLLECTION</span><h2>다시 꺼내 보는 설렘</h2></div><button data-action="compare">선택 기획안 비교</button></div><p class="f-muted">이 브라우저에 저장됩니다. 학생 선호도 제출이나 외부 전송은 하지 않습니다.</p><div class="f-saved"></div><div class="f-comparison"></div></section>
    <p class="f-disclaimer"></p>`;
  root.querySelector('.f-disclaimer').textContent = data.notice;
  root.querySelector('.f-preset-list').innerHTML = data.presets.map((p, i) => `<button data-preset="${i}"><strong>${escape(p.name)}</strong><small>${escape(p.description)}</small></button>`).join('');
  root.querySelector('.f-chart-source').textContent = `${data.chartSource.name} · ${data.chartSource.receivedOn} 수신 · 곡 순위 참고 / 실시간 연동 아님`;
  import('./venueMap.js').then(async ({ createVenueMap }) => { await createVenueMap(root.querySelector('.f-location-map'), data.venues.filter(v => !v.archived), id => { plan.venueId = id; syncForm(); edit(); }); render(); }).catch(() => { root.querySelector('.f-location-map').textContent = '위치 지도를 불러오지 못했습니다. 장소 설명을 참고해 주세요.'; });
  root.querySelector('.f-extras').innerHTML = data.extras.map(e => `<label class="f-extra"><input type="checkbox" value="${escape(e.id)}"><span>${escape(e.name)}<small>${escape(e.description)} · ${won(e.cost)}</small></span></label>`).join('');
  root.querySelector('.f-firework-options').innerHTML = FIREWORK_MOMENTS.map(m => `<label class="f-extra"><input type="checkbox" value="${m.id}"><span>${m.label}<small>게임용 연출비 ${won(data.fireworkCost)} / 1회</small></span></label>`).join('');
  root.querySelector('.f-fireworks').addEventListener('change', () => { plan.fireworks = [...root.querySelectorAll('.f-fireworks input:checked')].map(input => input.value); edit(); });
  root.querySelector('#f-firework-position').innerHTML = FIREWORK_SITES.map(site => `<option value="${site.id}">${site.name}</option>`).join('');
  root.querySelector('#f-firework-position').addEventListener('change', event => { plan.fireworkPosition = event.target.value; edit(); });
  function message(text) { root.querySelector('#f-message').textContent = text; }
  function confirmAction(text, label) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog'); dialog.className = 'f-confirm';
      dialog.setAttribute('aria-label', '기획안 변경 확인');
      dialog.innerHTML = '<h2>잠깐, 편집 중인 내용이 있어요.</h2><p></p><div><button data-confirm="cancel" autofocus>취소</button><button data-confirm="accept">계속</button></div>';
      dialog.querySelector('p').textContent = text;
      dialog.querySelector('[data-confirm="accept"]').textContent = label;
      const finish = accepted => { dialog.close(); dialog.remove(); resolve(accepted); };
      dialog.querySelector('[data-confirm="cancel"]').onclick = () => finish(false);
      dialog.querySelector('[data-confirm="accept"]').onclick = () => finish(true);
      dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
      document.body.append(dialog); dialog.showModal();
    });
  }
  async function acceptDiscard(label = '변경을 버리고 계속') {
    return !dirty || await confirmAction('현재 수정한 내용은 아직 저장되지 않았습니다. 저장한 기획안은 유지됩니다.', label);
  }
  function revealPlan() {
    root.querySelector('.f-layout').scrollIntoView({ block: 'start', behavior: 'auto' });
    root.querySelector('#f-name').focus({ preventScroll: true });
  }
  function edit() { plan.fireworks = (plan.fireworks || []).filter(id => availableFireworks(plan).some(m => m.id === id)); dirty = true; message('편집 중 · 저장 버튼을 눌러 기획안을 보관하세요.'); render(); }
  function syncForm() {
    root.querySelector('#f-name').value = plan.name;
    root.querySelector('#f-firework-position').value = plan.fireworkPosition || 'stage-back';
    root.querySelector('#f-budget').value = plan.budget;
    root.querySelector('#f-venue').innerHTML = data.venues.filter(v => !v.archived || v.id === plan.venueId).map(v => `<option value="${escape(v.id)}">${escape(v.name)}${v.archived ? ' (이전 기획안 위치)' : ''}</option>`).join('');
    root.querySelector('#f-venue').value = plan.venueId;
    root.querySelectorAll('.f-extras input').forEach(input => { input.checked = plan.extras.includes(input.value); });
  }
  root.querySelector('#f-name').addEventListener('input', e => { plan.name = e.target.value; edit(); });
  root.querySelector('#f-venue').addEventListener('change', e => { plan.venueId = e.target.value; edit(); });
  root.querySelector('#f-budget').addEventListener('input', e => {
    const value = Number(e.target.value);
    if (!e.target.value || !e.target.checkValidity() || !Number.isSafeInteger(value)) { message('예산을 0 이상의 정수로 입력해 주세요.'); return; }
    plan.budget = value; edit();
  });
  root.querySelector('.f-extras').addEventListener('change', () => { plan.extras = [...root.querySelectorAll('.f-extras input:checked')].map(e => e.value); edit(); });
  async function launchPreview(mode, inputPlan, button) {
    if (previewing) return;
    const previewPlan = structuredClone(inputPlan);
    if (!previewPlan.artistIds.length) {
      if (mode === 'quick') previewPlan.artistIds = [...data.presets[0].artistIds];
      else if (mode === 'fireworks') previewPlan.artistIds = [data.artists.find(a => !a.archived).id];
      else { message('가수를 먼저 고르거나 빠르게 보기로 예시 축제를 체험해 보세요.'); revealPlan(); return; }
    }
    previewing = true; button.disabled = true;
    try {
      const { openFestivalPreview } = await import('./player.js');
      await openFestivalPreview(previewPlan, data, button.isConnected ? button : root.querySelector('[data-action="preview"]'), { mode });
    } catch (error) { message(`미리보기를 열지 못했습니다. ${error.message}`); root.querySelector('#f-message').scrollIntoView({ block: 'center' }); }
    finally { previewing = false; if (button.isConnected) button.disabled = false; }
  }
  root.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.filter) { filter = button.dataset.filter; render(); return; }
    if (button.dataset.preset !== undefined) {
      if (!await acceptDiscard('예시 불러오기')) return;
      const preset = data.presets[Number(button.dataset.preset)];
      plan = { ...createPlan(data), name: preset.name, artistIds: [...preset.artistIds], venueId: preset.venueId, budget: preset.budget };
      filter = 'all'; syncForm(); edit(); message('차트 참고 예시를 불러왔습니다. 자유롭게 바꾸고 저장해 보세요.'); revealPlan(); return;
    }
    const id = button.dataset.artist;
    if (id) {
      if (plan.artistIds.includes(id)) plan.artistIds = plan.artistIds.filter(a => a !== id);
      else if (plan.artistIds.length === 3) { message('한 무대에는 최대 3팀까지 함께할 수 있어요. 먼저 한 팀을 해제해 주세요.'); return; }
      else plan.artistIds.push(id);
      edit(); return;
    }
    if (button.dataset.move) {
      const index = plan.artistIds.indexOf(button.dataset.id), target = index + Number(button.dataset.move);
      if (index >= 0 && target >= 0 && target < plan.artistIds.length) { [plan.artistIds[index], plan.artistIds[target]] = [plan.artistIds[target], plan.artistIds[index]]; edit(); root.querySelector(`[data-id="${button.dataset.id}"][data-move="${button.dataset.move}"]`)?.focus(); }
      return;
    }
    if (button.dataset.remove) { plan.artistIds = plan.artistIds.filter(id => id !== button.dataset.remove); edit(); return; }
    const action = button.dataset.action;
    if (action === 'new' && await acceptDiscard('새 기획안 만들기')) { plan = createPlan(data); dirty = false; syncForm(); render(); message('새로운 축제를 만들어 보세요.'); }
    if (action === 'save') {
      if (!root.querySelector('#f-budget').reportValidity() || !root.querySelector('#f-budget').value) return;
      plan.name = plan.name.trim();
      if (!validatePlan(plan, data)) { message('기획안 이름과 예산을 확인해 주세요.'); return; }
      if (savingBlocked) { message('기존 저장 데이터를 읽지 못해 덮어쓰기를 중단했습니다. 브라우저 저장소 접근과 기존 데이터를 확인해 주세요.'); return; }
      const updated = { ...structuredClone(plan), updatedAt: new Date().toISOString(), estimatedCost: totalCost(plan, data) };
      const next = [...saved.filter(p => p.id !== plan.id), updated];
      try { writePlans(next, data); saved = next; plan = structuredClone(updated); dirty = false; syncForm(); render(); message('기획안을 이 브라우저에 저장했습니다.'); }
      catch { message('저장하지 못했습니다. 브라우저 저장 공간 또는 저장 개수(최대 50개)를 확인해 주세요.'); }
    }
    if (action === 'load' || action === 'load-preview') {
      const found = saved.find(p => p.id === button.dataset.id);
      if (!found) { message('기획안을 찾지 못했습니다. 저장 목록을 다시 확인해 주세요.'); return; }
      if (!await acceptDiscard('저장한 기획안 불러오기')) return;
      plan = structuredClone(found); dirty = false; filter = 'all'; syncForm(); render();
      message(`“${plan.name}” 기획안을 불러왔습니다.`); revealPlan();
      if (action === 'load-preview') await launchPreview('show', plan, button);
    }
    if (action === 'delete') {
      if (!window.confirm('이 기획안을 삭제할까요?')) return;
      const next = saved.filter(p => p.id !== button.dataset.id);
      try { writePlans(next, data); saved = next; comparison.delete(button.dataset.id); if (plan.id === button.dataset.id) dirty = true; render(); message('저장한 기획안을 삭제했습니다.'); } catch { message('삭제 내용을 저장하지 못했습니다.'); }
    }
    if (action === 'compare') renderComparison();
    if (action === 'preview' || action === 'quick-preview' || action === 'fireworks-preview') {
      await launchPreview(action === 'quick-preview' ? 'quick' : action === 'fireworks-preview' ? 'fireworks' : 'show', plan, button);
    }
  });
  root.querySelector('.f-saved').addEventListener('change', e => { if (!e.target.matches('input')) return; e.target.checked ? comparison.add(e.target.value) : comparison.delete(e.target.value); });
  function renderComparison() {
    const chosen = saved.filter(p => comparison.has(p.id));
    if (chosen.length < 2) { message('비교할 기획안을 두 개 이상 선택해 주세요.'); return; }
    root.querySelector('.f-comparison').innerHTML = `<div class="f-table-wrap"><table><caption>저장한 기획안 비교 · 비용과 반응은 게임용 예상</caption><thead><tr><th>기획안</th><th>공연 순서</th><th>장소</th><th>구성</th><th>총예산 / 예상 지출</th></tr></thead><tbody>${chosen.map(p => `<tr><th>${escape(p.name)}</th><td>${p.artistIds.map(id => escape(data.artists.find(a => a.id === id).name)).join(' → ') || '미정'}</td><td>${escape(data.venues.find(v => v.id === p.venueId).name)}</td><td>${p.extras.map(id => escape(data.extras.find(e => e.id === id).name)).concat((p.fireworks || []).map(id => `폭죽: ${FIREWORK_MOMENTS.find(m => m.id === id).label}`)).join(', ') || '기본 무대'} · 폭죽 위치: ${FIREWORK_SITES.find(site => site.id === (p.fireworkPosition || 'stage-back')).name}</td><td>${won(p.budget)} / ${won(totalCost(p, data))}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function render() {
    root.querySelectorAll('.f-fireworks input').forEach(input => { input.checked = (plan.fireworks || []).includes(input.value); input.disabled = !availableFireworks(plan).some(m => m.id === input.value); });
    root.querySelector('.f-venue-note').textContent = data.venues.find(v => v.id === plan.venueId).description || '이전 버전에서 저장한 예시 장소입니다. 대운동장 또는 초록 B 위치로 변경할 수 있습니다.';
    root.querySelectorAll('.f-location-map [data-venue]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.venue === plan.venueId)));
    root.querySelector('.f-selected-count').textContent = `${plan.artistIds.length} / 3 TEAMS`;
    root.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === filter)));
    root.querySelector('.f-candidates').innerHTML = data.artists.filter(a => !a.archived && (filter === 'all' || a.genre === filter)).map(a => {
      const selected = plan.artistIds.includes(a.id);
      return `<button class="f-artist ${selected ? 'selected' : ''}" data-artist="${a.id}" aria-pressed="${selected}"><span class="f-art" style="--a:${a.colors[0]};--b:${a.colors[1]}"><span>${escape(a.initial)}</span><small>${escape(a.label)}</small><b>${selected ? '✓' : '＋'}</b></span><span class="f-artist-info"><strong>${escape(a.name)}</strong><small>${escape(a.mood)}</small><small class="f-chart-song">제공 차트 ${a.sourceRank}위 곡 · ${escape(a.sourceSong)}</small><span>게임용 섭외비 ${won(a.cost)}</span></span></button>`;
    }).join('');
    root.querySelector('.f-poster-name').textContent = plan.name || '이름 없는 우리의 축제';
    root.querySelector('.f-lineup').innerHTML = plan.artistIds.length ? plan.artistIds.map((id, i) => {
      const a = data.artists.find(a => a.id === id);
      return `<li><time>${data.slots[i]}</time><div><strong>${escape(a.name)}</strong><small>${escape(a.label)}</small></div><span><button data-id="${id}" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="${escape(a.name)} 순서 앞으로">↑</button><button data-id="${id}" data-move="1" ${i === plan.artistIds.length - 1 ? 'disabled' : ''} aria-label="${escape(a.name)} 순서 뒤로">↓</button><button data-remove="${id}" aria-label="${escape(a.name)} 라인업에서 제외">×</button></span></li>`;
    }).join('') : '<li class="f-empty">아직 비어 있는 무대.<br>첫 번째 목소리를 골라 주세요.</li>';
    const cost = totalCost(plan, data), remaining = plan.budget - cost;
    root.querySelector('.f-cost').innerHTML = `<span>예상 지출 <b>${won(cost)}</b></span><span class="${remaining < 0 ? 'over' : ''}">${remaining < 0 ? '예산 초과' : '남은 예산'} <b>${won(Math.abs(remaining))}</b></span><small>미리보기는 예산을 사용하지 않아요.</small>`;
    root.querySelector('.f-reaction').textContent = `“${expectedReaction(plan, data)}” — 게임용 예상 반응`;
    root.querySelector('.f-saved').innerHTML = saved.length ? saved.map(p => `<article><label><input type="checkbox" value="${escape(p.id)}" ${comparison.has(p.id) ? 'checked' : ''}> 비교</label><div><strong>${escape(p.name)}</strong><small>${p.artistIds.length}팀 · ${won(totalCost(p, data))} · ${escape(data.venues.find(v => v.id === p.venueId).name)}</small></div><button data-action="load" data-id="${escape(p.id)}">불러오기</button><button data-action="load-preview" data-id="${escape(p.id)}">불러오고 미리보기</button><button data-action="delete" data-id="${escape(p.id)}">삭제</button></article>`).join('') : '<p class="f-empty">마음에 드는 라인업을 저장하면 여기에 모여요.</p>';
    root.querySelector('.f-comparison').innerHTML = '';
  }
  syncForm(); render();
}
