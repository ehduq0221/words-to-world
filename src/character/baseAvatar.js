// 80×104 픽셀 격자. 외곽선과 명암을 세분화한 캠퍼스 캐릭터입니다.
function createBaseAvatar(female) {
 const backHair = female
  ? '<path fill="#352c29" stroke="#242329" stroke-width="2" d="M21 15h38v5h5v44h-5v7H18v-7h-4V25h4v-6h3z"/><path fill="#55413a" d="M18 29h5v33h-4v-6h-1zm39-7h4v38h-4z"/>'
  : '';
 const frontHair = female
  ? '<path fill="#352c29" stroke="#242329" stroke-width="2" d="M17 32V21h4v-7h7v-4h23v3h8v5h5v14h-5v10h-4V28h-5v-4h-3v8h-5v-5h-4v5h-5v-5h-4v5h-5v11h-5V32z"/><path fill="#55413a" d="M24 19h7v-3h15v3H33v4h-9zm25-2h5v5h5v6h-4v-5h-6z"/><path fill="#6b5144" d="M28 17h9v2h-9z"/><path fill="#7b9a7d" stroke="#314b40" stroke-width="1" d="M57 30h7v4h-7z"/>'
  : '<path fill="#352c29" stroke="#242329" stroke-width="2" d="M15 33h-4v-8h4v-5h-3v-3h9v-6h8V7h7V4h7v5h9v3h9v5h6v6h4v5h-5v7h-6v7h-5V28h-5v5h-5v-9h-4v7h-5v-6h-4v9h-5v-6h-4v13h-5v-8z"/><path fill="#55413a" d="M20 21h8v-5h8v-4h7v5h-8v4h-7v4h-8zm26-6h7v5h7v5h-5v-3h-9zM17 28h6v5h-6z"/><path fill="#6b5144" d="M30 15h6v2h-6zm20 5h5v2h-5z"/>';
 const bottom = female
  ? '<path fill="#283d58" stroke="#222b36" stroke-width="2" d="M28 77h25l5 12H24z"/><path fill="#172a41" d="M29 80h3v8h-5zm10 0h3v8h-3zm11 0h3l3 8h-4z"/><path fill="#455064" stroke="#222b36" stroke-width="2" d="M28 90h10v9H27zm16 0h10l1 9H44z"/>'
  : '<path fill="#435064" stroke="#222b36" stroke-width="2" d="M27 79h27v20H44V86h-7v13H27z"/><path fill="#303b4d" d="M28 83h4v15h-4zm17 3h4v12h-4z"/><path fill="#617086" d="M34 84h2v10h-2zm16-1h2v12h-2z"/>';
 return `<svg viewBox="0 0 80 104" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
 <path fill="#34443b" opacity=".13" d="M20 100h40v3H20z"/>
 ${backHair}
 ${bottom}
 <path fill="#253035" stroke="#20262c" stroke-width="2" d="M25 97h13v5H22v-3h3zm19 0h12v2h3v3H44z"/>
 <path fill="#f1f1e9" d="M23 100h14v2H23zm22 0h13v2H45z"/>
 <path fill="#f0d0ae" stroke="#443730" stroke-width="2" d="M21 65h8v17h-8v-3h-2V68h2zm33 0h7v3h2v11h-2v3h-7z"/>
 <path fill="#e8bf99" d="M21 74h3v6h-3zm36 0h4v5h-4z"/>
 <path fill="#283d58" stroke="#222b36" stroke-width="2" d="M30 55h20v3h6v4h5v12h-8v9H27v-9h-8V62h5v-4h6z"/>
 <path fill="#172a41" d="M25 61h5v20h-3V71h-6v-7h4zm27 0h4v4h3v7h-6v9h-4z"/>
 <path fill="#60738a" d="M25 60h5v2h-5zm26 0h4v2h-4z"/>
 <path fill="#ecf0e4" d="M34 58h13v23H34z"/>
 <path fill="#d6dfd4" d="M34 65h3v15h-3zm8 5h4v10h-4z"/>
 <path fill="#f0d0ae" stroke="#443730" stroke-width="2" d="M34 49h13v10h-3v3h-6v-3h-4z"/>
 <path fill="#e8bf99" d="M35 51h11v4H35z"/>
 <path fill="#ffffff" d="M33 57h3l5 5-5 5-3-4zm14 0h2v6l-3 4-5-5z"/>
 <path fill="#7b9a7d" stroke="#48664f" stroke-width="1" d="m40 63 3 3-1 10h-3l-1-10z"/>
 <path fill="#8b9fae" d="M30 71h2v5h-2z"/>
 <path fill="#e8bf99" stroke="#443730" stroke-width="2" d="M16 33h6v12h-6zm43 0h6v12h-6z"/>
 <path fill="#f0d0ae" stroke="#443730" stroke-width="2" d="M22 21h36v5h4v19h-4v5h-7v4H30v-3h-6v-5h-4V28h2z"/>
 <path fill="#f8ddbe" d="M25 28h9v3h-7v8h-3v-8h1zm11-4h14v3H36z"/>
 <path fill="#e8bf99" d="M23 44h5v4h7v3h15v-3h7v-4h3v2h-3v5h-7v2H31v-3h-7z"/>
 <path fill="#3b3030" d="M27 32h7v2h-7zm20 0h7v2h-7z"/>
 <path fill="#252a2e" d="M28 35h6v10h-6zm19 0h6v10h-6z"/>
 <path fill="#785c43" d="M30 39h3v5h-3zm19 0h3v5h-3z"/>
 <path fill="#ffffff" d="M28 35h3v3h-3zm19 0h3v3h-3z"/>
 ${female ? '<path fill="#252a2e" d="M26 34h3v3h-3zm26 0h3v3h-3z"/><path fill="#dca69a" opacity=".7" d="M25 44h5v2h-5zm27 0h5v2h-5z"/>' : ''}
 <path fill="#ce9d83" d="M38 47h6v2h-6z"/>
 ${frontHair}
 </svg>`;
}
export const baseAvatar = createBaseAvatar(false);
export const baseFemaleAvatar = createBaseAvatar(true);
