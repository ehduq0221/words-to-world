// 기획안은 게임 저장·선호도 제출과 구분합니다. 네트워크 전송 없음.
export const PLAN_KEY = 'words-to-world:festival-plans:v1';
export function createPlan(data) {
  return { id: crypto.randomUUID(), name: '우리의 첫 번째 축제', venueId: data.venues[0].id,
    budget: 50000000, artistIds: [], extras: ['booths', 'lights', 'confetti'], updatedAt: null };
}
export function validatePlan(plan, data) {
  return plan && typeof plan.id === 'string' && plan.id.length <= 100 &&
    typeof plan.name === 'string' && plan.name.trim().length > 0 && plan.name.length <= 60 &&
    Number.isSafeInteger(plan.budget) && plan.budget >= 0 && plan.budget <= 1e12 &&
    data.venues.some(v => v.id === plan.venueId) &&
    Array.isArray(plan.artistIds) && plan.artistIds.length <= 3 && new Set(plan.artistIds).size === plan.artistIds.length &&
    plan.artistIds.every(id => data.artists.some(a => a.id === id)) &&
    Array.isArray(plan.extras) && new Set(plan.extras).size === plan.extras.length &&
    plan.extras.every(id => data.extras.some(e => e.id === id));
}
export function totalCost(plan, data) {
  return data.venues.find(v => v.id === plan.venueId).baseCost +
    data.artists.filter(a => plan.artistIds.includes(a.id)).reduce((sum, a) => sum + a.cost, 0) +
    data.extras.filter(e => plan.extras.includes(e.id)).reduce((sum, e) => sum + e.cost, 0);
}
export function readPlans(data, storage = localStorage) {
  const raw = storage.getItem(PLAN_KEY);
  if (!raw) return [];
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || !Array.isArray(saved.plans) || saved.plans.length > 50 ||
      !saved.plans.every(p => validatePlan(p, data)) || new Set(saved.plans.map(p => p.id)).size !== saved.plans.length) {
    throw new Error('저장 형식을 확인할 수 없습니다. 기존 데이터는 덮어쓰지 않았습니다.');
  }
  return saved.plans;
}
export function writePlans(plans, data, storage = localStorage) {
  if (plans.length > 50 || !plans.every(p => validatePlan(p, data))) throw new Error('저장할 기획안을 확인해 주세요. 최대 50개입니다.');
  storage.setItem(PLAN_KEY, JSON.stringify({ version: 1, plans }));
}
export function expectedReaction(plan, data) {
  const genres = new Set(plan.artistIds.map(id => data.artists.find(a => a.id === id).genre));
  if (!genres.size) return '어떤 무대에서 우리의 첫 축제를 시작할까요?';
  if (genres.size === 3) return '노을부터 밤까지, 우리 취향이 전부 모였네!';
  if (genres.has('idol')) return '응원봉 챙겼어? 오늘 마지막 곡까지 같이 부르자!';
  if (genres.has('hiphop')) return '수업 끝나면 바로 무대로 와. 오늘은 같이 뛰자!';
  return '이 노래 들으면서 캠퍼스에 있으면, 오래 기억날 것 같아.';
}
