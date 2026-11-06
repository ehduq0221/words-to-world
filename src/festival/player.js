import { createFestivalScene } from './scene.js';
import { createFestivalAudio } from './audio.js';
import { buildTimeline } from './timeline.js';

export async function openFestivalPreview(plan, data, opener) {
  const artists = plan.artistIds.map(id => data.artists.find(a => a.id === id));
  if (!artists.length) throw new Error('미리 볼 가수를 먼저 선택해 주세요.');
  const dialog = document.createElement('dialog'); dialog.className = 'festival-player';
  dialog.setAttribute('aria-label', '하루 축제 미리보기');
  dialog.innerHTML = `<div class="fp-scene"></div>
    <header class="fp-top"><div><small>ONE DAY, OUR CAMPUS</small><h2></h2><p></p></div><button data-action="close" aria-label="미리보기 종료">닫기 ×</button></header>
    <div class="fp-caption" aria-live="polite"></div>
    <footer class="fp-controls"><div class="fp-tracks"></div><div class="fp-progress"><span></span></div>
      <div class="fp-buttons"><button data-action="pause">일시정지</button><button data-action="restart">다시 보기</button><button data-action="overview" aria-pressed="false">지도에서 위치 보기</button><button data-action="sound" aria-pressed="false">소리 켜기</button><span>미리보기 · 게임 지표 변경 없음</span></div>
    </footer>`;
  document.body.append(dialog); dialog.showModal();
  const canvasHost = dialog.querySelector('.fp-scene');
  const caption = dialog.querySelector('.fp-caption');
  caption.textContent = '익숙한 캠퍼스에, 오늘만의 무대가 열립니다.';
  let scene, timer, disposed = false, paused = false, seconds = 0, sound = false, stage = -1;
  const audio = createFestivalAudio();
  const timeline = buildTimeline(artists.length);
  const fired = new Set();
  const trackButtons = artists.map((artist, i) => {
    const button = document.createElement('button'); button.textContent = `${data.slots[i]} ${artist.name}`;
    button.addEventListener('click', () => { seconds = timeline.segments.find(s => s.kind === 'performance' && s.index === i).start; fired.clear(); scene?.resetFireworks(); render(); });
    dialog.querySelector('.fp-tracks').append(button); return button;
  });
  const length = timeline.length;
  function close() {
    if (disposed) return;
    disposed = true; clearInterval(timer); scene?.dispose(); audio.dispose(); dialog.close(); dialog.remove(); opener?.focus();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.querySelector('[data-action="close"]').onclick = close;
  dialog.querySelector('[data-action="pause"]').onclick = event => {
    paused = !paused; scene?.setPlaying(!paused); paused ? audio.pause() : audio.resume();
    event.target.textContent = paused ? '재생' : '일시정지';
  };
  dialog.querySelector('[data-action="overview"]').onclick = event => {
    const enabled = event.target.getAttribute('aria-pressed') !== 'true';
    event.target.setAttribute('aria-pressed', String(enabled)); event.target.textContent = enabled ? '무대로 돌아가기' : '지도에서 위치 보기'; scene?.setOverview(enabled);
  };
  dialog.querySelector('[data-action="restart"]').onclick = () => {
    seconds = 0; paused = false; stage = -1; fired.clear(); scene?.resetFireworks(); scene?.setPlaying(true); audio.resume();
    dialog.querySelector('[data-action="pause"]').textContent = '일시정지'; render();
  };
  dialog.querySelector('[data-action="sound"]').onclick = async event => {
    const button = event.target;
    try {
      sound = !sound; await audio.enable(sound); if (paused) audio.pause();
      button.textContent = sound ? '소리 끄기' : '소리 켜기'; button.setAttribute('aria-pressed', String(sound));
    } catch { sound = false; caption.textContent = '배경음을 시작하지 못했습니다. 소리 없이도 미리 볼 수 있어요.'; }
  };
  function render() {
    if (disposed) return;
    const segment = timeline.segments.find(s => seconds >= s.start && seconds < s.end) || timeline.segments.at(-1);
    const index = segment.index, finale = segment.kind === 'finale';
    const key = `${segment.kind}:${index}`;
    if (key !== stage) {
      stage = key;
      const artist = artists[index];
      scene?.theme(artist.genre); scene?.configure(plan.extras); audio.setGenre(artist.genre);
      dialog.querySelector('h2').textContent = segment.kind === 'setup' ? plan.name : segment.kind === 'intermission' ? '다음 설렘을 기다리며' : artist.name;
      dialog.querySelector('.fp-top p').textContent = `${data.venues.find(v => v.id === plan.venueId).name} · ${segment.kind === 'setup' ? '무대 준비 중' : segment.kind === 'intermission' ? `${index + 1}팀 → ${index + 2}팀 / 무대 전환` : `${data.slots[index]} / ${artist.label}`}`;
      caption.textContent = segment.kind === 'setup' ? '익숙한 캠퍼스에, 오늘만의 무대가 열립니다.' : segment.kind === 'intermission' ? '잠깐의 두근거림, 다음 무대가 곧 시작됩니다.' : artist.mood;
      trackButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index && segment.kind === 'performance')));
    }
    if (finale) caption.textContent = '오늘 이 순간, 오래 기억하자. 우리의 캠퍼스, 우리의 축제.';
    for (const moment of plan.fireworks || []) {
      const at = timeline.fireworkTimes[moment];
      if (!paused && at !== undefined && seconds >= at && seconds < at + 1 && !fired.has(moment)) {
        fired.add(moment); scene?.burstFireworks(); audio.firework();
      }
    }
    scene?.setFinale(finale && plan.extras.includes('confetti'));
    scene?.setPreparation(seconds / 4);
    dialog.querySelector('.fp-progress span').style.width = `${Math.min(100, seconds / length * 100)}%`;
    if (seconds >= length) close();
  }
  try {
    scene = await createFestivalScene(canvasHost, data.venues.find(v => v.id === plan.venueId));
    if (disposed) { scene.dispose(); return; }
    scene.setPlaying(!paused); scene.configure(plan.extras); render();
    let previous = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      if (!paused && !document.hidden) seconds += Math.min((now - previous) / 1000, .3);
      previous = now; render();
    }, 100);
  } catch (error) {
    if (disposed) return;
    caption.textContent = '3D 미리보기를 열지 못했습니다. WebGL 지원과 캠퍼스 데이터 연결을 확인해 주세요. 닫기를 누르면 기획안으로 돌아갑니다.';
    console.error(error);
  }
}
