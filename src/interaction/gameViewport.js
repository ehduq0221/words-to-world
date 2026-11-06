// 로컬 미리보기와 공유 사이트에 동일한 데스크톱 화면 구성을 적용합니다.
const screen = document.createElement('div');
screen.className = 'game-screen';
for (const element of [...document.body.children]) {
  if (element.tagName !== 'SCRIPT') screen.append(element);
}
document.body.append(screen);
function resizeScreen() {
  const width = Math.max(1280, window.innerWidth);
  const scale = window.innerWidth / width;
  const height = Math.max(1120, window.innerHeight / scale);
  screen.style.width = width + 'px';
  screen.style.height = height + 'px';
  screen.style.transform = 'scale(' + scale + ')';
  document.body.style.height = height * scale + 'px';
}
resizeScreen();
window.addEventListener('resize', resizeScreen);
