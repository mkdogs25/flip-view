import { setIcon } from "obsidian";
import { notebookProgress } from "../progress";
import { Notebook, NotebookHost, realNoteCount } from "../types";
import { Rng, clamp, hashString } from "../util/rng";
import { coverFor, resolveLook } from "./coverStyle";
import { progressEl } from "./dom";

export interface ShelfCallbacks {
  pick(nb: Notebook, spine: HTMLElement): void;
  close(): void;
}

export interface ShelfTarget {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** All notebooks standing on a wall shelf. Clicking a spine slides the book out and lays it on the desk. */
export class Shelf {
  readonly el: HTMLElement;
  private scene: HTMLElement;
  private rowsEl: HTMLElement;
  private flyLayer: HTMLElement;
  private titleEl: HTMLElement;
  private books: Notebook[] = [];
  private selectedId = "";
  private ro: ResizeObserver;
  private renderTimer = 0;
  private busy = false;
  private spineById = new Map<string, HTMLElement>();

  constructor(parent: HTMLElement, private host: NotebookHost, private cb: ShelfCallbacks) {
    this.el = parent.createDiv({ cls: "fv-shelf" });
    this.scene = this.el.createDiv({ cls: "fv-shelf-scene" });
    this.scene.createDiv({ cls: "fv-shelf-light" });
    const head = this.scene.createDiv({ cls: "fv-shelf-head" });
    const titles = head.createDiv({ cls: "fv-shelf-titles" });
    this.titleEl = titles.createDiv({ cls: "fv-shelf-title", text: "Your shelf" });
    titles.createDiv({ cls: "fv-shelf-sub", text: "Pick a notebook to pull it out" });
    const back = head.createEl("button", { cls: "fv-shelf-back fv-glass", attr: { type: "button" } });
    setIcon(back.createSpan(), "notebook-text");
    back.createSpan({ text: "Back to the desk" });
    back.addEventListener("click", () => this.cb.close());
    this.rowsEl = this.scene.createDiv({ cls: "fv-shelf-rows" });
    this.flyLayer = this.el.createDiv({ cls: "fv-fly-layer" });
    this.ro = new ResizeObserver(() => {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = window.setTimeout(() => this.isOpen && this.render(this.books, this.selectedId), 160);
    });
    this.ro.observe(this.el);
  }

  get isOpen(): boolean {
    return this.el.hasClass("is-open");
  }

  get isBusy(): boolean {
    return this.busy;
  }

  open(): void {
    this.scene.style.opacity = "";
    this.el.addClass("is-open");
    this.render(this.books, this.selectedId);
  }

  hide(): void {
    this.el.removeClass("is-open");
  }

  destroy(): void {
    this.ro.disconnect();
    this.el.remove();
  }

  /** Lays the books out on as many shelves as they need (never fewer than three, so the shelf looks like a shelf). */
  render(books: Notebook[], selectedId: string): void {
    this.books = books;
    this.selectedId = selectedId;
    if (!this.isOpen) return;
    const s = this.host.settings;
    this.rowsEl.empty();
    this.spineById.clear();
    const width = Math.max(260, this.el.clientWidth - 150);
    const rows: Notebook[][] = [[]];
    let used = 0;
    for (const nb of books) {
      const w = this.spineWidth(nb) + 4;
      if (used + w > width && rows[rows.length - 1].length) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push(nb);
      used += w;
    }
    while (rows.length < 3) rows.push([]);
    this.titleEl.setText(books.length ? `Your shelf · ${books.length} notebook${books.length === 1 ? "" : "s"}` : "Your shelf");

    const queue: Array<() => void> = [];
    rows.forEach((row, ri) => {
      const rowEl = this.rowsEl.createDiv({ cls: "fv-shelf-row" });
      const booksEl = rowEl.createDiv({ cls: "fv-shelf-books" });
      row.forEach((nb, i) => {
        const spine = this.makeSpine(nb, queue);
        booksEl.appendChild(spine);
        this.spineById.set(nb.id, spine);
        // a bookend on the end of a full row, a little plant on the first shelf
        if (i === row.length - 1 && row.length > 2) booksEl.createDiv({ cls: "fv-bookend" });
      });
      if (ri === 0 && row.length < 12) {
        const deco = booksEl.createDiv({ cls: "fv-shelf-plant" });
        deco.createDiv({ cls: "fv-plant-leaf l1" });
        deco.createDiv({ cls: "fv-plant-leaf l2" });
        deco.createDiv({ cls: "fv-plant-leaf l3" });
        deco.createDiv({ cls: "fv-plant-pot" });
      }
      rowEl.createDiv({ cls: "fv-shelf-board" });
    });
    // low-resolution covers for the spine textures, painted one per frame so the shelf appears instantly
    const next = () => {
      const job = queue.shift();
      if (!job || !this.isOpen) return;
      job();
      window.setTimeout(next, 8);
    };
    window.setTimeout(next, 30);
    void s;
  }

