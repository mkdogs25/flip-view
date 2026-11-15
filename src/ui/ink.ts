import { Annotation } from "../types";

const NS = "http://www.w3.org/2000/svg";

/** SVG path through the points (flat fractions), smoothed with quadratic curves through midpoints. */
export function strokePath(points: number[]): string {
  const p = (i: number) => `${(points[i] * 1000).toFixed(1)} ${(points[i + 1] * 1000).toFixed(1)}`;
  if (points.length < 4) return points.length >= 2 ? `M ${p(0)} L ${p(0)}` : "";
  let d = `M ${p(0)}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i] + points[i + 2]) / 2;
    const my = (points[i + 1] + points[i + 3]) / 2;
    d += ` Q ${p(i)} ${(mx * 1000).toFixed(1)} ${(my * 1000).toFixed(1)}`;
  }
  d += ` L ${p(points.length - 2)}`;
  return d;
}

export function makeStrokeEl(a: Pick<Annotation, "tool" | "color" | "points" | "id">): SVGPathElement {
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", strokePath(a.points ?? []));
  path.setAttribute("class", `fv-stroke fv-stroke-${a.tool}`);
  path.setAttribute("vector-effect", "non-scaling-stroke");
  path.style.setProperty("--c", a.color);
  path.dataset.ink = a.id;
  return path;
}

/** Creates the SVG layer that live strokes are drawn into. */
export function ensureInkLayer(page: HTMLElement): { svg: SVGSVGElement; text: HTMLElement } {
  let wrap = page.querySelector<HTMLElement>(":scope > .fv-ink");
  if (!wrap) {
    wrap = page.createDiv({ cls: "fv-ink" });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.classList.add("fv-ink-svg");
    wrap.appendChild(svg);
    wrap.createDiv({ cls: "fv-ink-texts" });
  }
  return { svg: wrap.querySelector("svg") as SVGSVGElement, text: wrap.querySelector(".fv-ink-texts") as HTMLElement };
}

/** Draws a page's saved ink and typed text, replacing whatever was there. */
export function renderInk(page: HTMLElement, annots: Annotation[]): void {
  const { svg, text } = ensureInkLayer(page);
  svg.replaceChildren();
  text.replaceChildren();
  for (const a of annots) {
    if (a.kind === "stroke") svg.appendChild(makeStrokeEl(a));
    else if (a.kind === "text" && a.text) {
      const t = text.createDiv({ cls: "fv-ink-text", text: a.text });
      t.dataset.ink = a.id;
      t.style.left = `${(a.x ?? 0) * 100}%`;
      t.style.top = `${(a.y ?? 0) * 100}%`;
      t.style.setProperty("--c", a.color);
    }
  }
}
