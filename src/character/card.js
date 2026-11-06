import { readCharacter } from './storage.js';
import { baseAvatar } from './baseAvatar.js?v=4';
import { renderAvatar, resolveAvatarIndex } from './avatars.js?v=4';

export function initCharacterMap() {
  const profile = readCharacter();
  if (!profile) {
    window.location.replace(new URL('../../character-create.html', import.meta.url));
    return false;
  }
  const card = document.querySelector('#character-card');
  card.innerHTML = `<div class="section-heading"><h2>내 캐릭터</h2><span>학생</span></div>
    <div class="character-profile"><div class="character-portrait"></div>
    <div class="character-identity"><strong></strong><span></span><small>송도캠퍼스</small></div></div>
    <details class="student-details"><summary>학생 정보</summary><dl></dl></details><a class="character-edit" href="./character-create.html">캐릭터 수정</a>`;
  card.querySelector('.character-portrait').innerHTML = renderAvatar(baseAvatar, resolveAvatarIndex(profile.avatar, profile.gender));
  card.querySelector('.character-identity strong').textContent = profile.name;
  card.querySelector('.character-identity span').textContent = profile.department;
  const fields = [['nationality', '국적'], ['city', '사는 도시'], ['gender', '성별'],
    ['doubleDepartment', '복수전공'], ['minorDepartment', '부전공']];
  for (const [key, label] of fields) {
    if (typeof profile[key] !== 'string' || !profile[key].trim()) continue;
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    value.textContent = profile[key];
    card.querySelector('dl').append(term, value);
  }
  card.hidden = false;
  document.documentElement.removeAttribute('data-character-pending');
  return true;
}
