import { initFestival } from './index.js';

initFestival().catch(error => {
  const root = document.querySelector('#festival');
  root.textContent = '축제 화면을 열지 못했습니다. 프로젝트 루트에서 로컬 서버를 실행한 뒤 다시 시도해 주세요.';
  root.setAttribute('role', 'alert');
  console.error(error);
});
