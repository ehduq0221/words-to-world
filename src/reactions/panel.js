// 오른쪽 「학생들의 목소리」 패널(#reaction-list, #reaction-count)에 최근 반응을 그립니다.
// 기존 style.css의 .reactions article 모양을 그대로 씁니다.

let renderedKey = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function article(reaction) {
  const card = element('article', reaction.kind === 'resolved' ? 'reaction-resolved' : '');
  const student = element('div', 'student');
  const info = element('div');
  info.append(element('b', '', reaction.who), element('small', '', `${reaction.year}학년${reaction.cause ? ` · ${reaction.cause}` : ''}`));
  student.append(element('span', reaction.kind === 'resolved' ? 'avatar sage' : 'avatar', reaction.avatar), info);
  if (reaction.priority) student.append(element('span', 'priority', reaction.priority));
  card.append(student, element('p', '', `“${reaction.text ?? '…'}”`));
  if (reaction.date) card.append(element('span', 'tag', `${reaction.date.month}월 ${reaction.date.day}일`));
  return card;
}

export function renderReactionPanel(area, config) {
  if (typeof document === 'undefined') return;
  const list = document.querySelector('#reaction-list');
  const count = document.querySelector('#reaction-count');
  if (!list) return;
  const active = Object.keys(area.issues).length;
  const key = `${area.seq}:${active}`;
  if (key === renderedKey && list.childElementCount) return;
  renderedKey = key;
  if (count) {
    count.textContent = String(active);
    count.title = `해결되지 않은 민원 ${active}건`;
  }
  const recent = area.feed.slice(-config.panelSize).reverse();
  if (!recent.length) {
    list.replaceChildren(element('p', 'reaction-empty', '아직 들어온 이야기가 없습니다.'));
    return;
  }
  list.replaceChildren(...recent.map(article));
}
