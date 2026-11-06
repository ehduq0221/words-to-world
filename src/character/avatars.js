import { baseFemaleAvatar } from './baseAvatar.js?v=3';

const palettes = [
 {hair:'#352c29',accent:'#55413a',jacket:'#283d58',skin:'#f0d0ae'},
 {hair:'#8d633b',accent:'#b48b5b',jacket:'#496e60',skin:'#f0d0ae'},
 {hair:'#d0b47b',accent:'#e3ce9f',jacket:'#647baa',skin:'#f5d9bc'},
 {hair:'#20282f',accent:'#414950',jacket:'#8b617b',skin:'#c58c66'},
 {hair:'#413331',accent:'#66453e',jacket:'#967853',skin:'#e5b896'},
 {hair:'#aea69b',accent:'#d0c6b7',jacket:'#4b536b',skin:'#f0d0ae'},
 {hair:'#9c4d2c',accent:'#c77947',jacket:'#6b8060',skin:'#f5d9bc'},
 {hair:'#262229',accent:'#493e4d',jacket:'#8e5555',skin:'#865d48'},
];
export const variants = [
 ...palettes.map(look => ({ ...look, gender: '남성' })),
 ...palettes.map((look, index) => ({ ...look, gender: '여성', hairstyle: index % 2 ? 'bob' : 'long' })),
];

export function resolveAvatarIndex(index, gender) {
 const valid = Number.isInteger(index) && variants[index] ? index : 0;
 if (gender === '여성') return valid % palettes.length + palettes.length;
 if (gender === '남성') return valid % palettes.length;
 return valid;
}

export function renderAvatar(baseSvg, index) {
 const look = variants[index] || variants[0];
 let svg = look.gender === '여성' ? baseFemaleAvatar : baseSvg;
 if (look.hairstyle === 'bob') svg = svg.replace('M21 15h38v5h5v44h-5v7H18v-7h-4V25h4v-6h3z', 'M21 15h38v5h5v27h-5v7H18v-7h-4V25h4v-6h3z').replace('M18 29h5v33h-4v-6h-1zm39-7h4v38h-4z', 'M18 29h5v17h-4v-6h-1zm39-7h4v24h-4z');
 return svg.replaceAll('#352c29',look.hair).replaceAll('#55413a',look.accent).replaceAll('#283d58',look.jacket).replaceAll('#f0d0ae',look.skin);
}
