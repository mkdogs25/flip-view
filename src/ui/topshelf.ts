import { setIcon } from "obsidian";
import { notebookProgress } from "../progress";
import { Notebook, NotebookHost, realNoteCount } from "../types";
import { coverFor, resolveLook } from "./coverStyle";
import { progressEl } from "./dom";
import { propEl } from "./props";

export interface TopShelfCallbacks {
  pick(nb: Notebook, el: HTMLElement): void;
  create(): void;
  fullShelf(): void;
  collapse(collapsed: boolean): void;
}

export interface FlyRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** The strip of notebook covers along the top of the scene, standing on a wall shelf. */
export class TopShelf {
  readonly el: HTMLElement;
  private row: HTMLElement;
  private flyLayer: HTMLElement;
  private books: Notebook[] = [];
  private selectedId = "";
  private covers = new Map<string, HTMLElement>();
  private lastPaint = 0;

  constructor(parent: HTMLElement, private host: NotebookHost, private cb: TopShelfCallbacks) {
    this.el = parent.createDiv({ cls: "fv-topshelf" });
    this.el.createDiv({ cls: "fv-wall" });
    this.el.createDiv({ cls: "fv-ts-rays" });
    const props = this.el.createDiv({ cls: "fv-ts-props" });
    props.createDiv({ cls: "fv-ladder" });
    props.appendChild(propEl("plant", "fv-prop-plant is-left"));
    props.appendChild(propEl("plant", "fv-prop-plant is-right"));
    new ResizeObserver(() => {
      const w = this.el.clientWidth;
      this.el.toggleClass("is-narrow", w < 1240);
      this.el.toggleClass("is-tiny", w < 900);
    }).observe(this.el);
    this.row = this.el.createDiv({ cls: "fv-ts-row" });
    this.el.createDiv({ cls: "fv-ts-plank" });
    const full = this.el.createEl("button", { cls: "fv-ts-full fv-glass", attr: { type: "button" } });
    setIcon(full.createSpan(), "layout-grid");
    full.createSpan({ text: "Shelf Mode" });
    full.addEventListener("click", () => this.cb.fullShelf());
    const fold = this.el.createEl("button", { cls: "fv-ts-fold fv-glass", attr: { type: "button", "aria-label": "Fold the shelf away" } });
    setIcon(fold, "chevron-up");
    fold.addEventListener("click", () => this.cb.collapse(!this.el.hasClass("is-collapsed")));
    this.flyLayer = parent.createDiv({ cls: "fv-ts-fly" });
  }

  get collapsed(): boolean {
    return this.el.hasClass("is-collapsed");
  }

  setCollapsed(c: boolean): void {
    this.el.toggleClass("is-collapsed", c);
  }

  coverEl(id: string): HTMLElement | undefined {
    return this.covers.get(id);
  }

