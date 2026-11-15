/** Detailed vector writing tools: highlighter, ballpoint, pencil, marker and eraser. Pointing down, cap end up. */

let uid = 0;

type RGB = [number, number, number];

function parse(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [90, 90, 110];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const css = (c: RGB): string => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dark = (c: RGB, t: number): string => css(mix(c, [0, 0, 0], t));
const light = (c: RGB, t: number): string => css(mix(c, [255, 255, 255], t));

/** Horizontal gradient that makes a flat rectangle read as a glossy cylinder. */
function cylinder(id: string, c: RGB): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark(c, 0.62)}"/><stop offset=".14" stop-color="${dark(c, 0.22)}"/><stop offset=".32" stop-color="${light(c, 0.5)}"/><stop offset=".46" stop-color="${css(c)}"/><stop offset=".78" stop-color="${dark(c, 0.3)}"/><stop offset="1" stop-color="${dark(c, 0.66)}"/></linearGradient>`;
}

const CHROME = (id: string): string =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6c717c"/><stop offset=".2" stop-color="#f4f6fa"/><stop offset=".4" stop-color="#b4b9c4"/><stop offset=".62" stop-color="#ffffff"/><stop offset=".85" stop-color="#8b909c"/><stop offset="1" stop-color="#555a66"/></linearGradient>`;

function highlighter(c: RGB, k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 132" preserveAspectRatio="xMidYMax meet"><defs>${cylinder("cap" + k, c)}${cylinder("bar" + k, mix(c, [255, 255, 255], 0.55))}${CHROME("ch" + k)}
<linearGradient id="sp${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
<path d="M6 112 H22 L20 124 H8 Z" fill="${dark(c, 0.4)}"/><path d="M8.2 124 H19.8 L18.2 131 H9.8 Z" fill="${css(c)}" stroke="${dark(c, 0.35)}" stroke-width=".6"/>
<rect x="3" y="44" width="22" height="70" rx="3" fill="url(#bar${k})"/>
<rect x="9" y="56" width="10" height="46" rx="2" fill="${css(c)}" opacity=".62"/>
<rect x="3" y="74" width="22" height="13" fill="#fff" opacity=".9"/><path d="M6 78.5h16M6 82.5h11" stroke="#2c2f3a" stroke-opacity=".7" stroke-width="1"/>
<rect x="2" y="2" width="24" height="52" rx="7" fill="url(#cap${k})"/>
<rect x="1.5" y="46" width="25" height="7" rx="2" fill="${dark(c, 0.3)}"/><rect x="1.5" y="46" width="25" height="2" fill="#fff" opacity=".35"/>
<rect x="20.6" y="9" width="4" height="34" rx="2" fill="url(#ch${k})"/>
<rect x="6.5" y="5" width="3.2" height="42" rx="1.6" fill="url(#sp${k})"/>
</svg>`;
}

function ballpoint(c: RGB, k: string): string {
  const body = mix(c, [18, 22, 40], 0.45);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 132" preserveAspectRatio="xMidYMax meet"><defs>${cylinder("b" + k, body)}${CHROME("ch" + k)}
<linearGradient id="rb${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d0e12"/><stop offset=".3" stop-color="#4a4d58"/><stop offset=".6" stop-color="#1a1b20"/><stop offset="1" stop-color="#08090b"/></linearGradient>
<linearGradient id="sp${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
<rect x="8" y="0" width="6" height="9" rx="2.4" fill="url(#ch${k})"/>
<rect x="3" y="8" width="16" height="86" rx="5" fill="url(#b${k})"/>
<rect x="3" y="30" width="16" height="3.4" fill="${css(c)}"/><rect x="3" y="30" width="16" height="1" fill="#fff" opacity=".4"/>
<rect x="15.4" y="6" width="3.4" height="44" rx="1.7" fill="url(#ch${k})"/><circle cx="17.1" cy="50" r="2.4" fill="url(#ch${k})"/>
<rect x="6" y="11" width="2.6" height="76" rx="1.3" fill="url(#sp${k})"/>
<rect x="4" y="92" width="14" height="22" rx="4" fill="url(#rb${k})"/>
${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M4.4 ${95 + i * 3.4}H17.6" stroke="#fff" stroke-opacity=".16" stroke-width=".8"/>`).join("")}
<path d="M5.4 114 H16.6 L12.2 127 H9.8 Z" fill="url(#ch${k})"/><rect x="10.1" y="126" width="1.8" height="6" rx=".9" fill="#7a7f8c"/>
</svg>`;
}

function pencil(c: RGB, k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 132" preserveAspectRatio="xMidYMax meet"><defs>${CHROME("ch" + k)}
<linearGradient id="pk${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c46a76"/><stop offset=".35" stop-color="#ffb1ba"/><stop offset="1" stop-color="#cf7482"/></linearGradient></defs>
<rect x="3" y="0" width="16" height="15" rx="4.4" fill="url(#pk${k})"/><rect x="5" y="2" width="3" height="10" rx="1.5" fill="#fff" opacity=".4"/>
<rect x="2" y="13" width="18" height="17" fill="url(#ch${k})"/>${[0, 1, 2].map((i) => `<path d="M2 ${17 + i * 4}H20" stroke="#4a4f5a" stroke-opacity=".5" stroke-width="1"/>`).join("")}
<path d="M3 30 H8 V106 H3Z" fill="#c9951b"/><path d="M8 30 H14 V106 H8Z" fill="#f4c93f"/><path d="M14 30 H19 V106 H14Z" fill="#dba723"/>
<path d="M8 30 H10 V106 H8Z" fill="#fff" opacity=".35"/><path d="M11 40v22M11 70v18" stroke="#7a5a10" stroke-opacity=".6" stroke-width="1.2" stroke-dasharray="3 2"/>
<path d="M3 106 H19 L13.4 124 H8.6 Z" fill="#e9c796"/><path d="M3 106 H8 L8.6 124 L3 106Z" fill="#c9a36d"/><path d="M14 106 H19 L13.4 124Z" fill="#d6b07c"/>
<path d="M8.6 124 H13.4 L11 132 Z" fill="${css(mix(c, [0, 0, 0], 0.35))}"/>
</svg>`;
}

