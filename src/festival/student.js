// 캐릭터 기능이 저장한 공개 프로필 스냅샷을 읽기만 합니다.
// 다른 기능의 코드를 import하거나 프로필을 수정하지 않습니다.
const looks = [
  ['#352c29', '#283d58', '#f0d0ae'], ['#8d633b', '#496e60', '#f0d0ae'],
  ['#d0b47b', '#647baa', '#f5d9bc'], ['#20282f', '#8b617b', '#c58c66'],
  ['#413331', '#967853', '#e5b896'], ['#aea69b', '#4b536b', '#f0d0ae'],
  ['#9c4d2c', '#6b8060', '#f5d9bc'], ['#262229', '#8e5555', '#865d48'],
];
export function getSelectedStudent(storage = localStorage) {
  let saved;
  try { saved = JSON.parse(storage.getItem('words-to-world-character')); } catch { /* 체험용 표시로 대체 */ }
  const selected = Boolean(saved && typeof saved.name === 'string' && saved.name.trim() && typeof saved.department === 'string');
  const index = Number.isInteger(saved?.avatar) && saved.avatar >= 0 && saved.avatar < 16 ? saved.avatar : 0;
  const female = saved?.gender === '여성' || (!['여성', '남성'].includes(saved?.gender) && index >= 8);
  const [hair, jacket, skin] = looks[index % 8];
  return { selected, name: selected ? saved.name.slice(0, 60) : '체험용 학생', department: selected ? saved.department.slice(0, 100) : '학생을 선택하면 내 캐릭터로 입장해요',
    avatar: index % 8 + (female ? 8 : 0), gender: female ? 'female' : 'male', hair, jacket, skin,
    hairstyle: female ? index % 2 ? 'bob' : 'long' : 'short' };
}
export function studentPortrait(student) {
  // 선택 팔레트를 유지하는 축제용 초상. 3D 모델과 재킷·머리·피부색을 공유합니다.
  const long = student.hairstyle !== 'short';
  return `<svg viewBox="0 0 64 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="64" height="76" rx="16" fill="#dce9df"/>
    <path fill="${student.hair}" d="M13 29C11 2 53 0 52 30L${long ? '55 54H9' : '50 36H14'}Z"/>
    <path fill="${student.jacket}" d="M6 76V61Q7 48 24 48h16q17 0 18 13v15Z"/>
    <path fill="#f4f2e3" d="m25 50 7 7 7-7-2 26H27Z"/>
    <path fill="${student.skin}" d="M26 41h12v12q-6 9-12 0Z"/>
    <ellipse cx="32" cy="29" rx="17" ry="20" fill="${student.skin}"/>
    <path fill="${student.hair}" d="M15 29Q8 5 31 7q24-3 20 22-7-2-11-13-6 12-23 9Z"/>
    <g fill="#26333c"><ellipse cx="25" cy="30" rx="2" ry="2.6"/><ellipse cx="39" cy="30" rx="2" ry="2.6"/></g>
    <g fill="#fff"><circle cx="25.5" cy="29.2" r=".8"/><circle cx="39.5" cy="29.2" r=".8"/></g>
    <g fill="#d89485" opacity=".6"><ellipse cx="22" cy="36" rx="3.3" ry="1.6"/><ellipse cx="42" cy="36" rx="3.3" ry="1.6"/></g>
    <path d="M28 39q4 4 8 0" fill="none" stroke="#965c57" stroke-width="1.5" stroke-linecap="round"/>
    <path d="m23 51-5 7 9 5m14-12 5 7-9 5" fill="none" stroke="#fff" opacity=".5"/>
    <circle cx="18" cy="65" r="3" fill="#e7eddb"/>
  </svg>`;
}
