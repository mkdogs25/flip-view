/** Hand-built SVG scenery for the shelf and desk: plants, a brass armillary globe, a little astronaut. */

const leafPath = (len: number, w: number): string => `M0 0 C${len * 0.25} ${-w} ${len * 0.7} ${-w * 0.8} ${len} 0 C${len * 0.7} ${w * 0.8} ${len * 0.25} ${w} 0 0Z`;

function plantSvg(): string {
  const leaves: string[] = [];
  const spec: Array<[number, number, number]> = [
    [-64, 128, 24], [-44, 150, 27], [-24, 170, 29], [-6, 182, 30], [14, 172, 29], [34, 154, 27], [54, 134, 25], [72, 112, 22], [-78, 104, 20],
  ];
  spec.forEach(([a, len, w], i) => {
    const shade = i % 2 ? "url(#pl1)" : "url(#pl2)";
    leaves.push(`<g transform="translate(112 262) rotate(${a - 90})"><path d="${leafPath(len, w)}" fill="${shade}" stroke="#1f4a2c" stroke-width="1.2"/><path d="M0 0 L${len * 0.9} 0" stroke="#1f4a2c" stroke-opacity=".5" stroke-width="1.4"/></g>`);
  });
  const vines: string[] = [];
  for (const [x0, drop, dir] of [[84, 70, -1], [132, 54, 1]] as const) {
    vines.push(`<path d="M${x0} 276 C${x0 + dir * 30} 286 ${x0 + dir * 44} ${296 + drop * 0.3} ${x0 + dir * 36} ${300 + drop}" fill="none" stroke="#2f6b3d" stroke-width="3.4" stroke-linecap="round"/>`);
    for (let t = 0; t < 5; t++) {
      const y = 292 + t * (drop / 5.2);
      const x = x0 + dir * (34 + Math.sin(t) * 6);
      vines.push(`<g transform="translate(${x} ${y}) rotate(${dir * 30 + t * 8})"><path d="${leafPath(20, 8)}" fill="url(#pl1)" stroke="#1f4a2c" stroke-width=".8"/></g>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 372" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="pl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cc17f"/><stop offset="1" stop-color="#2f7a43"/></linearGradient>
<linearGradient id="pl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5aa863"/><stop offset="1" stop-color="#1f5a33"/></linearGradient>
<linearGradient id="pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a24d2c"/><stop offset=".45" stop-color="#e08a5c"/><stop offset="1" stop-color="#8c3f22"/></linearGradient>
</defs>
${vines.join("")}${leaves.join("")}
<path d="M70 262 H154 L146 340 Q112 352 78 340 Z" fill="url(#pot)"/>
<rect x="62" y="254" width="100" height="16" rx="5" fill="#c9714a"/><rect x="62" y="254" width="100" height="5" rx="3" fill="#f0a67c" opacity=".7"/>
</svg>`;
}

function globeSvg(): string {
  const ring = (rx: number, ry: number, rot: number, w = 2.6) => `<ellipse cx="65" cy="78" rx="${rx}" ry="${ry}" transform="rotate(${rot} 65 78)" fill="none" stroke="url(#br)" stroke-width="${w}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 176" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="br" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc8f"/><stop offset=".5" stop-color="#c8952e"/><stop offset="1" stop-color="#8a5f17"/></linearGradient>
<radialGradient id="gb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9fd0ff"/><stop offset=".6" stop-color="#3a6fc2"/><stop offset="1" stop-color="#162b63"/></radialGradient>
</defs>
<ellipse cx="65" cy="168" rx="38" ry="6" fill="#000" opacity=".3"/>
<path d="M38 166 Q65 150 92 166 Z" fill="url(#br)"/><rect x="60" y="128" width="10" height="30" fill="url(#br)"/>
<path d="M30 28 L100 128" stroke="url(#br)" stroke-width="3" opacity=".9"/>
${ring(50, 50, 0, 3.2)}${ring(22, 50, 0)}${ring(40, 50, 0)}${ring(50, 13, 0)}${ring(50, 13, 28, 2.2)}
<circle cx="65" cy="78" r="21" fill="url(#gb)"/><circle cx="58" cy="70" r="6" fill="#fff" opacity=".35"/>
<circle cx="112" cy="40" r="5" fill="url(#br)"/>
</svg>`;
}

function astronautSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 176" preserveAspectRatio="xMidYMax meet">
<defs>
<linearGradient id="sw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfc6d6"/></linearGradient>
<radialGradient id="vz" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#6c7ca8"/><stop offset=".5" stop-color="#1c2347"/><stop offset="1" stop-color="#0a0d22"/></radialGradient>
</defs>
<ellipse cx="50" cy="170" rx="30" ry="5" fill="#000" opacity=".3"/>
<rect x="24" y="60" width="52" height="58" rx="12" fill="#9aa3b8"/>
<rect x="30" y="64" width="40" height="62" rx="14" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.4"/>
<rect x="38" y="78" width="24" height="16" rx="3" fill="#2e4f9e"/><circle cx="44" cy="86" r="3" fill="#ffd36b"/><circle cx="55" cy="86" r="3" fill="#e0534a"/>
<rect x="14" y="68" width="16" height="44" rx="8" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.4" transform="rotate(14 22 70)"/>
<rect x="70" y="68" width="16" height="44" rx="8" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.4" transform="rotate(-14 78 70)"/>
<rect x="33" y="118" width="15" height="40" rx="7" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.4"/><rect x="52" y="118" width="15" height="40" rx="7" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.4"/>
<rect x="30" y="152" width="20" height="14" rx="6" fill="#5d6a8c"/><rect x="50" y="152" width="20" height="14" rx="6" fill="#5d6a8c"/>
<circle cx="50" cy="42" r="30" fill="url(#sw)" stroke="#9aa3b8" stroke-width="1.6"/>
<ellipse cx="50" cy="44" rx="21" ry="18" fill="url(#vz)"/><ellipse cx="42" cy="38" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 42 38)"/>
<rect x="78" y="86" width="10" height="7" rx="1" fill="#e0534a"/>
</svg>`;
}

export type PropKind = "plant" | "globe" | "astronaut";

export function propEl(kind: PropKind, cls: string): HTMLElement {
  const src = kind === "plant" ? plantSvg() : kind === "globe" ? globeSvg() : astronautSvg();
  const doc = new DOMParser().parseFromString(src, "image/svg+xml");
  const el = document.createElement("div");
  el.className = `fv-prop ${cls}`;
  el.appendChild(document.importNode(doc.documentElement, true));
  return el;
}
