// 실제 일몰 시각을 계산하는 것이 아닌, 게임 공연 시간용 배경 연출입니다.
export function getPerformanceEnvironment(time = '17:00') {
  const hour = Number(String(time).split(':')[0]);
  if (!Number.isFinite(hour)) throw new Error('공연 시간을 확인해 주세요.');
  if (hour < 18) return { phase: 'sunset', label: '노을 지는 캠퍼스', sky: '#d59179', ground: 0x9e8972, ambient: 2.1, light: 0.8 };
  if (hour < 20) return { phase: 'twilight', label: '보랏빛 저녁', sky: '#4d426d', ground: 0x5c5268, ambient: 1.6, light: 1.1 };
  return { phase: 'night', label: '별빛 아래 축제', sky: '#0c142e', ground: 0x303a50, ambient: 1.1, light: 1.4 };
}
