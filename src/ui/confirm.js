// 총장 결정 확인 창(공통 약속 「총장 결정」). 모든 기능이 함께 씁니다.
// 확인하면 true, 취소·Esc·바깥 클릭이면 false로 끝납니다.
// rows: [[항목, 지금, 결정 후]], notes: 아래에 덧붙일 안내 문장, columns: 표 머리글

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function confirmDecision({ title, rows = [], notes = [], columns = ['지금', '결정 후'], confirmLabel = '결정하기' }) {
  document.querySelector('.ui-confirm')?.dispatchEvent(new Event('cancel'));
  return new Promise(resolve => {
    const overlay = element('div', 'ui-confirm');
    const box = element('div', 'ui-confirm-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const heading = element('h3', '', title);
    heading.id = 'ui-confirm-title';
    box.setAttribute('aria-labelledby', heading.id);
    box.append(heading);
    if (rows.length) {
      const table = element('table', 'ui-confirm-table');
      const head = element('tr');
      head.append(element('th', '', ''), element('th', '', columns[0]), element('th', '', columns[1]));
      table.append(head);
      for (const [label, before, after] of rows) {
        const line = element('tr', before === after ? '' : 'changed');
        line.append(element('th', '', label), element('td', '', before), element('td', '', after));
        table.append(line);
      }
      box.append(table);
    }
    for (const note of notes) box.append(element('p', 'ui-confirm-note', note));
    const buttons = element('div', 'ui-confirm-buttons');
    const cancel = element('button', 'ui-confirm-cancel', '취소');
    const ok = element('button', 'ui-confirm-ok', confirmLabel);
    buttons.append(cancel, ok);
    box.append(buttons);
    overlay.append(box);

    const previousFocus = document.activeElement;
    const close = result => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      previousFocus?.focus?.();
      resolve(result);
    };
    const onKey = event => {
      if (event.key === 'Escape') close(false);
    };
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    overlay.addEventListener('click', event => {
      if (event.target === overlay) close(false);
    });
    overlay.addEventListener('cancel', () => close(false));
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    ok.focus();
  });
}
