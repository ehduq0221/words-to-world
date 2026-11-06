// 가수별 창작 무대 프로필입니다. 실제 공연·안무·음원을 재현하지 않습니다.
const profiles = {
  ive: { title: 'ROYAL STARLIGHT', colors: ['#bca2ff', '#ffe59b'], sky: '#15112e', design: 'crown', formation: 'line', tempo: 118, notes: [523, 659, 784, 988, 880, 784, 659, 784], dance: 'sweep' },
  rescene: { title: 'BLOOMING CAMPUS', colors: ['#7ce2ce', '#ffb4cf'], sky: '#122d33', design: 'bloom', formation: 'arc', tempo: 106, notes: [392, 494, 587, 740, 659, 587, 494, 440], dance: 'wave' },
  illit: { title: 'DREAM IN PASTEL', colors: ['#ffc4e7', '#a9cbff'], sky: '#292441', design: 'bloom', formation: 'zigzag', tempo: 124, notes: [659, 784, 988, 784, 880, 659, 587, 784], dance: 'bounce' },
  aespa: { title: 'ELECTRIC CAMPUS', colors: ['#65c9ff', '#c9ff59'], sky: '#080f29', design: 'prism', formation: 'zigzag', tempo: 136, notes: [164, 330, 392, 311, 164, 466, 392, 330], dance: 'sharp' },
  nmixx: { title: 'BLUE WAVE LIVE', colors: ['#78efff', '#e694ff'], sky: '#101735', design: 'prism', formation: 'arc', tempo: 128, notes: [440, 659, 587, 880, 740, 659, 494, 587], dance: 'bounce' },
};
// 공개 아티스트 구성에 맞춘 성별 표현이며 헤어·의상은 게임용 창작입니다.
// 구성 인원 출처: https://aespa-official.jp/ , https://ive-official.jp/
const casts = {
  aespa: { gender: 'female', count: 4 }, ive: { gender: 'female', count: 6 },
  rescene: { gender: 'female' }, illit: { gender: 'female' }, nmixx: { gender: 'female' },
  hanroro: { gender: 'female', count: 1 }, day6: { gender: 'male' }, jannabi: { gender: 'male' },
  '10cm': { gender: 'male', count: 1 }, woodz: { gender: 'male', count: 1 },
  'big-naughty': { gender: 'male', count: 1 }, crush: { gender: 'male', count: 1 },
};
export function getArtistProfile(artist) {
  const base = profiles[artist.id];
  const cast = casts[artist.id] || { gender: 'unspecified' };
  if (base) return { ...base, cast, artistName: artist.name, genre: artist.genre };
  const seed = [...artist.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const indie = artist.genre === 'indie';
  return { cast, title: indie ? 'SUNSET LETTERS' : 'CAMPUS GROOVE', colors: artist.colors,
    sky: indie ? '#b47d71' : '#22132e', design: indie ? 'sunset' : 'prism', formation: indie ? 'band' : 'solo',
    tempo: (indie ? 85 : 104) + seed % 18, notes: [261, 330, 392, 494, 440, 392, 330, 294].map(n => n * (1 + (seed % 4) * .125)),
    dance: indie ? 'wave' : 'sharp', artistName: artist.name, genre: artist.genre };
}
export const FIREWORK_SITES = [
  { id: 'stage-back', name: '무대 뒤 하늘', x: 0, z: -65 },
  { id: 'left-sky', name: '무대 왼쪽 하늘', x: -105, z: -45 },
  { id: 'right-sky', name: '무대 오른쪽 하늘', x: 105, z: -45 },
  { id: 'campus-center', name: '캠퍼스 중앙 하늘', x: 0, z: 0 },
];
