import { variants, renderAvatar, resolveAvatarIndex } from './avatars.js?v=3';
import { baseAvatar } from './baseAvatar.js?v=3';
import { readCharacter } from './storage.js';
import { initDepartmentPicker } from './departmentPicker.js?v=3';

export async function initCharacter() {
  const baseSvg = baseAvatar;
  const existing = readCharacter();
  let step = 0;
  let selected = 0;
  let profile;
  const sections = ['appearance', 'information', 'confirmation'];
  const next = document.querySelector('#next');
  const error = document.querySelector('#error');
  const avatar = index => renderAvatar(baseSvg, index);

  function showError(message, target) {
    error.textContent = message;
    error.hidden = false;
    target?.focus();
    error.scrollIntoView({ block: 'nearest' });
  }

  function selectAvatar(index, syncGender = true) {
    selected = index;
    const gender = document.querySelector('input[name="gender"][value="' + variants[index].gender + '"]');
    if (syncGender && gender) gender.checked = true;
    document.querySelector('#selected-avatar').innerHTML = avatar(index);
    document.querySelectorAll('.avatar-option').forEach((button, optionIndex) => {
      button.setAttribute('aria-pressed', String(optionIndex === index));
    });
  }

  variants.forEach((look, index) => {
    const button = document.createElement('button');
    button.className = 'avatar-option';
    button.type = 'button';
    button.setAttribute('aria-label', look.gender + ' 외형 ' + (index % 8 + 1));
    button.innerHTML = avatar(index);
    button.addEventListener('click', () => selectAvatar(index));
    document.querySelector('#avatars').append(button);
  });
  selectAvatar(resolveAvatarIndex(existing?.avatar, existing?.gender));
  const majorSelection = await initDepartmentPicker(existing);
  if (existing) {
    for (const key of ['name', 'nationality', 'city']) {
      document.getElementById(key).value = existing[key];
    }
    for (const input of document.querySelectorAll('input[name="gender"]')) {
      input.checked = input.value === existing.gender;
    }
    document.querySelector('#subtitle').textContent = '내 캐릭터 정보를 수정해요';
  }

  document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.addEventListener('change', () => selectAvatar(resolveAvatarIndex(selected, input.value), false));
  });

  function showStep(value) {
    step = value;
    sections.forEach((id, index) => { document.getElementById(id).hidden = index !== step; });
    document.querySelectorAll('.steps span').forEach((element, index) => {
      element.classList.toggle('active', index <= step);
    });
    const titles = [
      existing ? '내 캐릭터의 모습을<br>수정해 주세요' : '내 캐릭터의 모습을<br>골라 주세요',
      existing ? '내 캐릭터 정보를<br>수정해 주세요' : '어떤 나로<br>시작할까요?',
      '나의 캐릭터를<br>확인해 주세요',
    ];
    document.querySelector('#title').innerHTML = titles[step];
    next.textContent = ['이 캐릭터로 할게요', '다음', existing ? '수정 내용 저장하기' : '이 캐릭터로 시작하기'][step];
    error.hidden = true;
    document.querySelector('#back').hidden = step === 0 && !existing;
    window.scrollTo(0, 0);
  }

  function showConfirmation() {
    const panel = document.querySelector('#confirmation');
    panel.innerHTML = '<div class="large-portrait">' + avatar(selected) + '</div><h2></h2><p></p><dl></dl>';
    panel.querySelector('h2').textContent = profile.name;
    panel.querySelector('p').textContent = profile.department + ' · 인천대학교';
    const fields = [
      ['college', '단과대학'],
      ['department', '주전공'],
      ['nationality', '국적'],
      ['city', '사는 도시'],
      ['gender', '성별'],
    ];
    for (const [key, label] of [['doubleDepartment', '복수전공'], ['minorDepartment', '부전공']]) {
      if (profile[key]) fields.push([key, label]);
    }
    for (const [key, label] of fields) {
      const term = document.createElement('dt');
      term.textContent = label;
      const value = document.createElement('dd');
      value.textContent = profile[key] || '선택 안 함';
      panel.querySelector('dl').append(term, value);
    }
    showStep(2);
  }

  document.querySelector('#back').addEventListener('click', () => {
    if (step > 0) showStep(step - 1);
    else if (existing) window.location.href = new URL('../../index.html', import.meta.url).href;
  });

  next.addEventListener('click', () => {
    if (step === 0) {
      showStep(1);
      return;
    }
    if (step === 1) {
      const form = document.querySelector('#information');
      if (!form.reportValidity()) return;
      const validation = majorSelection.validate();
      if (validation) {
        showError(validation.message, validation.target);
        return;
      }
      profile = Object.fromEntries(new FormData(form));
      for (const key of ['name', 'college', 'department', 'nationality', 'city']) {
        profile[key] = profile[key].trim();
        if (!profile[key]) {
          showError('빈 항목을 입력해 주세요.', document.getElementById(key));
          return;
        }
      }
      // 선택하지 않은 추가 전공은 저장값에도 남기지 않습니다.
      if (profile.hasMinor !== 'yes') {
        profile.minorCollege = null;
        profile.minorDepartment = null;
      }
      if (profile.hasDouble !== 'yes') {
        profile.doubleCollege = null;
        profile.doubleDepartment = null;
      }
      profile.avatar = selected;
      showConfirmation();
      return;
    }
    try {
      localStorage.setItem('words-to-world-character', JSON.stringify(profile));
    } catch {
      showError('캐릭터 정보를 저장할 수 없습니다. 브라우저 저장소 설정을 확인해 주세요.');
      return;
    }
    window.location.href = new URL('../../index.html', import.meta.url).href;
  });
  showStep(0);
  document.querySelector('#information').addEventListener('submit', event => {
    event.preventDefault();
    next.click();
  });
}