  /** A font size that lets the name wrap into as many vertical lines as the spine is wide enough for. */
  private titleSize(name: string, w: number, h: number, label: boolean): number {
    const room = h * (label ? 0.46 : 0.62) - 10; // along the spine
    const across = w * (label ? 0.76 : 1) - 6; // how many lines can sit side by side
    const chars = Math.max(1, name.length);
    let best = 8;
    for (const lines of [1, 2, 3, 4]) {
      const longest = lines === 1 ? chars : Math.ceil(chars / lines) + 2; // words rarely split evenly
      const size = Math.min(15, room / (longest * 0.64), across / (lines * 1.15));
      best = Math.max(best, size);
    }
    return Math.round(best * 10) / 10;
  }

  private spineWidth(nb: Notebook): number {
    return clamp(26 + realNoteCount(nb) * 3.4, 30, 64);
  }

  private makeSpine(nb: Notebook, queue: Array<() => void>): HTMLElement {
    const s = this.host.settings;
    const rng = new Rng(hashString(nb.id + "#spine"));
    const look = resolveLook(s, nb);
    const w = this.spineWidth(nb);
    const h = Math.round(196 + rng.range(-18, 34));
    const tilt = rng.chance(0.07) ? rng.range(-6, -3) : 0; // the odd leaning book
    const spine = createDiv({ cls: `fv-spine fv-sp-${look.spine}` });
    spine.style.width = `${w}px`;
    spine.style.height = `${h}px`;
    if (tilt) spine.style.setProperty("--tilt", `${tilt}deg`);
    spine.toggleClass("is-selected", nb.id === this.selectedId);
    spine.setAttr("role", "button");
    spine.setAttr("tabindex", "0");
    spine.setAttr("aria-label", `Pull out ${nb.name}`);
    spine.setAttr("title", nb.name);
    spine.dataset.id = nb.id;
    const band = look.bandColor || "";
    if (band) spine.style.setProperty("--sp-band", band);
    spine.createDiv({ cls: "fv-spine-tex" });
    spine.createDiv({ cls: "fv-spine-deco" });
    const titleEl = spine.createDiv({ cls: "fv-spine-title", text: nb.name });
    titleEl.style.fontSize = `${this.titleSize(nb.name, w, h, look.spine === "label")}px`;
    spine.createDiv({ cls: "fv-spine-count", text: String(realNoteCount(nb)) });
    if (s.trackProgress && s.progressShelf) {
      const prog = notebookProgress(nb, s);
      if (prog.total) spine.appendChild(progressEl(prog, s.progressStyle === "count" ? "bar" : s.progressStyle, 14));
    }
    // neutral colour until the cover texture arrives
    const hue = hashString(nb.id) % 360;
    spine.style.setProperty("--sp-base", `hsl(${hue} 30% 32%)`);
    queue.push(() => {
      try {
        const cov = coverFor(s, nb, true);
        spine.style.setProperty("--sp-base", cov.base);
        spine.style.setProperty("--sp-dark", cov.dark);
        spine.style.setProperty("--sp-light", cov.light);
        (spine.querySelector(".fv-spine-tex") as HTMLElement).style.backgroundImage = `url(${cov.url})`;
        spine.addClass("is-ready");
      } catch {
        /* keep the flat colour */
      }
    });
    spine.addEventListener("pointerenter", () => window.setTimeout(() => coverFor(s, nb), 40)); // warm the full cover
    spine.addEventListener("click", () => !this.busy && this.cb.pick(nb, spine));
    spine.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!this.busy) this.cb.pick(nb, spine);
      }
    });
    return spine;
  }

  spineOf(id: string): HTMLElement | undefined {
    return this.spineById.get(id);
  }

  /**
   * The pull-out: the spine slides forward off the shelf, the book swings round to show its cover, tips back
   * onto the desk and the shelf fades away behind it. `coverFace` is a finished cover (cloned from the desk).
   */
  async pullOut(nb: Notebook, spine: HTMLElement, target: ShelfTarget, coverFace: HTMLElement, duration: number, onMid: () => void): Promise<void> {
    this.busy = true;
    const base = this.el.getBoundingClientRect();
    const sr = spine.getBoundingClientRect();
    const k0 = sr.height / target.h; // desk size -> shelf size
    const T = sr.width / k0; // thickness in desk pixels
    const H = target.h;
    const W = target.w;
    const cx0 = sr.left - base.left + sr.width / 2;
    const cy0 = sr.top - base.top + sr.height / 2;
    const dx = target.cx - cx0;
    const dy = target.cy - cy0;

    const fly = this.flyLayer.createDiv({ cls: "fv-fly" });
    fly.style.width = `${T}px`;
    fly.style.height = `${H}px`;
    fly.style.left = `${cx0 - T / 2}px`;
    fly.style.top = `${cy0 - H / 2}px`;
    const face = (cls: string, w: number, h: number, left: number, top: number, tf: string) => {
      const f = fly.createDiv({ cls: `fv-fly-face ${cls}` });
      f.style.cssText = `width:${w}px;height:${h}px;left:${left}px;top:${top}px;transform:${tf}`;
      return f;
    };
    const sp = face("fv-fly-spine", T, H, 0, 0, `translateZ(${W / 2}px)`);
    const spineClone = spine.cloneNode(true) as HTMLElement;
    spineClone.classList.remove("is-selected");
    spineClone.style.cssText += `;position:absolute;left:0;top:0;width:${sr.width}px;height:${sr.height}px;transform-origin:0 0;transform:scale(${1 / k0});margin:0`;
    sp.appendChild(spineClone);
    face("fv-fly-back", T, H, 0, 0, `rotateY(180deg) translateZ(${W / 2}px)`).style.background = "var(--sp-dark, #222)";
    const cv = face("fv-fly-cover", W, H, (T - W) / 2, 0, `rotateY(90deg) translateZ(${T / 2}px)`);
    cv.appendChild(coverFace);
    face("fv-fly-back-cover", W, H, (T - W) / 2, 0, `rotateY(-90deg) translateZ(${T / 2}px)`);
    face("fv-fly-pages-top", T, W, 0, (H - W) / 2, `rotateX(90deg) translateZ(${H / 2}px)`);
    face("fv-fly-pages-bottom", T, W, 0, (H - W) / 2, `rotateX(-90deg) translateZ(${H / 2}px)`);
    const shadow = this.flyLayer.createDiv({ cls: "fv-fly-shadow" });
    shadow.style.cssText = `left:${target.cx - W / 2}px;top:${target.cy - H / 2}px;width:${W}px;height:${H}px`;
    spine.style.visibility = "hidden";

    const tf = (x: number, y: number, z: number, rx: number, ry: number, k: number) => `translate3d(${x}px,${y}px,${z}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${k})`;
    const frames: Keyframe[] = [
      { transform: tf(0, 0, 0, 0, 0, k0), offset: 0, easing: "cubic-bezier(.3,.7,.3,1)" },
      { transform: tf(0, -4, 110, -3, 0, k0 * 1.04), offset: 0.2, easing: "cubic-bezier(.45,.05,.3,1)" },
      { transform: tf(dx * 0.36, dy * 0.36 - 26, 230, -5, -90, k0 + (1 - k0) * 0.42), offset: 0.55, easing: "cubic-bezier(.4,0,.3,1)" },
      { transform: tf(dx, dy, 120, 24, -90, 1), offset: 0.84, easing: "cubic-bezier(.3,0,.3,1)" },
      { transform: tf(dx, dy, 0, 0, -90, 1), offset: 1 },
    ];
    const d = duration;
    if (d <= 0) {
      onMid();
    } else {
      const anim = fly.animate(frames, { duration: d, fill: "forwards" });
      shadow.animate([{ opacity: 0, transform: "scale(.7)" }, { opacity: 0, transform: "scale(.7)", offset: 0.5 }, { opacity: 0.55, transform: "scale(1)" }], { duration: d, fill: "forwards", easing: "ease-out" });
      window.setTimeout(onMid, d * 0.62);
      this.scene.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: d, fill: "forwards", easing: "ease-in-out" });
      await anim.finished.catch(() => undefined);
    }
    this.finishPull(spine, fly, shadow);
  }

  private finishPull(spine: HTMLElement, fly: HTMLElement, shadow: HTMLElement): void {
    this.hide();
    fly.remove();
    shadow.remove();
    spine.style.visibility = "";
    this.scene.getAnimations().forEach((a) => a.cancel());
    this.scene.style.opacity = "";
    this.busy = false;
  }
}
