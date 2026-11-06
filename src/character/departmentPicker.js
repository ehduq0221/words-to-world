function createPicker(host, { id, name, label, placeholder, onChange }, closeOtherMenus) {
  host.className = 'select-field';
  const labelElement = document.createElement('span');
  labelElement.id = id + '-label';
  labelElement.className = 'field-label';
  labelElement.textContent = label;
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.id = id;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'select-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', id + '-menu');
  toggle.setAttribute('aria-labelledby', id + '-label ' + id + '-value');
  const valueLabel = document.createElement('span');
  valueLabel.id = id + '-value';
  valueLabel.textContent = placeholder;
  const chevron = document.createElement('span');
  chevron.className = 'chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';
  toggle.append(valueLabel, chevron);
  const menu = document.createElement('div');
  menu.id = id + '-menu';
  menu.className = 'select-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-labelledby', labelElement.id);
  menu.hidden = true;
  host.append(labelElement, input, toggle, menu);
  let options = [];

  function close(returnFocus = false) {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (returnFocus) toggle.focus();
  }

  function open() {
    closeOtherMenus();
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    const selected = options.find(option => option.getAttribute('aria-selected') === 'true') || options[0];
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: 'nearest' });
  }

  function setItems(items) {
    close();
    input.value = '';
    valueLabel.textContent = placeholder;
    menu.replaceChildren();
    toggle.disabled = items.length === 0;
    options = items.map(item => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'department-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.tabIndex = -1;
      const title = document.createElement('span');
      title.textContent = item.name;
      option.append(title);
      if (item.alias) {
        const alias = document.createElement('small');
        alias.textContent = item.alias;
        option.append(alias);
      }
      option.addEventListener('click', () => {
        input.value = item.name;
        valueLabel.textContent = item.name;
        options.forEach(other => other.setAttribute('aria-selected', String(other === option)));
        close(true);
        onChange?.(item.name);
      });
      menu.append(option);
      return option;
    });
  }

  toggle.addEventListener('click', () => menu.hidden ? open() : close());
  toggle.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener('keydown', event => {
    const index = options.indexOf(document.activeElement);
    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = Math.min(index + 1, options.length - 1);
    if (event.key === 'ArrowUp') nextIndex = Math.max(index - 1, 0);
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = options.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      options[nextIndex].focus();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    }
    if (event.key === 'Tab') close();
  });
  document.addEventListener('pointerdown', event => {
    if (!host.contains(event.target)) close();
  });
  return { input, toggle, close, setItems };
}

export async function initDepartmentPicker() {
  const response = await fetch(new URL('../../public/data/character.json', import.meta.url));
  if (!response.ok) throw new Error('학과 목록을 불러올 수 없습니다.');
  const { groups } = await response.json();
  const pickers = [];
  function closeMenus() {
    pickers.forEach(picker => picker.close());
  }

  function createMajor(type, title) {
    const host = document.querySelector('[data-major="' + type + '"]');
    const collegeHost = document.createElement('div');
    const departmentHost = document.createElement('div');
    host.append(collegeHost, departmentHost);
    const prefix = type === 'main' ? '' : type;
    const departmentName = type === 'main' ? 'department' : prefix + 'Department';
    const collegeName = type === 'main' ? 'college' : prefix + 'College';
    const department = createPicker(departmentHost, {
      id: departmentName, name: departmentName, label: title + ' 학과·학부·전공',
      placeholder: '학과를 선택해 주세요',
    }, closeMenus);
    const college = createPicker(collegeHost, {
      id: collegeName, name: collegeName, label: title + ' 단과대학',
      placeholder: '단과대학을 선택해 주세요',
      onChange: name => department.setItems(groups.find(group => group.college === name).departments),
    }, closeMenus);
    pickers.push(college, department);
    college.setItems(groups.map(group => ({ name: group.college })));
    department.setItems([]);
    return { type, title, host, college, department, enabled: type === 'main' };
  }

  const majors = [createMajor('main', '주전공'), createMajor('double', '복수전공'), createMajor('minor', '부전공')];
  function updateOptional(major, inputName) {
    const enabled = document.querySelector('input[name="' + inputName + '"]').checked;
    major.enabled = enabled;
    major.host.hidden = !enabled;
    closeMenus();
    if (!enabled) {
      major.college.setItems(groups.map(group => ({ name: group.college })));
      major.department.setItems([]);
    }
    major.college.input.disabled = !enabled;
    major.department.input.disabled = !enabled;
  }
  for (const [type, inputName] of [['double', 'hasDouble'], ['minor', 'hasMinor']]) {
    const major = majors.find(item => item.type === type);
    document.querySelector('input[name="' + inputName + '"]').addEventListener('change', () => {
      updateOptional(major, inputName);
    });
    updateOptional(major, inputName);
  }
  document.querySelector('#back').addEventListener('click', closeMenus);
  return {
    validate() {
      const selected = new Set();
      for (const major of majors.filter(item => item.enabled)) {
        if (!major.college.input.value) return { message: major.title + ' 단과대학을 선택해 주세요.', target: major.college.toggle };
        const name = major.department.input.value;
        if (!name) return { message: major.title + ' 학과를 선택해 주세요.', target: major.department.toggle };
        if (selected.has(name)) return { message: '주전공·부전공·복수전공은 서로 다른 학과를 선택해 주세요.', target: major.department.toggle };
        selected.add(name);
      }
      return null;
    },
  };
}