function marker(c: RGB, k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 132" preserveAspectRatio="xMidYMax meet"><defs>${cylinder("cap" + k, c)}${cylinder("bar" + k, [244, 244, 248])}${CHROME("ch" + k)}
<linearGradient id="sp${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
<path d="M7 108 H23 L20 120 H10 Z" fill="${dark(c, 0.35)}"/><path d="M9.5 119 H20.5 Q21 127 18 131 H12 Q9 127 9.5 119 Z" fill="${css(c)}" stroke="${dark(c, 0.4)}" stroke-width=".7"/>
<rect x="3" y="52" width="24" height="58" rx="3" fill="url(#bar${k})"/>
<rect x="3" y="70" width="24" height="16" fill="${css(c)}" opacity=".9"/><path d="M7 75h16M7 80h10" stroke="#fff" stroke-opacity=".85" stroke-width="1.2"/>
<rect x="1.5" y="2" width="27" height="54" rx="8" fill="url(#cap${k})"/>
<rect x="1" y="47" width="28" height="7" rx="2" fill="${dark(c, 0.32)}"/>
<rect x="22.6" y="9" width="4.2" height="34" rx="2" fill="url(#ch${k})"/>
<rect x="6" y="5" width="3.6" height="42" rx="1.8" fill="url(#sp${k})"/>
</svg>`;
}

function eraser(_c: RGB, k: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 92" preserveAspectRatio="xMidYMax meet"><defs>
<linearGradient id="sl${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d3f8f"/><stop offset=".3" stop-color="#5d8ae0"/><stop offset=".55" stop-color="#2f58b8"/><stop offset="1" stop-color="#16316f"/></linearGradient>
<linearGradient id="er${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c7c9d1"/><stop offset=".4" stop-color="#ffffff"/><stop offset="1" stop-color="#b4b7c1"/></linearGradient></defs>
<rect x="2" y="2" width="32" height="60" rx="4" fill="url(#sl${k})"/>
<rect x="2" y="24" width="32" height="14" fill="#fff" opacity=".92"/><path d="M6 29h24M6 34h14" stroke="#1d3f8f" stroke-width="1.4" opacity=".8"/>
<rect x="3.5" y="58" width="29" height="30" rx="6" fill="url(#er${k})"/><path d="M5 62h26" stroke="#000" stroke-opacity=".12"/>
<rect x="6" y="5" width="3.4" height="50" rx="1.7" fill="#fff" opacity=".35"/>
</svg>`;
}

export type PenKind = "highlighter" | "ballpoint" | "pencil" | "marker" | "eraser";

export function penSvg(kind: PenKind, color: string): Element {
  const k = String(++uid);
  const c = parse(color);
  const src = { highlighter, ballpoint, pencil, marker, eraser }[kind](c, k);
  const doc = new DOMParser().parseFromString(src, "image/svg+xml");
  return document.importNode(doc.documentElement, true);
}
