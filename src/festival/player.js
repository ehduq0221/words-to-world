import { getPerformanceEnvironment } from './environment.js';
import { getSelectedStudent, studentPortrait } from './student.js';
import { judgeLightstick } from './participation.js';
import { createFestivalScene } from './scene.js';
import { createFestivalAudio } from './audio.js';
import { buildTimeline } from './timeline.js';
import { FIREWORK_SITES, getArtistProfile } from './profiles.js';

export async function openFestivalPreview(plan, data, opener, options = {}) {
  const artists = plan.artistIds.map(id => data.artists.find(a => a.id === id)).filter(Boolean);
  if (!artists.length) throw new Error('미리 볼 가수를 먼저 선택해 주세요.');
  let student = getSelectedStudent();
  const venue = data.venues.find(v => v.id === plan.venueId);
  if (!venue) throw new Error('축제 장소를 다시 선택해 주세요.');
  const fireworksOnly = options.mode === 'fireworks', quick = options.mode === 'quick';
  const dialog = document.createElement('dialog'); dialog.className = 'festival-player';
  dialog.setAttribute('aria-label', fireworksOnly ? '폭죽 미리보기' : '하루 축제 체험');
  dialog.innerHTML = `<div class="fp-scene"></div>
    <header class="fp-top"><div><small>ONE DAY, OUR CAMPUS</small><h2></h2><p></p><div class="fp-student"><span class="fp-student-portrait"></span><span><b></b><small></small></span><a href="../../character-create.html" target="_blank" rel="noopener">학생 선택</a></div><span class="fp-profile"></span><time class="fp-time"></time></div><button data-action="close" aria-label="미리보기 종료">닫기 ×</button></header>
    <div class="fp-loading" role="status">캠퍼스에 무대를 설치하고 있어요…</div>
    <div class="fp-my-stick" aria-hidden="true"><span></span></div><div class="fp-caption" aria-live="polite"></div><div class="fp-cheer" aria-live="polite"></div>
    <footer class="fp-controls"><div class="fp-tracks"></div><div class="fp-progress"><span></span></div>
      <nav class="fp-view-modes" aria-label="축제 체험 시점"><button data-view="outside">밖에서 보기</button><button data-view="inside">관객 속으로 입장</button><button data-view="map">캠퍼스 전체</button></nav>
      <div class="fp-participate"><span>직접 즐기기</span><button data-action="cheer">🙌 환호하기 · Space</button><button data-action="lightstick" aria-pressed="false">✦ 응원봉 흔들기 · L</button><button data-action="photo">📷 공연 사진 저장 · P</button><button data-move="-5,0" aria-label="관객석 왼쪽 이동">←</button><button data-move="0,-5" aria-label="무대 쪽으로 이동">앞으로</button><button data-move="0,5" aria-label="무대에서 뒤로 이동">뒤로</button><button data-move="5,0" aria-label="관객석 오른쪽 이동">→</button></div>
      <div class="fp-rhythm"><button data-action="rhythm">✦ 박자에 맞춰 응원봉 흔들기 · F</button><div class="fp-beat-track" aria-hidden="true"><i></i><b></b></div><span class="fp-beat-result" aria-live="polite">반짝이는 구간에서 천천히 흔들어요</span><div class="fp-stick-colors" aria-label="응원봉 색상"></div></div><div class="fp-pyro-controls"><label>폭죽 위치 <select aria-label="미리보기 폭죽 위치"></select></label><button data-action="fireworks">🎆 지금 폭죽 미리보기</button><small>폭죽이 터질 때 하늘이 잘 보이는 시점으로 잠시 이동해요.</small></div>
      <div class="fp-buttons"><button data-action="pause">일시정지</button><button data-action="restart">다시 보기</button><button data-action="sound" aria-pressed="false">소리 켜기</button><span>${fireworksOnly ? '폭죽 전용 · 종료할 때까지 체험 가능' : quick ? '빠른 보기 · 2배속' : '미리보기 · 게임 지표 변경 없음'}</span></div>
    </footer>`;
  const tools = document.createElement('details'); tools.className = 'fp-extra-tools';
  const summary = document.createElement('summary'); summary.textContent = '이동 · 사진 · 폭죽 도구'; tools.append(summary);
  tools.append(dialog.querySelector('.fp-participate'), dialog.querySelector('.fp-pyro-controls'));
  dialog.querySelector('.fp-buttons').before(tools);
  document.body.append(dialog); dialog.showModal();
  function updateStudent() {
    student = getSelectedStudent();
    dialog.querySelector('.fp-student-portrait').innerHTML = studentPortrait(student);
    dialog.querySelector('.fp-student b').textContent = student.selected ? `${student.name} 학생으로 체험 중` : '선택된 학생 없음 · 체험용 학생';
    dialog.querySelector('.fp-student small').textContent = student.department;
    dialog.querySelector('[data-view="inside"]').textContent = student.selected ? '내 학생으로 입장' : '관객 체험 · 학생 미선택';
    if (scene) scene.setVisitor(student);
  }
  function studentChanged(event) { if (event.key === 'words-to-world-character') updateStudent(); }
  const host = dialog.querySelector('.fp-scene'), caption = dialog.querySelector('.fp-caption'), loading = dialog.querySelector('.fp-loading');
  const siteSelect = dialog.querySelector('select');
  FIREWORK_SITES.forEach(site => { const option = document.createElement('option'); option.value = site.id; option.textContent = site.name; siteSelect.append(option); });
  siteSelect.value = plan.fireworkPosition || 'stage-back';
  let burstUntil = 0, rhythmMs = 0, lastTick = performance.now(), lastTap = -1000, combo = 0, currentArtist = artists[0], waving = false;
  let scene, timer, cheerTimer, disposed = false, paused = false, seconds = quick || fireworksOnly ? 4 : 0, sound = false, stage = '', currentView = options.startView || 'outside';
  updateStudent(); window.addEventListener('storage', studentChanged);
  let finish;
  const completion = new Promise(resolve => { finish = resolve; });
  const audio = createFestivalAudio(), timeline = buildTimeline(artists.length), fired = new Set();
  const trackButtons = artists.map((artist, i) => {
    const button = document.createElement('button'); button.textContent = `${data.slots[i]} ${artist.name}`;
    button.onclick = () => { seconds = timeline.segments.find(s => s.kind === 'performance' && s.index === i).start; fired.clear(); Object.entries(timeline.fireworkTimes).forEach(([moment, at]) => { if (at < seconds - .5) fired.add(moment); }); scene.resetFireworks(); render(); };
    dialog.querySelector('.fp-tracks').append(button); return button;
  });
  function close() {
    if (disposed) return;
    disposed = true; window.removeEventListener('storage', studentChanged); clearInterval(timer); clearTimeout(cheerTimer); scene?.dispose(); audio.dispose(); dialog.close(); dialog.remove(); opener?.focus(); finish();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector('[data-action="close"]').onclick = close;
  function setView(mode) {
    if (mode === 'inside' && seconds < 4) { seconds = 4; scene?.setPreparation(1); }
    currentView = mode; scene?.setView(mode);
    dialog.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
    dialog.querySelector('.fp-participate').classList.toggle('is-inside', mode === 'inside');
    dialog.querySelector('.fp-my-stick').classList.toggle('visible', mode === 'inside' && waving);
  }
  function cheer() {
    scene?.cheer(); audio.cheer(); const text = dialog.querySelector('.fp-cheer');
    text.textContent = '와아아! 오늘 이 무대, 우리 함께!'; text.classList.remove('active'); void text.offsetWidth; text.classList.add('active');
    clearTimeout(cheerTimer); cheerTimer = setTimeout(() => { text.textContent = ''; }, 1700);
  }
  function burst() {
    if (!scene) return;
    if (paused) { paused = false; scene.setPlaying(true); audio.resume(); dialog.querySelector('[data-action="pause"]').textContent = '일시정지'; }
    burstUntil = performance.now() + 7300; scene.burstFireworks(); audio.firework(); caption.textContent = `🎆 ${FIREWORK_SITES.find(s => s.id === siteSelect.value).name}에서 펼쳐지는 불꽃`;
  }
  dialog.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => setView(button.dataset.view); });
  dialog.querySelectorAll('[data-move]').forEach(button => { button.onclick = () => { setView('inside'); scene.moveVisitor(...button.dataset.move.split(',').map(Number)); }; });
  dialog.addEventListener('keydown', event => {
    if (event.target.matches('input,select,textarea')) return;
    if (event.code === 'KeyL' && scene) { event.preventDefault(); wave(); return; }
    if (event.code === 'KeyF' && scene) { event.preventDefault(); tapBeat(); return; }
    if (event.code === 'KeyP' && scene) { event.preventDefault(); takePhoto(); return; }
    if (event.target.matches('button')) return;
    const moves = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] };
    if (moves[event.key] && scene) { event.preventDefault(); setView('inside'); scene.moveVisitor(...moves[event.key]); }
    if (event.code === 'Space' && scene) { event.preventDefault(); cheer(); }
  });
  function wave() {
    waving = !waving;
    const button = dialog.querySelector('[data-action="lightstick"]'); button.setAttribute('aria-pressed', String(waving));
    button.textContent = waving ? '✦ 응원봉 내리기 · L' : '✦ 응원봉 흔들기 · L';
    setView('inside'); if (waving) scene?.waveLightstick(dialog.style.getPropertyValue('--stick-color') || '#c6ff70');
  }
  function tapBeat() {
    if (!scene) return;
    if (paused) { dialog.querySelector('.fp-beat-result').textContent = '재생한 뒤 천천히 흔들어 보세요'; return; }
    if (rhythmMs - lastTap < 650) return;
    lastTap = rhythmMs;
    if (!waving) wave();
    const stick = dialog.querySelector('.fp-my-stick'); stick.classList.remove('beat-wave'); void stick.offsetWidth; stick.classList.add('beat-wave');
    scene.waveLightstick(dialog.style.getPropertyValue('--stick-color') || '#c6ff70');
    const result = judgeLightstick(rhythmMs + Math.max(0, performance.now() - lastTick), getArtistProfile(currentArtist).tempo);
    combo = result.rating === 'MISS' ? 0 : combo + 1;
    dialog.querySelector('.fp-beat-result').textContent = result.rating === 'MISS' ? '조금 기다렸다가 다시 흔들어요' : `${result.rating === 'PERFECT' ? '딱 맞았어요!' : '함께 흔들었어요!'} · 연속 ${combo}번`;
    if (result.rating !== 'MISS') { scene.cheer(); audio.cheer(); }
  }
  function takePhoto() {
    if (!scene) return;
    try {
      const link = document.createElement('a'); link.href = scene.capturePhoto(); link.download = `festival-${currentArtist.id}-${Date.now()}.png`;
      document.body.append(link); link.click(); link.remove(); caption.textContent = '오늘의 무대를 사진으로 간직했어요!';
    } catch { caption.textContent = '이 브라우저에서는 사진을 저장하지 못했습니다.'; }
  }
  ['#c6ff70', '#ffaddf', '#9addff', '#ffeaa0'].forEach((color, i) => {
    const button = document.createElement('button'); button.className = 'fp-stick-color'; button.style.background = color;
    button.setAttribute('aria-label', ['연두 응원봉', '분홍 응원봉', '파랑 응원봉', '노랑 응원봉'][i]); button.setAttribute('aria-pressed', String(i === 0));
    button.onclick = () => { dialog.style.setProperty('--stick-color', color); dialog.querySelectorAll('.fp-stick-color').forEach(b => b.setAttribute('aria-pressed', String(b === button))); if (!waving) wave(); };
    dialog.querySelector('.fp-stick-colors').append(button);
  });
  dialog.querySelector('[data-action="lightstick"]').onclick = wave;
  dialog.querySelector('[data-action="rhythm"]').onclick = tapBeat;
  dialog.querySelector('[data-action="photo"]').onclick = takePhoto;
  dialog.querySelector('[data-action="cheer"]').onclick = cheer;
  dialog.querySelector('[data-action="fireworks"]').onclick = burst;
  siteSelect.onchange = () => scene?.setFireworkPosition(siteSelect.value);
  dialog.querySelector('[data-action="pause"]').onclick = event => {
    paused = !paused; scene?.setPlaying(!paused); paused ? audio.pause() : audio.resume(); event.target.textContent = paused ? '재생' : '일시정지';
  };
  dialog.querySelector('[data-action="restart"]').onclick = () => {
    seconds = quick || fireworksOnly ? 4 : 0; paused = false; stage = ''; fired.clear(); scene.resetFireworks(); scene.setPlaying(true); audio.resume();
    dialog.querySelector('[data-action="pause"]').textContent = '일시정지'; setView(currentView); render(); if (fireworksOnly) burst();
  };
  dialog.querySelector('[data-action="sound"]').onclick = async event => {
    try { sound = !sound; await audio.enable(sound); if (paused) audio.pause(); event.target.textContent = sound ? '소리 끄기' : '소리 켜기'; event.target.setAttribute('aria-pressed', String(sound)); }
    catch { sound = false; caption.textContent = '소리를 시작하지 못했어요. 화면 체험은 계속할 수 있습니다.'; }
  };
  function render() {
    if (disposed || !scene) return;
    const segment = timeline.segments.find(s => seconds >= s.start && seconds < s.end) || timeline.segments.at(-1), index = segment.index;
    const key = `${segment.kind}:${index}`;
    if (key !== stage) {
      stage = key; currentArtist = artists[index]; dialog.style.setProperty('--stick-period', `${judgeLightstick(0, getArtistProfile(currentArtist).tempo).duration / 1000}s`); rhythmMs = 0; lastTap = -1000; combo = 0;
      const artist = artists[index], profile = getArtistProfile(artist);
      scene.setArtist(artist); scene.configure(plan.extras); audio.setArtist(artist);
      const showTime = fireworksOnly ? '21:00' : data.slots[index];
      scene.setPerformanceTime(showTime);
      dialog.querySelector('.fp-time').textContent = `${showTime} · ${getPerformanceEnvironment(showTime).label}`;
      dialog.dataset.time = showTime;
      dialog.querySelector('h2').textContent = fireworksOnly ? '우리 학교, 불꽃으로 물들다' : segment.kind === 'setup' ? plan.name : segment.kind === 'intermission' ? '다음 설렘을 기다리며' : artist.name;
      dialog.querySelector('.fp-top p').textContent = `${venue.name} · ${segment.kind === 'setup' ? '무대 준비 중' : `${data.slots[index]} / ${artist.label}`}`;
      dialog.querySelector('.fp-profile').textContent = `${profile.title} · 실제 공연과 다른 창작 연출`;
      caption.textContent = segment.kind === 'intermission' ? '잠깐의 두근거림, 다음 무대가 곧 시작됩니다.' : artist.mood;
      trackButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index && segment.kind === 'performance')));
      dialog.dataset.artist = artist.id;
    }
    if (segment.kind === 'finale') caption.textContent = '오늘 이 순간, 오래 기억하자. 우리의 캠퍼스, 우리의 축제.';
    if (!fireworksOnly) for (const moment of plan.fireworks || []) {
      const at = timeline.fireworkTimes[moment];
      if (!paused && at !== undefined && seconds >= at && !fired.has(moment)) { fired.add(moment); burst(); }
    }
    dialog.querySelector('.fp-beat-track b').style.left = `${judgeLightstick(rhythmMs, getArtistProfile(currentArtist).tempo).phase * 100}%`;
    dialog.querySelector('.fp-beat-track').classList.toggle('on-beat', Math.abs(judgeLightstick(rhythmMs, getArtistProfile(currentArtist).tempo).phase - .5) <= .29);
    scene.setFinale(segment.kind === 'finale' && plan.extras.includes('confetti'));
    scene.setPreparation(quick || fireworksOnly ? 1 : seconds / 4);
    dialog.querySelector('.fp-progress span').style.width = `${Math.min(100, seconds / timeline.length * 100)}%`;
    if (!fireworksOnly && seconds >= timeline.length && performance.now() >= burstUntil) close();
  }
  const controls = [...dialog.querySelectorAll('button,select')].filter(el => el.dataset.action !== 'close'); controls.forEach(el => { el.disabled = true; });
  try {
    scene = await createFestivalScene(host, venue);
    if (disposed) { scene.dispose(); return; }
    loading.remove(); controls.forEach(el => { el.disabled = false; });
    scene.setVisitor(student); scene.setFireworkPosition(siteSelect.value); scene.setPlaying(!paused); setView(currentView); render();
    dialog.focus();
    if (fireworksOnly) burst();
    let previous = performance.now(); lastTick = previous;
    timer = setInterval(() => {
      const now = performance.now();
      if (!paused && !document.hidden) rhythmMs += Math.min(now - previous, 300);
      lastTick = now; if (!paused && !document.hidden && !fireworksOnly) seconds += Math.min((now - previous) / 1000, .3) * (quick ? 2 : 1);
      previous = now; render();
    }, 50);
  } catch (error) {
    if (!disposed) { loading.setAttribute('role', 'alert'); loading.textContent = `미리보기를 열지 못했습니다: ${error.message}. 로컬 서버와 WebGL 지원을 확인해 주세요.`; }
  }
  return completion;
}
