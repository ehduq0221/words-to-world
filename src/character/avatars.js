export const variants = [
 {hair:'#352c29',accent:'#55413a',jacket:'#283d58',skin:'#f0d0ae'},
 {hair:'#8d633b',accent:'#b48b5b',jacket:'#496e60',skin:'#f0d0ae'},
 {hair:'#d0b47b',accent:'#e3ce9f',jacket:'#647baa',skin:'#f5d9bc'},
 {hair:'#20282f',accent:'#414950',jacket:'#8b617b',skin:'#c58c66'},
 {hair:'#413331',accent:'#66453e',jacket:'#967853',skin:'#e5b896'},
 {hair:'#aea69b',accent:'#d0c6b7',jacket:'#4b536b',skin:'#f0d0ae'},
 {hair:'#9c4d2c',accent:'#c77947',jacket:'#6b8060',skin:'#f5d9bc'},
 {hair:'#262229',accent:'#493e4d',jacket:'#8e5555',skin:'#865d48'},
];
export function renderAvatar(baseSvg, index) {
 const look = variants[index] || variants[0];
 return baseSvg.replaceAll('#352c29',look.hair).replaceAll('#55413a',look.accent).replaceAll('#283d58',look.jacket).replaceAll('#f0d0ae',look.skin);
}
