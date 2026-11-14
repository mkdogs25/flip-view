import { setIcon } from "obsidian";

export function iconButton(parent: HTMLElement, icon: string, label: string, cls = ""): HTMLButtonElement {
  const b = parent.createEl("button", { cls: `fv-iconbtn ${cls}`.trim(), attr: { "aria-label": label, type: "button" } });
  setIcon(b, icon);
  return b;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

import { Progress } from "../progress";

/** A small progress indicator: a ring, a bar or a "3/5" count. */
export function progressEl(p: Progress, style: "ring" | "bar" | "count", size = 18): HTMLElement {
  const wrap = createSpan({ cls: `fv-prog fv-prog-${style}` });
  wrap.setAttr("title", `${p.done} of ${p.total} read`);
  wrap.setAttr("aria-label", `${p.done} of ${p.total} read`);
  if (style === "count") {
    wrap.setText(`${p.done}/${p.total}`);
  } else if (style === "bar") {
    const bar = wrap.createSpan({ cls: "fv-prog-fill" });
    bar.style.width = `${Math.round(p.frac * 100)}%`;
  } else {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    const track = document.createElementNS(ns, "circle");
    const arc = document.createElementNS(ns, "circle");
    for (const c of [track, arc]) {
      c.setAttribute("cx", "10");
      c.setAttribute("cy", "10");
      c.setAttribute("r", "7.5");
      c.setAttribute("fill", "none");
      c.setAttribute("stroke-width", "3");
    }
    track.setAttribute("class", "fv-prog-track");
    arc.setAttribute("class", "fv-prog-arc");
    const circ = 2 * Math.PI * 7.5;
    arc.setAttribute("stroke-dasharray", `${(circ * p.frac).toFixed(2)} ${circ.toFixed(2)}`);
    arc.setAttribute("transform", "rotate(-90 10 10)");
    arc.setAttribute("stroke-linecap", "round");
    svg.append(track, arc);
    wrap.appendChild(svg);
  }
  return wrap;
}
