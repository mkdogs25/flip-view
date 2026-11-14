import { Rng, hashString } from "../util/rng";

const SKIP = "svg, script, style, mjx-container, .math, .fv-skip, textarea, input";

/**
 * Turns rendered markdown into "handwriting": every word becomes a tiny inline-block that is nudged
 * (rotation, baseline, size, tracking, ink density) by a seeded random generator, so the same note
 * always looks identically hand-written. `messiness` is 0..1; `tame` scales the vertical drift and tilt (used on ruled paper,
 * where words should stay on the line).
 */
export function handwrite(root: HTMLElement, seed: string, messiness: number, tame = 1, lineVar = 0): void {
  const rng = new Rng(hashString(seed));
  const m = Math.max(0, Math.min(1, messiness));
  const doc = root.ownerDocument;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    if (!t.nodeValue || !t.nodeValue.trim()) continue;
    const parent = t.parentElement;
    if (!parent || parent.closest(SKIP)) continue;
    targets.push(t);
  }

  for (const node of targets) {
    const parts = (node.nodeValue ?? "").split(/(\s+)/);
    const frag = doc.createDocumentFragment();
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) {
        frag.appendChild(doc.createTextNode(part));
        continue;
      }
      const span = doc.createElement("span");
      span.className = "fv-w";
      span.textContent = part;
      if (m > 0) {
        const rot = rng.gauss() * m * 3.4 * tame;
        const dy = rng.gauss() * m * 2.4 * tame;
        const sc = 1 + rng.gauss() * m * 0.07;
        const ls = rng.gauss() * m * 0.5;
        span.style.transform = `translateY(${dy.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
        if (Math.abs(ls) > 0.02) span.style.letterSpacing = `${ls.toFixed(2)}px`;
        if (m > 0.15) span.style.opacity = (0.86 + rng.float() * 0.14).toFixed(2);
      }
      frag.appendChild(span);
    }
    node.parentNode?.replaceChild(frag, node);
  }

  if (m > 0) {
    // paragraphs and list items start a little off the margin, as if written freehand
    root.querySelectorAll<HTMLElement>("p, li").forEach((el) => {
      const off = rng.gauss() * m * 7;
      if (Math.abs(off) > 0.5) el.style.marginLeft = `${off.toFixed(1)}px`;
    });
  }

  // slightly uneven line spacing, like a hand that doesn't quite hold a steady rhythm
  if (lineVar > 0) {
    root.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6, blockquote").forEach((el) => {
      const f = 1 + rng.gauss() * lineVar * 0.1;
      el.style.lineHeight = `calc(var(--fv-lh) * ${f.toFixed(3)})`;
      const g = 1 + rng.gauss() * lineVar * 0.35;
      if (el.tagName === "P") el.style.marginBottom = `calc(var(--fv-gap) * ${g.toFixed(3)})`;
    });
  }

  // wavy horizontal rules
  root.querySelectorAll<HTMLElement>("hr").forEach((hr) => {
    hr.classList.add("fv-hr");
  });
}

/** Normalises rendered markup so it survives being cloned onto several pages. */
export function prepareForPages(root: HTMLElement): void {
  root.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((box) => {
    if (box.checked) box.setAttribute("checked", "");
    box.setAttribute("disabled", "");
    box.tabIndex = -1;
  });
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.removeAttribute("loading");
    img.draggable = false;
  });
  root.querySelectorAll<HTMLElement>("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
}
