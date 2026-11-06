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
  // 같은 선택의 헤어·피부·재킷 색을 사용하는 축제용 픽셀 초상화.
  return `<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="crispEdges">
    <path fill="${student.hair}" d="M7 4h18v${student.hairstyle === 'long' ? 22 : student.hairstyle === 'bob' ? 17 : 10}H7z"/>
    <path fill="${student.skin}" d="M9 9h14v12H9zM5 26h4v8H5zm18 0h4v8h-4z"/>
    <path fill="${student.hair}" d="M7 5h18v5h-4v-2h-6v3H9v3H7z"/>
    <path fill="#26333c" d="M12 13h2v2h-2zm7 0h2v2h-2zM10 34h5v8h-5zm8 0h5v8h-5z"/>
    <path fill="${student.jacket}" d="M8 23h16v13H8zM6 24h3v6H6zm17 0h3v6h-3z"/>
    <path fill="#f4f2e3" d="M14 23h5v11h-5z"/><path fill="#8ba88c" d="M16 25h2v7h-2z"/>
  </svg>`;
}