  /** `onDesk` is the notebook currently lying on the desk: its slot on the shelf stays empty. */
  render(books: Notebook[], selectedId: string, onDesk = true): void {
    this.books = books;
    this.selectedId = selectedId;
    const s = this.host.settings;
    const scroll = this.row.scrollLeft;
    this.row.empty();
    this.covers.clear();
    const queue: Array<() => void> = [];
    for (const nb of books) {
      const look = resolveLook(s, nb);
      const away = onDesk && nb.id === selectedId;
      const sc = this.row.createEl("button", { cls: "fv-sc", attr: { type: "button", "aria-label": `Pick ${nb.name}`, title: nb.name } });
      sc.toggleClass("is-selected", nb.id === selectedId);
      sc.toggleClass("is-away", away);
      sc.dataset.id = nb.id;
      sc.dataset.band = look.band;
      sc.dataset.label = s.coverLabel;
      const art = sc.createDiv({ cls: "fv-sc-art" });
      art.createDiv({ cls: "fv-sc-strap" });
      art.createDiv({ cls: "fv-sc-strap-h" });
      art.createDiv({ cls: "fv-sc-hinge" });
      const label = art.createDiv({ cls: "fv-sc-label" });
      label.createDiv({ cls: "fv-sc-title", text: nb.name }).dataset.len = String(nb.name.length > 9 ? (nb.name.length > 15 ? 2 : 1) : 0);
      const n = realNoteCount(nb);
      label.createDiv({ cls: "fv-sc-count", text: `${n} ${n === 1 ? "note" : "notes"}` });
      if (s.trackProgress && s.progressShelf) {
        const p = notebookProgress(nb, s);
        if (p.total) {
          const prog = label.createDiv({ cls: "fv-sc-prog" });
          prog.appendChild(progressEl(p, s.progressStyle === "count" ? "count" : "bar", 14));
          if (s.progressStyle !== "count") prog.createSpan({ cls: "fv-sc-pct", text: `${Math.round(p.frac * 100)}%` });
        }
      }
      const ribbon = sc.createDiv({ cls: "fv-sc-ribbon" });
      ribbon.style.setProperty("--rib", look.ribbonColor || s.ribbonColor);
      const hue = Array.from(nb.id).reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
      art.style.setProperty("--sc-base", `hsl(${hue} 32% 28%)`);
      queue.push(() => {
        try {
          const cov = coverFor(s, nb, true);
          art.style.backgroundImage = `url(${cov.url})`;
          art.style.setProperty("--sc-base", cov.base);
          art.style.setProperty("--sc-ink", cov.ink);
          art.style.setProperty("--sc-shade", cov.lightCover ? "0.05" : "0.55");
          if (!look.ribbonColor || look.ribbonColor === s.ribbonColor) ribbon.style.setProperty("--rib", cov.light);
          sc.addClass("is-ready");
        } catch {
          /* flat colour stays */
        }
      });
      sc.addEventListener("pointerenter", () => window.setTimeout(() => coverFor(s, nb), 40));
      sc.addEventListener("click", () => !sc.hasClass("is-away") && this.cb.pick(nb, sc));
      this.covers.set(nb.id, sc);
    }
    const add = this.row.createEl("button", { cls: "fv-sc fv-sc-new", attr: { type: "button", "aria-label": "New notebook" } });
    setIcon(add.createDiv({ cls: "fv-sc-new-icon" }), "plus");
    add.createDiv({ cls: "fv-sc-new-text", text: "New notebook" });
    add.addEventListener("click", () => this.cb.create());
    // little figures standing at the end of the row, like the reference
    this.row.appendChild(propEl("globe", "fv-prop-inline fv-prop-globe"));
    this.row.appendChild(propEl("astronaut", "fv-prop-inline fv-prop-astro"));
    this.row.scrollLeft = scroll;
    // low-resolution covers one per tick so the strip appears at once
    const token = ++this.lastPaint;
    const next = () => {
      const job = queue.shift();
      if (!job || token !== this.lastPaint) return;
      job();
      window.setTimeout(next, 6);
    };
    window.setTimeout(next, 20);
  }

  /** Slides a cover between two places on the stage with a little lift and tilt. */
  async fly(face: HTMLElement, from: FlyRect, to: FlyRect, ms: number, onMid?: () => void): Promise<void> {
    const fly = this.flyLayer.createDiv({ cls: "fv-ts-flyer" });
    const w = to.w;
    const h = to.h;
    fly.style.cssText = `width:${w}px;height:${h}px;left:${to.cx - w / 2}px;top:${to.cy - h / 2}px`;
    fly.appendChild(face);
    const k0 = from.h / h;
    const dx = from.cx - to.cx;
    const dy = from.cy - to.cy;
    const tf = (x: number, y: number, z: number, rx: number, k: number, rz = 0) => `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${k})`;
    if (ms <= 0) {
      fly.remove();
      onMid?.();
      return;
    }
    const a = fly.animate(
      [
        { transform: tf(dx, dy, 0, 0, k0), offset: 0, easing: "cubic-bezier(.3,.7,.3,1)" },
        { transform: tf(dx, dy + 6, 90, -4, k0 * 1.12), offset: 0.2, easing: "cubic-bezier(.45,.05,.3,1)" },
        { transform: tf(dx * 0.4, dy * 0.4 + 40, 180, 22, k0 + (1 - k0) * 0.55, -2), offset: 0.62, easing: "cubic-bezier(.3,0,.3,1)" },
        { transform: tf(0, 0, 40, 6, 1.02), offset: 0.9 },
        { transform: tf(0, 0, 0, 0, 1), offset: 1 },
      ],
      { duration: ms, fill: "forwards" },
    );
    window.setTimeout(() => onMid?.(), ms * 0.88);
    await a.finished.catch(() => undefined);
    fly.remove();
  }

  rectOf(id: string): FlyRect | null {
    const el = this.covers.get(id);
    if (!el) return null;
    const parent = this.el.parentElement?.getBoundingClientRect();
    const r = el.querySelector(".fv-sc-art")?.getBoundingClientRect();
    if (!parent || !r) return null;
    return { cx: r.left - parent.left + r.width / 2, cy: r.top - parent.top + r.height / 2, w: r.width, h: r.height };
  }

  destroy(): void {
    this.lastPaint++;
    this.flyLayer.remove();
    this.el.remove();
  }
}
