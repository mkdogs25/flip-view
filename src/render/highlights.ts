import { Highlight } from "../types";

/** Character offset of (node, offset) within `root.textContent`. */
export function textOffsetOf(root: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Finds where a highlight lives now: its stored offsets if the quote still matches, otherwise the nearest occurrence. */
function resolve(text: string, h: Highlight): [number, number] | null {
  if (text.slice(h.start, h.end) === h.quote) return [h.start, h.end];
  if (!h.quote) return null;
  let best = -1;
  for (let i = text.indexOf(h.quote); i >= 0; i = text.indexOf(h.quote, i + 1)) {
    if (best < 0 || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
  }
  return best < 0 ? null : [best, best + h.quote.length];
}

/** Wraps the highlight's text in `<span class="fv-hl">` (one per text node). Returns false if it could not be placed. */
export function applyHighlight(root: HTMLElement, h: Highlight, color: string): boolean {
  const range = resolve(root.textContent ?? "", h);
  if (!range) return false;
  const [start, end] = range;
  const segs: Array<{ node: Text; from: number; to: number }> = [];
  let pos = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text;
    const len = t.nodeValue?.length ?? 0;
    const from = Math.max(start, pos);
    const to = Math.min(end, pos + len);
    // skip source-formatting whitespace between blocks (it would show up as stray slivers)
    const blank = !t.nodeValue?.trim() && (t.nodeValue ?? "").includes("\n");
    if (from < to && !blank && !t.parentElement?.closest("style, script")) segs.push({ node: t, from: from - pos, to: to - pos });
    pos += len;
    if (pos >= end) break;
  }
  for (const seg of segs.reverse()) {
    let mid = seg.node;
    if (seg.to < (mid.nodeValue?.length ?? 0)) mid.splitText(seg.to);
    if (seg.from > 0) mid = mid.splitText(seg.from);
    const span = document.createElement("span");
    span.className = "fv-hl";
    span.dataset.hl = h.id;
    span.style.setProperty("--hl", color);
    mid.replaceWith(span);
    span.appendChild(mid);
  }
  return segs.length > 0;
}

export function removeHighlightEls(root: HTMLElement, id: string): void {
  root.querySelectorAll<HTMLElement>(`.fv-hl[data-hl="${id}"]`).forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });
  root.normalize();
}

export function highlightColor(h: Highlight, list: Array<{ color: string }>): string {
  return list[h.slot]?.color ?? h.color;
}
