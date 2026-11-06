import { createFestivalScene } from './scene.js';
import { createFestivalAudio } from './audio.js';

export async function openFestivalPreview(plan, data, opener) {
  const artists = plan.artistIds.map(id => data.artists.find(a => a.id === id));
  if (!artists.length) throw new Error('미리 볼 가수를 먼저 선택해 주세요.');
  const dialog = document.createElement('dialog'); dialog.className = 'festival-player';
  dialog.setAttribute('aria-label', '하루 축제 미리보기');
  dialog.innerHTML = `<div class="fp-scene"></div>
    <header class="fp-top"><div><small>ONE DAY, OUR CAMPUS</small><h2></h2><p></p></div><button data-action="close" aria-label="미리보기 종료">닫기 ×</button></header>
    <div class="fp-caption" aria-live="polite"></div>
    <footer class="fp-controls"><div class="fp-tracks"></div><div class="fp-progress"><span></span></div>
      <div class="fp-buttons"><button data-action="pause">일시정지</button><button data-action="restart">다시 보기</button><button data-action="sound" aria-pressed="false">소리 켜기</button><span>미리보기 · 게임 지표 변경 없음</span></div>
    </footer>`;
  document.body.append(dialog); dialog.showModal();
  const canvasHost = dialog.querySelector('.fp-scene');
  const caption = dialog.querySelector('.fp-caption');
  caption.textContent = '익숙한 캠퍼스에, 오늘만의 무대가 열립니다.';
  let scene, timer, disposed = false, paused = false, seconds = 0, sound = false, stage = -1;
  const audio = createFestivalAudio();
  const trackButtons = artists.map((artist, i) => {
    const button = document.createElement('button'); button.textContent = `${data.slots[i]} ${artist.name}`;
    button.addEventListener('click', () => { seconds = 4 + i * 16; render(); });
    dialog.querySelector('.fp-tracks').append(button); return button;
  });
  const length = 4 + artists.length * 16 + 5;
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
  dialog.querySelector('[data-action="restart"]').onclick = () => {
    seconds = 0; paused = false; stage = -1; scene?.setPlaying(true); audio.resume();
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
    const index = seconds < 4 ? -1 : Math.min(artists.length - 1, Math.floor((seconds - 4) / 16));
    const finale = seconds >= length - 8;
    if (index !== stage || stage === -1) {
      stage = index;
      const artist = artists[Math.max(0, index)];
      scene?.theme(artist.genre); scene?.configure(plan.extras); audio.setGenre(artist.genre);
      dialog.querySelector('h2').textContent = index < 0 ? plan.name : artist.name;
      dialog.querySelector('.fp-top p').textContent = `${data.venues.find(v => v.id === plan.venueId).name} · ${index < 0 ? '무대 준비 중' : `${data.slots[index]} / ${artist.label}`}`;
      caption.textContent = index < 0 ? '익숙한 캠퍼스에, 오늘만의 무대가 열립니다.' : artist.mood;
      trackButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
    }
    if (finale) caption.textContent = '오늘 이 순간, 오래 기억하자. 우리의 캠퍼스, 우리의 축제.';
    scene?.setFinale(finale && plan.extras.includes('confetti'));
    scene?.setPreparation(seconds / 4);
    dialog.querySelector('.fp-progress span').style.width = `${Math.min(100, seconds / length * 100)}%`;
    if (seconds >= length) close();
  }
  try {
    scene = await createFestivalScene(canvasHost, plan.venueId);
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
