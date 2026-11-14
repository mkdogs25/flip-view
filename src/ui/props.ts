/** Hand-built SVG scenery for the shelf and desk: plants, a brass armillary globe, a little astronaut. */

const leafPath = (len: number, w: number): string => `M0 0 C${len * 0.25} ${-w} ${len * 0.7} ${-w * 0.8} ${len} 0 C${len * 0.7} ${w * 0.8} ${len * 0.25} ${w} 0 0Z`;

function plantSvg(): string {
  const leaves: string[] = [];
  const spec: Array<[number, number, number]> = [
    [-70, 112, 21], [-62, 132, 24], [-44, 154, 27], [-24, 172, 29], [-6, 184, 30], [14, 174, 29], [34, 156, 27], [54, 136, 25], [72, 112, 22], [-80, 100, 19],
  ];
  spec.forEach(([a, len, w], i) => {
    const veins: string[] = [];
    for (let k = 1; k <= 5; k++) {
      const x = (len * k) / 6.4;
      const y = w * (0.62 - Math.abs(k - 3) * 0.1);
      veins.push(`<path d="M${x} 0 L${x + len * 0.12} ${-y}M${x} 0 L${x + len * 0.12} ${y}" stroke="#143a22" stroke-opacity=".32" stroke-width=".9" fill="none"/>`);
    }
    leaves.push(`<g transform="translate(112 262) rotate(${a - 90})"><path d="${leafPath(len, w)}" fill="url(#${i % 2 ? "pl1" : "pl2"})" stroke="#173f26" stroke-width="1.1"/><path d="M0 0 L${len * 0.92} 0" stroke="#e9ffd9" stroke-opacity=".35" stroke-width="1.6"/>${veins.join("")}<path d="${leafPath(len, w)}" fill="url(#lf)" opacity=".5"/></g>`);
  });
  const vines: string[] = [];
  for (const [x0, drop, dir] of [[84, 74, -1], [132, 56, 1]] as const) {
    vines.push(`<path d="M${x0} 276 C${x0 + dir * 30} 286 ${x0 + dir * 44} ${296 + drop * 0.3} ${x0 + dir * 36} ${300 + drop}" fill="none" stroke="#2c6a3c" stroke-width="3.4" stroke-linecap="round"/>`);
    for (let t = 0; t < 6; t++) {
      const y = 292 + t * (drop / 5.4);
      const x = x0 + dir * (34 + Math.sin(t) * 6);
      vines.push(`<g transform="translate(${x} ${y}) rotate(${dir * 30 + t * 9})"><path d="${leafPath(21, 8.5)}" fill="url(#pl1)" stroke="#173f26" stroke-width=".8"/><path d="M0 0 L19 0" stroke="#e9ffd9" stroke-opacity=".3" stroke-width="1"/></g>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 372" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="pl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd392"/><stop offset=".55" stop-color="#43955a"/><stop offset="1" stop-color="#25663a"/></linearGradient>
<linearGradient id="pl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ab773"/><stop offset=".6" stop-color="#2d7b45"/><stop offset="1" stop-color="#1b4f2e"/></linearGradient>
<linearGradient id="lf" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient>
<linearGradient id="pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8c3f22"/><stop offset=".3" stop-color="#d8814f"/><stop offset=".55" stop-color="#f0a272"/><stop offset="1" stop-color="#7c3519"/></linearGradient>
<radialGradient id="soil" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#4a3322"/><stop offset="1" stop-color="#241810"/></radialGradient>
</defs>
<ellipse cx="112" cy="352" rx="62" ry="9" fill="#000" opacity=".28"/>
${vines.join("")}${leaves.join("")}
<path d="M70 262 H154 L146 340 Q112 352 78 340 Z" fill="url(#pot)"/>
<path d="M78 300 H146" stroke="#000" stroke-opacity=".14" stroke-width="2"/><path d="M82 318 H142" stroke="#000" stroke-opacity=".1" stroke-width="2"/>
<ellipse cx="112" cy="260" rx="50" ry="7" fill="url(#soil)"/>
<rect x="62" y="254" width="100" height="16" rx="6" fill="#c9714a"/><rect x="62" y="254" width="100" height="5" rx="3" fill="#ffc9a0" opacity=".75"/><rect x="62" y="264" width="100" height="6" rx="3" fill="#000" opacity=".16"/>
</svg>`;
}

function globeSvg(): string {
  const ring = (rx: number, ry: number, rot: number, w = 2.6) => `<ellipse cx="65" cy="78" rx="${rx}" ry="${ry}" transform="rotate(${rot} 65 78)" fill="none" stroke="url(#br)" stroke-width="${w}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 176" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c0"/><stop offset=".35" stop-color="#d9a940"/><stop offset=".7" stop-color="#9a6a1c"/><stop offset="1" stop-color="#e8c36a"/></linearGradient>
<radialGradient id="gb" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#b9e0ff"/><stop offset=".45" stop-color="#3f78c8"/><stop offset="1" stop-color="#101f52"/></radialGradient>
<clipPath id="gc"><circle cx="65" cy="78" r="22"/></clipPath>
</defs>
<ellipse cx="65" cy="171" rx="42" ry="6" fill="#000" opacity=".32"/>
<path d="M34 168 Q65 148 96 168 Z" fill="url(#br)"/><path d="M34 168 Q65 156 96 168" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>
<rect x="60" y="126" width="10" height="34" fill="url(#br)"/>
<path d="M28 26 L102 130" stroke="url(#br)" stroke-width="3.2"/>
${ring(50, 50, 0, 3.4)}${ring(22, 50, 0)}${ring(40, 50, 0)}${ring(50, 13, 0)}${ring(50, 13, 28, 2.2)}
<circle cx="65" cy="78" r="22" fill="url(#gb)"/>
<g clip-path="url(#gc)" fill="#4f9a55" opacity=".85"><path d="M52 66 q8 -6 14 0 q4 8 -2 12 q-6 -2 -8 6 q-8 -4 -4 -18z"/><path d="M72 80 q8 -4 12 4 q0 8 -8 10 q-6 -4 -4 -14z"/><path d="M58 90 q6 -2 8 4 q-4 6 -10 2z" fill="#c9b26a"/></g>
<circle cx="65" cy="78" r="22" fill="none" stroke="#bfe3ff" stroke-opacity=".5" stroke-width="1.4"/>
<ellipse cx="57" cy="69" rx="7" ry="4.5" fill="#fff" opacity=".42" transform="rotate(-30 57 69)"/>
<circle cx="112" cy="40" r="5" fill="url(#br)"/>
</svg>`;
}

function astronautSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 176" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="sw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d3d9e6"/><stop offset="1" stop-color="#97a0b8"/></linearGradient>
<linearGradient id="sl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa3b8"/><stop offset=".35" stop-color="#fff"/><stop offset="1" stop-color="#a9b2c8"/></linearGradient>
<radialGradient id="vz" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#ffb066"/><stop offset=".18" stop-color="#6c7ca8"/><stop offset=".55" stop-color="#1c2347"/><stop offset="1" stop-color="#070a1c"/></radialGradient>
</defs>
<ellipse cx="50" cy="171" rx="32" ry="5" fill="#000" opacity=".32"/>
<rect x="24" y="60" width="52" height="58" rx="12" fill="#8c95ab"/><rect x="28" y="64" width="44" height="14" rx="5" fill="#a2abc0"/>
<rect x="30" y="64" width="40" height="62" rx="14" fill="url(#sw)" stroke="#8c95ab" stroke-width="1.2"/>
<path d="M32 98 q18 6 36 0M33 108 q17 5 34 0" stroke="#8c95ab" stroke-opacity=".55" fill="none" stroke-width="1.2"/>
<rect x="38" y="78" width="24" height="16" rx="3" fill="#2e4f9e" stroke="#1a2f66" stroke-width="1"/><circle cx="44" cy="86" r="3" fill="#ffd36b"/><circle cx="55" cy="86" r="3" fill="#e0534a"/>
<rect x="14" y="68" width="16" height="44" rx="8" fill="url(#sl)" stroke="#8c95ab" stroke-width="1.2" transform="rotate(14 22 70)"/>
<rect x="70" y="68" width="16" height="44" rx="8" fill="url(#sl)" stroke="#8c95ab" stroke-width="1.2" transform="rotate(-14 78 70)"/>
<circle cx="18" cy="112" r="7" fill="#7d879f"/><circle cx="82" cy="112" r="7" fill="#7d879f"/>
<rect x="33" y="118" width="15" height="40" rx="7" fill="url(#sl)" stroke="#8c95ab" stroke-width="1.2"/><rect x="52" y="118" width="15" height="40" rx="7" fill="url(#sl)" stroke="#8c95ab" stroke-width="1.2"/>
<rect x="30" y="152" width="20" height="14" rx="6" fill="#4f5b7e"/><rect x="50" y="152" width="20" height="14" rx="6" fill="#4f5b7e"/>
<circle cx="50" cy="42" r="30" fill="url(#sw)" stroke="#8c95ab" stroke-width="1.4"/>
<ellipse cx="50" cy="44" rx="21.5" ry="18.5" fill="url(#vz)" stroke="#5d6a8c" stroke-width="1.2"/>
<ellipse cx="41" cy="37" rx="8" ry="4.2" fill="#fff" opacity=".4" transform="rotate(-25 41 37)"/>
<circle cx="50" cy="42" r="30" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-dasharray="40 160"/>
<rect x="78" y="86" width="10" height="7" rx="1" fill="#e0534a"/>
</svg>`;
}

function laptopSvg(): string {
  const lines: string[] = [];
  for (let i = 0; i < 70; i++) lines.push(`<path d="M8 ${10 + i * 2.7} H292" stroke="#fff" stroke-opacity="${0.05 + (i % 3) * 0.02}" stroke-width=".7"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 206">
<defs>
<linearGradient id="al" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6e8ec"/><stop offset=".5" stop-color="#b9bdc6"/><stop offset="1" stop-color="#8f949f"/></linearGradient>
<radialGradient id="lg" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></radialGradient>
</defs>
<rect x="2" y="2" width="296" height="202" rx="14" fill="url(#al)" stroke="#6f7480" stroke-width="1.6"/>
<rect x="5" y="5" width="290" height="196" rx="11" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.2"/>
${lines.join("")}
<circle cx="150" cy="103" r="15" fill="url(#lg)" stroke="#7a7f8b" stroke-width=".8"/>
<path d="M0 0 L300 206" stroke="#fff" stroke-opacity=".07" stroke-width="60"/>
</svg>`;
}

function clipsSvg(): string {
  const clip = (x: number, y: number, rot: number) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 h38 a8 8 0 0 1 0 16 h-30 a5.5 5.5 0 0 1 0 -11 h24" fill="none" stroke="#3a3d44" stroke-width="2.6" stroke-linecap="round" transform="translate(1.5 1.5)" opacity=".4"/><path d="M0 0 h38 a8 8 0 0 1 0 16 h-30 a5.5 5.5 0 0 1 0 -11 h24" fill="none" stroke="url(#cl)" stroke-width="2.4" stroke-linecap="round"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 70"><defs><linearGradient id="cl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".5" stop-color="#9aa0ac"/><stop offset="1" stop-color="#d5d9e0"/></linearGradient></defs>${clip(10, 8, -12)}${clip(34, 34, 22)}${clip(8, 48, 6)}</svg>`;
}

function pencilSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 26">
<defs>
<linearGradient id="pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe27a"/><stop offset=".34" stop-color="#f1c23a"/><stop offset=".5" stop-color="#d9a21f"/><stop offset=".66" stop-color="#f1c23a"/><stop offset="1" stop-color="#b9861a"/></linearGradient>
<linearGradient id="fe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f2f6"/><stop offset=".5" stop-color="#9ca1ad"/><stop offset="1" stop-color="#e2e5ec"/></linearGradient>
</defs>
<rect x="30" y="3" width="206" height="20" rx="3" fill="url(#pb)"/>
<rect x="2" y="3" width="30" height="20" rx="7" fill="#e98a93"/><rect x="2" y="3" width="30" height="7" rx="6" fill="#fff" opacity=".3"/>
<rect x="30" y="3" width="14" height="20" fill="url(#fe)"/><path d="M34 3v20M40 3v20" stroke="#6f7480" stroke-opacity=".5"/>
<path d="M236 3 L274 13 L236 23 Z" fill="#e8c493"/><path d="M262 8 L274 13 L262 18 Z" fill="#3a3a40"/>
<rect x="30" y="3" width="206" height="4" rx="2" fill="#fff" opacity=".28"/>
</svg>`;
}

export type PropKind = "plant" | "globe" | "astronaut" | "laptop" | "clips" | "pencil";

export function propEl(kind: PropKind, cls: string): HTMLElement {
  const src = { plant: plantSvg, globe: globeSvg, astronaut: astronautSvg, laptop: laptopSvg, clips: clipsSvg, pencil: pencilSvg }[kind]();
  const doc = new DOMParser().parseFromString(src, "image/svg+xml");
  const el = document.createElement("div");
  el.className = `fv-prop ${cls}`;
  el.appendChild(document.importNode(doc.documentElement, true));
  return el;
}
