import { setIcon } from "obsidian";
import { generateCover } from "../render/cover";
import { handFontInfo } from "../render/fonts";
import { applyHighlight, highlightColor, removeHighlightEls, textOffsetOf } from "../render/highlights";
import { Sfx } from "../render/sound";
import { Highlight, Notebook, NotebookHost, ViewMode, isSeparator, realNoteCount } from "../types";
import { clamp, hashString } from "../util/rng";
import { formatDate, iconButton } from "./dom";
import { Laptop } from "./laptop";
import { Heading, LayoutConfig, LayoutEngine, NoteLayout } from "./layout";

export interface StageCallbacks {
  toggleSidebar(): void;
  toggleOutline(): void;
  toggleFocus(): void;
  modeChanged(mode: ViewMode): void;
  customiseCover(nb: Notebook): void;
  /** Open/closed state, current note or page changed. */
  stateChanged(): void;
  /** The user clicked an internal link inside a page. */
  followInternal(href: string, sourcePath: string): void;
}

function penCursor(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M3 25 L6 18 L18 4 L24 10 L10 22 Z' fill='${color}' stroke='#333' stroke-width='1.5' stroke-linejoin='round'/><path d='M3 25 L6 18 L9 21 Z' fill='#333'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 25, text`;
}

const PAGE_RATIO = 0.75; // width / height of one page
const EASE_COVER = "cubic-bezier(.55,.05,.25,1)";
const EASE_PAGE = "cubic-bezier(.45,.05,.3,1)";

type Anim = [HTMLElement, Keyframe[], KeyframeAnimationOptions];

/** The desk: draws the closed notebook, opens it with a 3D flip and turns pages. */
export class BookStage {
  readonly el: HTMLElement;
  private wrap: HTMLElement;
  private book: HTMLElement;
  private leftBase: HTMLElement;
  private rightBase: HTMLElement;
  private cover: HTMLElement;
  private coverFront: HTMLElement;
  private coverBack: HTMLElement;
  private plateTitle: HTMLElement;
  private plateCount: HTMLElement;
  private band: HTMLElement;
  private measure: HTMLElement;
  private spinner: HTMLElement;
  private toolbar: HTMLElement;
  private seg: HTMLElement;
  private btnClose: HTMLButtonElement;
  private btnShuffle: HTMLButtonElement;
  private btnCover: HTMLButtonElement;
  private btnOpenNote: HTMLButtonElement;
  private tray: HTMLElement;
  private laptop: Laptop;
  private drag: { update(x: number): void; release(): void } | null = null;
  private legend: HTMLElement;
  private sfx: Sfx;
  private activePen: number | null = null;
  private baselineKey = "";
  private footer: HTMLElement;
  private footerOpen: HTMLElement;
  private footTitle: HTMLButtonElement;
  private footCount: HTMLElement;
  private btnPrev: HTMLButtonElement;
  private btnNext: HTMLButtonElement;
  private toc: HTMLElement;
  private lastEdit: HTMLElement;
  private lastEditText: HTMLElement;
  private hint: HTMLElement;
  private engine: LayoutEngine;
  private ro: ResizeObserver;
  private resizeTimer = 0;

  private notebook: Notebook | null = null;
  private isOpen = false;
  private busy = false;
  private pendingRebuild = false;
  private noteIdx = 0;
  private spread = 0;
  private layout: NoteLayout | null = null;
  private metrics = { pw: 300, ph: 400, shift: -150 };
  private coverToken = 0;
  private coverKey = "";
  private destroyed = false;

  constructor(parent: HTMLElement, private host: NotebookHost, private cb: StageCallbacks) {
    this.el = parent.createDiv({ cls: "fv-stage" });

    // toolbar
    this.toolbar = this.el.createDiv({ cls: "fv-toolbar" });
    const left = this.toolbar.createDiv({ cls: "fv-toolbar-side fv-toolbar-left" });
    iconButton(left, "panel-left", "Toggle notebook list", "fv-glass").addEventListener("click", () => this.cb.toggleSidebar());
    this.seg = this.toolbar.createDiv({ cls: "fv-seg" });
    this.seg.createDiv({ cls: "fv-seg-thumb" });
    const mk = (mode: ViewMode, icon: string, label: string) => {
      const b = this.seg.createEl("button", { cls: "fv-seg-btn", attr: { type: "button", "data-mode": mode } });
      setIcon(b.createSpan({ cls: "fv-seg-icon" }), icon);
      b.createSpan({ text: label });
      b.addEventListener("click", () => this.setMode(mode));
    };
    mk("handwritten", "pencil", "Handwritten");
    mk("text", "type", "Text");
    const right = this.toolbar.createDiv({ cls: "fv-toolbar-side fv-toolbar-right" });
    this.btnShuffle = iconButton(right, "dices", "Shuffle cover design", "fv-glass");
    this.btnShuffle.addEventListener("click", () => this.shuffleCover());
    this.btnCover = iconButton(right, "palette", "Cover options", "fv-glass");
    this.btnCover.addEventListener("click", () => this.notebook && this.cb.customiseCover(this.notebook));
    iconButton(right, "maximize", "Full screen", "fv-glass").addEventListener("click", () => this.cb.toggleFocus());
    iconButton(right, "panel-right", "Toggle outline", "fv-glass").addEventListener("click", () => this.cb.toggleOutline());
    this.btnClose = iconButton(right, "x", "Close notebook", "fv-glass");
    this.btnClose.addEventListener("click", () => void this.close());

    // the book
    this.wrap = this.el.createDiv({ cls: "fv-bookwrap" });
    this.book = this.wrap.createDiv({ cls: "fv-book is-closed" });
    this.leftBase = this.book.createDiv({ cls: "fv-pagebase fv-left" });
    this.rightBase = this.book.createDiv({ cls: "fv-pagebase fv-right" });
    this.book.createDiv({ cls: "fv-gutter" });
    this.cover = this.book.createDiv({ cls: "fv-cover" });
    this.coverFront = this.cover.createDiv({ cls: "fv-cover-face fv-cover-front" });
    this.band = this.coverFront.createDiv({ cls: "fv-band" });
    const plate = this.coverFront.createDiv({ cls: "fv-plate" });
    this.plateTitle = plate.createDiv({ cls: "fv-plate-title" });
    const rule = plate.createDiv({ cls: "fv-plate-count" });
    rule.createSpan({ cls: "fv-plate-dash" });
    this.plateCount = rule.createSpan({ cls: "fv-plate-num" });
    rule.createSpan({ cls: "fv-plate-dash" });
    this.coverFront.createDiv({ cls: "fv-shade" });
    this.coverBack = this.cover.createDiv({ cls: "fv-cover-face fv-cover-back" });
    this.coverBack.createDiv({ cls: "fv-shade" });
    const edgeL = this.book.createDiv({ cls: "fv-edge fv-edge-left" });
    const edgeR = this.book.createDiv({ cls: "fv-edge fv-edge-right" });
    edgeL.addEventListener("click", () => this.host.settings.flipMode === "click" && void this.prev());
    edgeR.addEventListener("click", () => this.host.settings.flipMode === "click" && void this.next());
    edgeL.addEventListener("pointerdown", (e) => this.onEdgeDown(e, false));
    edgeR.addEventListener("pointerdown", (e) => this.onEdgeDown(e, true));
    this.measure = this.wrap.createDiv({ cls: "fv-measure fv-page-inner" });
    const lapWrap = this.el.createDiv({ cls: "fv-laptop-wrap" });
    this.laptop = new Laptop(lapWrap, { close: () => this.closeLaptop(), openExternal: (u) => this.host.openExternal(u) });
    this.spinner = this.wrap.createDiv({ cls: "fv-spinner" });

    this.coverFront.addEventListener("click", () => void this.open());
    this.cover.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        void this.open();
      }
    });
    this.coverFront.setAttr("role", "button");
    this.coverFront.setAttr("tabindex", "0");
    this.coverFront.setAttr("aria-label", "Open notebook");

    // delegated link handling inside pages (pages are clones, so no per-element listeners)
    this.book.addEventListener("click", (e) => this.onPageClick(e));

    // chrome
    this.lastEdit = this.el.createDiv({ cls: "fv-lastedit" });
    setIcon(this.lastEdit.createSpan({ cls: "fv-lastedit-icon" }), "clock");
    this.lastEditText = this.lastEdit.createDiv({ cls: "fv-lastedit-text" });
    this.hint = this.el.createDiv({ cls: "fv-hint" });

    this.footer = this.el.createDiv({ cls: "fv-footer" });
    this.footerOpen = this.footer.createDiv({ cls: "fv-footer-open fv-glass" });
    this.btnPrev = iconButton(this.footerOpen, "chevron-left", "Previous page");
    this.btnPrev.addEventListener("click", () => void this.prev());
    this.footTitle = this.footerOpen.createEl("button", { cls: "fv-foot-title", attr: { type: "button", "aria-label": "Contents" } });
    this.footCount = this.footerOpen.createSpan({ cls: "fv-foot-count" });
    this.btnNext = iconButton(this.footerOpen, "chevron-right", "Next page");
    this.btnNext.addEventListener("click", () => void this.next());
    this.btnOpenNote = iconButton(this.footerOpen, "file-text", "Open this note");
    this.btnOpenNote.addEventListener("click", (e) => {
      const n = this.currentNote();
      if (n) this.host.openNote(n.path, e.ctrlKey || e.metaKey);
    });
    this.toc = this.el.createDiv({ cls: "fv-toc fv-glass" });
    this.footTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleToc();
    });
    this.el.addEventListener("click", () => this.toc.removeClass("is-open"));

    this.tray = this.el.createDiv({ cls: "fv-tray" });
    this.legend = this.el.createDiv({ cls: "fv-legend" });
    this.sfx = new Sfx(() => host.settings);
    document.addEventListener("pointerup", this.onPointerUp);

    this.engine = new LayoutEngine(host, this.measure);
    this.ro = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => void this.rebuild(), 140);
    });
    this.ro.observe(this.el);
    this.applySettings(false);
    this.updateChrome();
  }

  /* ------------------------------------------------------------ public API */

  currentNote() {
    return this.notebook?.notes[this.noteIdx];
  }

  currentNotebook(): Notebook | null {
    return this.notebook;
  }

  /** Shows a notebook's closed cover (or refreshes it if it is already shown). */
  setNotebook(nb: Notebook | null): void {
    const same = nb && this.notebook && nb.id === this.notebook.id;
    if (same && nb) {
      this.updateNotebook(nb);
      return;
    }
    this.notebook = nb;
    this.resetClosed();
    this.renderCover();
    this.updateChrome();
  }

  /** Same notebook, but its notes changed. */
  private updateNotebook(nb: Notebook): void {
    const before = this.currentNote();
    this.notebook = nb;
    this.plateCount.setText(this.countLabel());
    if (this.isOpen) {
      if (nb.notes.length === 0) {
        void this.close(true);
      } else {
        const idx = before ? nb.notes.findIndex((n) => n.path === before.path) : -1;
        this.noteIdx = idx >= 0 ? idx : clamp(this.noteIdx, 0, nb.notes.length - 1);
        const now = nb.notes[this.noteIdx];
        if (!before || now.path !== before.path || now.mtime !== before.mtime) void this.rebuild();
      }
    }
    this.updateChrome();
  }

  async open(noteIdx = 0): Promise<void> {
    const nb = this.notebook;
    if (!nb || nb.notes.length === 0 || this.isOpen || this.busy) return;
    this.busy = true;
    this.book.addClass("is-busy");
    try {
      this.noteIdx = clamp(noteIdx, 0, nb.notes.length - 1);
      this.spread = 0;
      this.layout = await this.getLayout(this.noteIdx);
      this.fillBases();
      this.hint.removeClass("is-visible");
      const d = this.dur(1250);
      const { shift } = this.metrics;
      if (d > 0) {
        this.sfx.coverOpen(d);
        window.setTimeout(() => this.setBookState(true), d * 0.5);
        await this.animate(
          [
            [this.book, [{ transform: `translateX(${shift}px)` }, { transform: "translateX(0px)" }], { duration: d, easing: EASE_COVER }],
            [this.cover, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }], { duration: d, easing: EASE_COVER }],
            [this.shadeOf(this.coverFront), [{ opacity: 0 }, { opacity: 0.55 }], { duration: d * 0.5, easing: "ease-in" }],
            [this.shadeOf(this.coverBack), [{ opacity: 0.55 }, { opacity: 0 }], { duration: d * 0.5, delay: d * 0.5, easing: "ease-out" }],
          ],
          () => this.setBookState(true),
        );
      } else {
        this.setBookState(true);
      }
    } catch (err) {
      console.error("[flip-view] failed to open notebook", err);
      this.resetClosed();
    } finally {
      this.busy = false;
      this.book.removeClass("is-busy");
      this.updateChrome();
      this.flushPending();
    }
  }

  async close(instant = false): Promise<void> {
    if (!this.isOpen || this.busy) return;
    this.busy = true;
    this.book.addClass("is-busy");
    this.toc.removeClass("is-open");
    const d = instant ? 0 : this.dur(1100);
    const { shift } = this.metrics;
    if (d > 0) {
      this.sfx.coverClose(d);
      this.book.addClass("is-closing");
      this.setBookState(false);
      await this.animate(
        [
          [this.book, [{ transform: "translateX(0px)" }, { transform: `translateX(${shift}px)` }], { duration: d, easing: EASE_COVER }],
          [this.cover, [{ transform: "rotateY(-180deg)" }, { transform: "rotateY(0deg)" }], { duration: d, easing: EASE_COVER }],
          [this.shadeOf(this.coverBack), [{ opacity: 0 }, { opacity: 0.5 }], { duration: d * 0.5, easing: "ease-in" }],
          [this.shadeOf(this.coverFront), [{ opacity: 0.5 }, { opacity: 0 }], { duration: d * 0.5, delay: d * 0.5, easing: "ease-out" }],
        ],
        () => undefined,
      );
      this.book.removeClass("is-closing");
    }
    this.resetClosed();
    this.busy = false;
    this.book.removeClass("is-busy");
    this.updateChrome();
    this.flushPending();
  }

  async next(): Promise<void> {
    if (!this.notebook) return;
    if (!this.isOpen) return void this.open();
    if (!this.layout) return;
    if (this.spread + 1 < this.layout.spreads) await this.turnTo(this.noteIdx, this.spread + 1);
    else if (this.noteIdx + 1 < this.notebook.notes.length) await this.turnTo(this.noteIdx + 1, 0);
  }

  async prev(): Promise<void> {
    if (!this.notebook || !this.isOpen || !this.layout) return;
    if (this.spread > 0) await this.turnTo(this.noteIdx, this.spread - 1);
    else if (this.noteIdx > 0) await this.turnTo(this.noteIdx - 1, Number.MAX_SAFE_INTEGER);
    else await this.close();
  }

  async goToNote(idx: number): Promise<void> {
    if (!this.notebook) return;
    if (!this.isOpen) return void this.open(idx);
    await this.turnTo(idx, 0);
  }

  handleKey(e: KeyboardEvent): boolean {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return false;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return false;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
        void this.next();
        return true;
      case "ArrowLeft":
      case "PageUp":
        void this.prev();
        return true;
      case "Escape":
        if (this.laptop.isOpen) this.closeLaptop();
        else if (this.activePen !== null) this.selectPen(null);
        else if (this.toc.hasClass("is-open")) this.toc.removeClass("is-open");
        else if (this.isOpen) void this.close();
        else return false;
        return true;
      default:
        return false;
    }
  }

  /** Re-reads settings: theme-independent look, fonts, sizes. Rebuilds the visible spread. */
  applySettings(rebuild = true): void {
    const s = this.host.settings;
    this.el.toggleClass("fv-mode-hand", s.viewMode === "handwritten");
    this.el.toggleClass("fv-mode-text", s.viewMode === "text");
    for (const p of ["plain", "lined", "grid", "dotted"]) this.el.toggleClass(`fv-paper-${p}`, s.paperStyle === p);
    this.seg.setAttr("data-mode", s.viewMode);
    const body = handFontInfo(s.handFont);
    const head = s.headingFont === "same" ? body : handFontInfo(s.headingFont);
    this.el.style.setProperty("--fv-heading-font", `"${head.family}", "Segoe Print", "Bradley Hand", cursive`);
    this.el.style.setProperty("--fv-hscale", String(head.size / body.size));
    // small caps on a swash script is hard to read, so cursive headings stay in normal case
    const headingCase = head.cursive && s.headingCase === "smallcaps" ? "normal" : s.headingCase;
    for (const c of ["smallcaps", "normal", "uppercase"]) {
      this.el.toggleClass(`fv-hc-${c}`, headingCase === c);
      this.el.toggleClass(`fv-bc-${c}`, s.bodyCase === c);
    }
    for (const l of ["plate", "foil", "sticker"]) this.el.toggleClass(`fv-label-${l}`, s.coverLabel === l);
    this.el.toggleClass("fv-no-band", !s.coverBand);
    for (const m of ["click", "drag", "nav"]) this.el.toggleClass(`fv-flip-${m}`, s.flipMode === m);
    this.measureSizes();
    this.renderTools();
    if (this.notebook) this.renderCover();
    if (rebuild) void this.rebuild();
    this.updateChrome();
  }

  /** The note's text changed on disk; the next layout request re-renders it. */
  fileChanged(path: string): void {
    this.engine.invalidate(path);
  }

  destroy(): void {
    this.destroyed = true;
    document.removeEventListener("pointerup", this.onPointerUp);
    this.laptop.destroy();
    this.ro.disconnect();
    window.clearTimeout(this.resizeTimer);
    this.engine.invalidate();
    this.el.remove();
  }

  /* -------------------------------------------------------------- internals */

  private dur(ms: number): number {
    const a = this.host.settings.animation;
    if (a === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
    return a === "fast" ? ms * 0.5 : ms;
  }

  private shadeOf(face: HTMLElement): HTMLElement {
    return face.querySelector(".fv-shade") as HTMLElement;
  }

  private async animate(items: Anim[], commit: () => void): Promise<void> {
    const anims = items.map(([el, kf, o]) => el.animate(kf, { fill: "both", ...o }));
    await Promise.all(anims.map((a) => a.finished.catch(() => undefined)));
    commit();
    anims.forEach((a) => a.cancel());
  }

  private setBookState(open: boolean): void {
    this.isOpen = open;
    this.book.toggleClass("is-open", open);
    this.book.toggleClass("is-closed", !open);
  }

  /** Puts the book back into its resting, closed state without animation. */
  private resetClosed(): void {
    this.setBookState(false);
    this.busy = false;
    this.layout = null;
    this.noteIdx = 0;
    this.spread = 0;
    this.leftBase.empty();
    this.rightBase.empty();
    this.book.removeClass("is-busy");
    this.book.removeClass("is-closing");
    this.toc.removeClass("is-open");
  }

  private flushPending(): void {
    if (this.pendingRebuild && !this.destroyed) {
      this.pendingRebuild = false;
      void this.rebuild();
    }
  }

  private measureSizes(): void {
    const r = this.el.getBoundingClientRect();
    const s = this.host.settings;
    const topPad = 76;
    const botPad = 84;
    const side = 40;
    let ph = Math.min(r.height - topPad - botPad, 980);
    let pw = ph * PAGE_RATIO;
    const maxW = (r.width - side * 2) / 2;
    if (pw > maxW) {
      pw = maxW;
      ph = pw / PAGE_RATIO;
    }
    ph = Math.max(ph, 180);
    pw = ph * PAGE_RATIO;
    const scale = ph / 660;
    const pt = ph * 0.085;
    const pb = ph * 0.1;
    const px = pw * 0.11;
    let fs: number;
    let lh: number;
    if (s.viewMode === "handwritten") {
      const info = handFontInfo(s.handFont);
      fs = 24 * scale * (s.handSize / 100) * info.size;
      lh = 31 * scale * (s.handSize / 100) * info.line;
    } else {
      fs = 15.5 * scale * (s.textSize / 100);
      lh = fs * 1.62;
    }
    const st = this.el.style;
    st.setProperty("--fv-pw", `${pw}px`);
    st.setProperty("--fv-ph", `${ph}px`);
    st.setProperty("--fv-pt", `${pt}px`);
    st.setProperty("--fv-pb", `${pb}px`);
    st.setProperty("--fv-px", `${px}px`);
    st.setProperty("--fv-iw", `${pw - px * 2}px`);
    st.setProperty("--fv-ih", `${ph - pt - pb}px`);
    st.setProperty("--fv-s", String(scale));
    st.setProperty("--fv-fs", `${fs}px`);
    st.setProperty("--fv-lh", `${lh}px`);
    st.setProperty("--fv-shift", `${-pw / 2}px`);
    this.metrics = { pw, ph, shift: -pw / 2 };
    this.placeLegend();
    this.updateLaptopLayout();
  }

  private layoutConfig(): LayoutConfig {
    const s = this.host.settings;
    const iw = this.metrics.pw - this.metrics.pw * 0.11 * 2;
    const ih = this.metrics.ph - this.metrics.ph * 0.185;
    const sig = [
      s.handFont,
      s.handSize,
      s.textFont,
      s.textSize,
      s.paperStyle,
      s.showNoteTitle,
      s.inkColor,
      s.accentColor,
      s.headingFont,
      s.headingCase,
      s.bodyCase,
      s.highlighters.map((h) => h.color).join(","),
      this.el.style.getPropertyValue("--fv-fs"),
    ].join("|");
    const tame = s.paperStyle === "plain" ? 1 : 0.2;
    return { mode: s.viewMode, w: Math.round(iw), h: Math.round(ih), gap: 48, messiness: s.messiness, tame, signature: sig };
  }

  private async getLayout(idx: number): Promise<NoteLayout> {
    const note = this.notebook?.notes[idx];
    if (!note) throw new Error("note index out of range");
    const timer = window.setTimeout(() => this.spinner.addClass("is-visible"), 220);
    try {
      await this.ensureBaseline();
      return await this.engine.get(note, this.layoutConfig());
    } finally {
      window.clearTimeout(timer);
      this.spinner.removeClass("is-visible");
    }
  }

  private fillBases(): void {
    if (!this.layout) return;
    this.leftBase.replaceChildren(this.layout.pageEl(this.spread * 2, "left"));
    this.rightBase.replaceChildren(this.layout.pageEl(this.spread * 2 + 1, "right"));
  }

  /** Re-measures and redraws the current spread (resize, mode switch, settings, file edit). */
  private async rebuild(): Promise<void> {
    if (this.destroyed) return;
    if (this.busy) {
      this.pendingRebuild = true;
      return;
    }
    this.measureSizes();
    if (!this.isOpen || !this.notebook) return;
    this.busy = true;
    try {
      const prevPages = this.layout ? this.layout.pageCount : 0;
      this.layout = await this.getLayout(this.noteIdx);
      if (prevPages && this.layout.pageCount !== prevPages) {
        // keep roughly the same reading position
        this.spread = clamp(Math.round((this.spread / Math.max(1, Math.ceil(prevPages / 2))) * this.layout.spreads), 0, this.layout.spreads - 1);
      }
      this.spread = clamp(this.spread, 0, this.layout.spreads - 1);
      this.fillBases();
    } catch (err) {
      console.error("[flip-view] failed to rebuild pages", err);
    } finally {
      this.busy = false;
      this.updateChrome();
      this.flushPending();
    }
  }

  private async setMode(mode: ViewMode): Promise<void> {
    if (this.host.settings.viewMode === mode) return;
    this.cb.modeChanged(mode);
  }

  private async turnTo(noteIdx: number, spreadWanted: number): Promise<void> {
    if (this.busy || !this.isOpen || !this.notebook || !this.layout) return;
    if (noteIdx < 0 || noteIdx >= this.notebook.notes.length) return;
    this.busy = true;
    this.book.addClass("is-busy");
    this.toc.removeClass("is-open");
    try {
      const target = await this.getLayout(noteIdx);
      const spread = clamp(spreadWanted, 0, target.spreads - 1);
      if (noteIdx === this.noteIdx && spread === this.spread) return;
      const forward = noteIdx > this.noteIdx || (noteIdx === this.noteIdx && spread > this.spread);
      const cur = this.layout;
      const curSpread = this.spread;
      const d = this.dur(900);

      if (d === 0) {
        this.layout = target;
        this.noteIdx = noteIdx;
        this.spread = spread;
        this.fillBases();
        return;
      }

      this.sfx.pageTurn(d);
      const { leaf, front, back, cast, land, sign } = this.makeLeaf(forward, target, spread);
      await this.animate(
        [
          [leaf, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${180 * sign}deg)` }], { duration: d, easing: EASE_PAGE }],
          [this.shadeOf(front), [{ opacity: 0 }, { opacity: 0.5 }], { duration: d * 0.5, easing: "ease-in" }],
          [this.shadeOf(back), [{ opacity: 0.5 }, { opacity: 0 }], { duration: d * 0.5, delay: d * 0.5, easing: "ease-out" }],
          [cast, [{ opacity: 0 }, { opacity: 0.7, offset: 0.5 }, { opacity: 0 }], { duration: d, easing: "ease-in-out" }],
        ],
        () => {
          land();
          leaf.remove();
          cast.remove();
        },
      );
      this.layout = target;
      this.noteIdx = noteIdx;
      this.spread = spread;
    } catch (err) {
      console.error("[flip-view] failed to turn page", err);
    } finally {
      this.book.querySelectorAll(".fv-leaf, .fv-cast").forEach((n) => n.remove());
      this.busy = false;
      this.book.removeClass("is-busy");
      this.updateChrome();
      this.flushPending();
    }
  }

  /** Builds the turning leaf (faces, shading) and swaps the page underneath, ready to be rotated. */
  private makeLeaf(forward: boolean, target: NoteLayout, spread: number) {
    const cur = this.layout as NoteLayout;
    const curSpread = this.spread;
    const leaf = this.book.createDiv({ cls: `fv-leaf ${forward ? "fv-leaf-next" : "fv-leaf-prev"}` });
    const front = leaf.createDiv({ cls: "fv-leaf-face fv-face-front" });
    const back = leaf.createDiv({ cls: "fv-leaf-face fv-face-back" });
    front.createDiv({ cls: "fv-shade" });
    back.createDiv({ cls: "fv-shade" });
    const cast = this.book.createDiv({ cls: `fv-cast ${forward ? "fv-cast-right" : "fv-cast-left"}` });
    let land: () => void;
    let undo: () => void;
    if (forward) {
      const old = this.rightBase.firstElementChild;
      this.rightBase.replaceChildren(target.pageEl(spread * 2 + 1, "right"));
      front.prepend(cur.pageEl(curSpread * 2 + 1, "right"));
      const landed = target.pageEl(spread * 2, "left");
      back.prepend(landed);
      land = () => this.leftBase.replaceChildren(landed);
      undo = () => old && this.rightBase.replaceChildren(old);
    } else {
      const old = this.leftBase.firstElementChild;
      this.leftBase.replaceChildren(target.pageEl(spread * 2, "left"));
      front.prepend(cur.pageEl(curSpread * 2, "left"));
      const landed = target.pageEl(spread * 2 + 1, "right");
      back.prepend(landed);
      land = () => this.rightBase.replaceChildren(landed);
      undo = () => old && this.leftBase.replaceChildren(old);
    }
    return { leaf, front, back, cast, land, undo, sign: forward ? -1 : 1 };
  }

  /* ------------------------------------------------ pulling a page to flip */

  private onEdgeDown(e: PointerEvent, forward: boolean): void {
    if (e.button !== 0 || this.busy || this.activePen !== null || this.host.settings.flipMode !== "drag") return;
    e.preventDefault();
    const startX = e.clientX;
    let x = startX;
    let moved = false;
    let released = false;
    const onMove = (ev: PointerEvent) => {
      x = ev.clientX;
      if (!moved && Math.abs(x - startX) > 6) {
        moved = true;
        void this.startDrag(forward, startX, () => x, () => released);
      }
      this.drag?.update(x);
    };
    const onUp = () => {
      released = true;
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
      if (!moved) void (forward ? this.next() : this.prev());
      else this.drag?.release();
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  private async startDrag(forward: boolean, startX: number, currentX: () => number, isReleased: () => boolean): Promise<void> {
    if (this.busy || !this.isOpen || !this.notebook || !this.layout) return;
    let tNote = this.noteIdx;
    let tSpread = this.spread + (forward ? 1 : -1);
    if (tSpread >= this.layout.spreads || tSpread < 0) {
      tNote += forward ? 1 : -1;
      tSpread = forward ? 0 : Number.MAX_SAFE_INTEGER;
    }
    if (tNote < 0 || tNote >= this.notebook.notes.length) return;
    this.busy = true;
    this.book.addClass("is-busy");
    this.toc.removeClass("is-open");
    let parts: ReturnType<BookStage["makeLeaf"]> | null = null;
    try {
      const target = await this.getLayout(tNote);
      const spread = clamp(tSpread, 0, target.spreads - 1);
      parts = this.makeLeaf(forward, target, spread);
      const p = parts;
      const pw = this.metrics.pw;
      let progress = 0;
      const apply = (x: number) => {
        const dx = forward ? startX - x : x - startX;
        progress = clamp(dx / (pw * 1.5), 0, 1);
        p.leaf.style.transform = `rotateY(${p.sign * 180 * progress}deg)`;
        this.shadeOf(p.front).style.opacity = String(progress * 0.55);
        this.shadeOf(p.back).style.opacity = String((1 - progress) * 0.55);
        p.cast.style.opacity = String(Math.sin(progress * Math.PI) * 0.7);
      };
      apply(currentX());
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          this.drag = null;
          resolve();
        };
        this.drag = { update: apply, release: finish };
        if (isReleased()) finish();
      });
      const complete = progress > 0.35;
      const from = p.sign * 180 * progress;
      const to = complete ? p.sign * 180 : 0;
      const d = this.dur(650) * Math.max(0.3, complete ? 1 - progress : progress);
      if (complete) this.sfx.pageTurn(d * 1.4);
      if (d > 0) {
        p.leaf.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }], { duration: d, easing: "ease-out", fill: "both" });
        this.shadeOf(p.front).style.transition = `opacity ${d}ms`;
        this.shadeOf(p.back).style.transition = `opacity ${d}ms`;
        this.shadeOf(p.front).style.opacity = complete ? "0.55" : "0";
        this.shadeOf(p.back).style.opacity = complete ? "0" : "0.55";
        p.cast.style.transition = `opacity ${d}ms`;
        p.cast.style.opacity = "0";
        await new Promise((r) => window.setTimeout(r, d));
      }
      if (complete) {
        p.land();
        this.layout = target;
        this.noteIdx = tNote;
        this.spread = spread;
      } else {
        p.undo();
      }
    } catch (err) {
      console.error("[flip-view] drag turn failed", err);
      parts?.undo();
    } finally {
      this.drag = null;
      this.book.querySelectorAll(".fv-leaf, .fv-cast").forEach((n) => n.remove());
      this.busy = false;
      this.book.removeClass("is-busy");
      this.updateChrome();
      this.flushPending();
    }
  }

  /* ------------------------------------------------------------ the laptop */

  private showLaptop(url: string): void {
    this.laptop.open(url);
    this.el.addClass("is-laptop");
    this.updateLaptopLayout();
    this.sfx.pen(true);
  }

  private closeLaptop(): void {
    this.laptop.close();
    this.el.removeClass("is-laptop");
    this.updateLaptopLayout();
  }

  /** Sizes the laptop and works out how far (and how small) the notebook shifts to make room for it. */
  private updateLaptopLayout(): void {
    const r = this.el.getBoundingClientRect();
    if (r.width === 0) return;
    const full = r.width < 700;
    const availH = r.height - 76 - 84 - 10;
    let lw = full ? r.width * 0.94 : Math.min(r.width * 0.5, 880);
    lw = Math.max(280, Math.min(lw, availH / 0.72));
    const space = Math.max(120, r.width - lw * 0.92 - r.width * 0.03 - 12); // the laptop may overlap the book a little
    const bookW = this.isOpen ? this.metrics.pw * 2 : this.metrics.pw;
    const scale = clamp((space - 16) / bookW, 0.4, 1);
    const shift = space / 2 + 6 - r.width / 2;
    const st = this.el.style;
    st.setProperty("--fv-lw", `${lw}px`);
    st.setProperty("--fv-lscale", String(scale));
    st.setProperty("--fv-lshift", `${shift}px`);
    this.el.toggleClass("fv-laptop-full", full);
  }

  /* ------------------------------------------------------------ following links */

  /** Jumps to a note (and optionally one of its headings) in this notebook, opening the book if needed. */
  async goTo(idx: number, heading?: string): Promise<void> {
    if (!this.notebook || idx < 0 || idx >= this.notebook.notes.length) return;
    let page = 0;
    if (heading) {
      const layout = await this.getLayout(idx);
      const norm = (t: string) => t.trim().toLowerCase();
      const hit = layout.headings.find((h) => norm(h.text) === norm(heading));
      if (hit) page = hit.page;
    }
    const spread = Math.floor(page / 2);
    if (!this.isOpen) {
      await this.open(idx);
      if (spread > 0) await this.turnTo(idx, spread);
    } else {
      await this.turnTo(idx, spread);
    }
  }

  private onPageClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    const hl = target.closest<HTMLElement>(".fv-hl");
    if (hl && this.activePen !== null && window.getSelection()?.isCollapsed !== false) {
      e.preventDefault();
      if (hl.dataset.hl) this.removeHighlight(hl.dataset.hl);
      return;
    }
    const a = target.closest("a");
    if (!a) {
      this.maybeFlipOnClick(e, target);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const href = a.getAttribute("data-href") ?? a.getAttribute("href");
    if (!href) return;
    const source = this.currentNote()?.path ?? "";
    const newTab = e.ctrlKey || e.metaKey;
    const isUrl = /^[a-z][a-z0-9+.-]*:/i.test(href);
    if (isUrl) {
      if (/^https?:/i.test(href) && !newTab) this.showLaptop(href);
      else this.host.openExternal(href);
    } else if (newTab) {
      this.host.openLink(href, source, true);
    } else if (href.startsWith("#")) {
      const i = this.noteIdx;
      void this.goTo(i, href.slice(1).split("#").pop());
    } else {
      this.cb.followInternal(href, source);
    }
  }

  /** "Click a page" mode: the left page goes back, the right page goes forward. */
  private maybeFlipOnClick(e: MouseEvent, target: HTMLElement): void {
    if (this.host.settings.flipMode !== "click" || !this.isOpen || this.busy || this.activePen !== null) return;
    if (e.detail > 1 || window.getSelection()?.isCollapsed === false) return;
    if (target.closest("input, button, summary, textarea, select, .fv-edge, .fv-sep-tab")) return;
    const r = this.book.getBoundingClientRect();
    void (e.clientX < r.left + r.width / 2 ? this.prev() : this.next());
  }

  private countLabel(): string {
    const n = this.notebook ? realNoteCount(this.notebook) : 0;
    return `${n} ${n === 1 ? "note" : "notes"}`;
  }

  private seedFor(nb: Notebook): number {
    const { coverSeeds, coverSalt } = this.host.settings;
    return coverSeeds[nb.id] ?? hashString(coverSalt ? `${nb.id}#${coverSalt}` : nb.id);
  }

  private shuffleCover(): void {
    const nb = this.notebook;
    if (!nb || this.isOpen) return;
    this.host.settings.coverSeeds[nb.id] = (Math.random() * 0xffffffff) >>> 0;
    this.host.saveSettings();
    this.renderCover();
  }

  private renderCover(): void {
    const nb = this.notebook;
    this.cover.toggleClass("is-empty", !nb);
    if (!nb) return;
    this.plateTitle.setText(nb.name);
    const len = nb.name.length;
    this.plateTitle.setAttr("data-size", len <= 9 ? "l" : len <= 16 ? "m" : len <= 26 ? "s" : "xs");
    this.plateCount.setText(this.countLabel());
    const seed = this.seedFor(nb);
    const ov = this.host.settings.coverOverrides[nb.id];
    const style = ov?.style ?? this.host.settings.coverStyle;
    const color = ov?.color ?? this.host.settings.coverColor;
    const key = `${nb.id}|${seed}|${style}|${color}`;
    if (key === this.coverKey) return;
    this.coverKey = key;
    const token = ++this.coverToken;
    this.cover.addClass("is-generating");
    window.setTimeout(() => {
      if (token !== this.coverToken || this.destroyed) return;
      try {
        const res = generateCover(seed, style, color);
        this.coverFront.style.backgroundImage = `url(${res.url})`;
        this.coverFront.style.setProperty("--fv-cover-base", res.base);
        this.coverFront.style.setProperty("--fv-cover-dark", res.dark);
        this.coverFront.style.setProperty("--fv-cover-light", res.light);
        this.coverBack.style.setProperty("--fv-cover-base", res.base);
        this.coverBack.style.setProperty("--fv-cover-dark", res.dark);
        this.coverBack.style.setProperty("--fv-cover-light", res.light);
        this.cover.setAttr("data-cover", res.style);
      } catch (err) {
        console.error("[flip-view] cover generation failed", err);
      }
      this.cover.removeClass("is-generating");
    }, 16);
  }

  /* ------------------------------------------------------------------ chrome */

  private updateChrome(): void {
    const nb = this.notebook;
    const open = this.isOpen;
    this.btnClose.toggleClass("is-hidden", !open);
    this.btnShuffle.toggleClass("is-hidden", open || !nb);
    this.footerOpen.toggleClass("is-hidden", !open);
    this.hint.setText(nb && nb.notes.length === 0 ? "This notebook has no notes yet" : "Click the cover to open");
    this.hint.toggleClass("is-visible", !open && !!nb && !this.busy);
    this.el.toggleClass("is-book-open", open);
    this.seg.setAttr("data-mode", this.host.settings.viewMode);

    const note = this.currentNote();
    const sep = isSeparator(note);
    this.btnCover.toggleClass("is-hidden", open || !nb);
    this.btnOpenNote.toggleClass("is-hidden", sep);
    this.lastEdit.toggleClass("is-visible", open && !!note && !sep && this.host.settings.showLastEdited);
    if (note) {
      this.lastEditText.empty();
      this.lastEditText.createDiv({ text: "Last edited:" });
      this.lastEditText.createDiv({ text: formatDate(note.mtime) });
    }
    if (open && note && this.notebook) {
      this.footTitle.setText(note.title);
      this.footCount.setText(`${this.noteIdx + 1} / ${this.notebook.notes.length}`);
      this.btnNext.disabled = !this.layout || (this.noteIdx >= this.notebook.notes.length - 1 && this.spread >= this.layout.spreads - 1);
      this.btnPrev.disabled = false;
      this.btnPrev.setAttr("aria-label", this.noteIdx === 0 && this.spread === 0 ? "Close notebook" : "Previous page");
    }
    this.cover.toggleClass("is-empty", !nb || nb.notes.length === 0);
    this.updateLaptopLayout();
    this.cb.stateChanged();
  }

  /* ------------------------------------------------------- outline support */

  isBookOpen(): boolean {
    return this.isOpen;
  }

  currentIndex(): number {
    return this.isOpen ? this.noteIdx : -1;
  }

  currentHeadings(): Heading[] {
    return this.isOpen && this.layout ? this.layout.headings : [];
  }

  /** Highlights on the open note, with the page each one is on when known. */
  currentHighlights(): Array<{ h: Highlight; color: string; page: number | undefined }> {
    const note = this.currentNote();
    if (!this.isOpen || !note || isSeparator(note)) return [];
    const s = this.host.settings;
    return (s.highlights[note.path] ?? []).map((h) => ({ h, color: highlightColor(h, s.highlighters), page: this.layout?.hlPages.get(h.id) }));
  }

  async jumpToPage(noteIdx: number, page: number): Promise<void> {
    if (!this.notebook) return;
    const spread = Math.floor(page / 2);
    if (!this.isOpen) {
      await this.open(noteIdx);
      if (spread > 0) await this.turnTo(noteIdx, spread);
    } else {
      await this.turnTo(noteIdx, spread);
    }
  }

  /* ---------------------------------------------- baseline of ruled paper */

  /** Measures where the handwriting font's baseline sits inside a ruled line so the rules can run under the words. */
  private async ensureBaseline(): Promise<void> {
    const s = this.host.settings;
    if (s.viewMode !== "handwritten") return;
    const fam = handFontInfo(s.handFont).family;
    const key = `${fam}|${this.el.style.getPropertyValue("--fv-fs")}|${this.el.style.getPropertyValue("--fv-lh")}`;
    if (key === this.baselineKey) return;
    try {
      await document.fonts.load(`20px "${fam}"`);
    } catch {
      /* ignore */
    }
    const probe = this.measure.createDiv({ cls: "fv-flow" });
    probe.style.cssText = "width:300px;height:auto;column-width:auto;position:absolute;left:0;top:0";
    const line = probe.createDiv();
    line.setText("Hxg");
    const mark = line.createSpan();
    mark.style.cssText = "display:inline-block;width:1px;height:0;vertical-align:baseline";
    const base = mark.getBoundingClientRect().top - line.getBoundingClientRect().top;
    probe.remove();
    const lh = parseFloat(this.el.style.getPropertyValue("--fv-lh")) || 30;
    if (base > 0 && base < lh * 1.4) this.el.style.setProperty("--fv-base", `${base}px`);
    this.baselineKey = key;
  }

  /* ------------------------------------------------ highlighter & legend */

  private renderTools(): void {
    const s = this.host.settings;
    const n = s.highlighters.length;
    if (this.activePen !== null && this.activePen >= n) this.activePen = null;
    this.el.toggleClass("is-highlighting", this.activePen !== null);
    this.tray.empty();
    s.highlighters.forEach((p, i) => {
      const pen = this.tray.createEl("button", { cls: "fv-pen", attr: { type: "button", "aria-label": `Highlighter: ${p.label || p.color}`, title: p.label || p.color } });
      pen.style.setProperty("--pen", p.color);
      pen.style.setProperty("--r", `${(i - (n - 1) / 2) * 4}deg`);
      pen.toggleClass("is-active", i === this.activePen);
      pen.createDiv({ cls: "fv-pen-cap" });
      pen.createDiv({ cls: "fv-pen-body" });
      pen.createDiv({ cls: "fv-pen-tip" });
      pen.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectPen(i);
      });
    });

    this.legend.empty();
    const show = s.showLegend && n > 0;
    this.legend.toggleClass("is-hidden", !show);
    if (!show) return;
    this.legend.createDiv({ cls: "fv-legend-strip" });
    const grip = this.legend.createDiv({ cls: "fv-legend-title", text: "Legend" });
    grip.addEventListener("pointerdown", (e) => this.dragLegend(e));
    s.highlighters.forEach((p, i) => {
      const row = this.legend.createEl("button", { cls: "fv-legend-row", attr: { type: "button" } });
      row.toggleClass("is-active", i === this.activePen);
      row.style.setProperty("--tilt", `${((i * 5 + 3) % 5) - 2}deg`);
      row.appendChild(this.scribble(p.color, i));
      row.createSpan({ cls: "fv-legend-label", text: p.label || p.color });
      row.addEventListener("click", () => this.selectPen(i));
    });
    this.placeLegend();
  }

  /** A hand-drawn marker stroke in the pen's colour, a little different for each row. */
  private scribble(color: string, i: number): SVGElement {
    const ns = "http://www.w3.org/2000/svg";
    const j = (n: number) => ((i * 7 + n * 13) % 5) - 2;
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 44 16");
    svg.setAttribute("width", "44");
    svg.setAttribute("height", "16");
    svg.classList.add("fv-legend-mark");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M4 ${6 + j(1)} Q 20 ${3 + j(2)} 40 ${6 + j(3)} M5 ${10 + j(4)} Q 24 ${13 + j(5)} 39 ${9 + j(6)}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "7");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", "0.9");
    svg.appendChild(path);
    return svg;
  }

  private placeLegend(): void {
    const pos = this.host.settings.legendPos;
    const r = this.el.getBoundingClientRect();
    if (pos && r.width > 0) {
      const x = clamp(pos.x * r.width, 0, Math.max(0, r.width - 150));
      const y = clamp(pos.y * r.height, 0, Math.max(0, r.height - 90));
      this.legend.style.left = `${x}px`;
      this.legend.style.top = `${y}px`;
      this.legend.style.bottom = "auto";
    } else {
      this.legend.style.removeProperty("left");
      this.legend.style.removeProperty("top");
      this.legend.style.removeProperty("bottom");
    }
  }

  private dragLegend(e: PointerEvent): void {
    e.preventDefault();
    const stage = this.el.getBoundingClientRect();
    const box = this.legend.getBoundingClientRect();
    const dx = e.clientX - box.left;
    const dy = e.clientY - box.top;
    this.legend.addClass("is-dragging");
    const move = (ev: PointerEvent) => {
      const x = clamp(ev.clientX - dx - stage.left, 0, stage.width - box.width);
      const y = clamp(ev.clientY - dy - stage.top, 0, stage.height - box.height);
      this.legend.style.left = `${x}px`;
      this.legend.style.top = `${y}px`;
      this.legend.style.bottom = "auto";
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      this.legend.removeClass("is-dragging");
      this.host.settings.legendPos = {
        x: (parseFloat(this.legend.style.left) || 0) / stage.width,
        y: (parseFloat(this.legend.style.top) || 0) / stage.height,
      };
      this.host.saveSettings();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }

  private selectPen(i: number | null): void {
    const pens = this.host.settings.highlighters;
    if (i === this.activePen) i = null;
    this.activePen = i;
    if (i !== null && pens[i]) {
      this.el.style.setProperty("--fv-hl-active", pens[i].color);
      this.el.style.setProperty("--fv-pen-cursor", penCursor(pens[i].color));
    }
    this.sfx.pen(i !== null);
    this.renderTools();
  }

  private onPointerUp = (): void => {
    if (this.activePen === null || !this.isOpen || this.busy) return;
    window.setTimeout(() => this.commitSelection(), 0);
  };

  /** Turns the text the user just dragged over into a saved highlight in the active pen's colour. */
  private commitSelection(): void {
    const slot = this.activePen;
    const sel = window.getSelection();
    const note = this.currentNote();
    if (slot === null || !sel || sel.isCollapsed || sel.rangeCount === 0 || !note || !this.layout || this.layout.separator) return;
    const range = sel.getRangeAt(0);
    const anc = range.commonAncestorContainer;
    const host = anc instanceof Element ? anc : anc.parentElement;
    const flow = host?.closest<HTMLElement>(".fv-flow");
    if (!flow || !this.book.contains(flow) || flow.closest(".fv-leaf")) return;
    const text = flow.textContent ?? "";
    let start = textOffsetOf(flow, range.startContainer, range.startOffset);
    let end = textOffsetOf(flow, range.endContainer, range.endOffset);
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end <= start) return;
    sel.removeAllRanges();
    const pen = this.host.settings.highlighters[slot];
    if (!pen) return;
    const h: Highlight = { id: Math.random().toString(36).slice(2, 10), start, end, quote: text.slice(start, end), slot, color: pen.color };
    (this.host.settings.highlights[note.path] ??= []).push(h);
    this.host.saveSettings();
    this.layout.addHighlight(h, pen.color, Number(flow.dataset.page ?? 0));
    this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-flow").forEach((f) => applyHighlight(f, h, pen.color));
    this.sfx.marker(h.quote.length);
    this.cb.stateChanged();
  }

  removeHighlight(id: string): void {
    const note = this.currentNote();
    if (!note) return;
    const list = this.host.settings.highlights[note.path];
    if (list) {
      const next = list.filter((h) => h.id !== id);
      if (next.length) this.host.settings.highlights[note.path] = next;
      else delete this.host.settings.highlights[note.path];
    }
    this.host.saveSettings();
    this.layout?.removeHighlight(id);
    this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-flow").forEach((f) => removeHighlightEls(f, id));
    this.sfx.erase();
    this.cb.stateChanged();
  }

  tick(): void {
    this.sfx.tick();
  }

  private toggleToc(): void {
    if (!this.notebook) return;
    if (this.toc.hasClass("is-open")) {
      this.toc.removeClass("is-open");
      return;
    }
    this.toc.empty();
    this.toc.createDiv({ cls: "fv-toc-head", text: this.notebook.name });
    const list = this.toc.createDiv({ cls: "fv-toc-list" });
    this.notebook.notes.forEach((n, i) => {
      const row = list.createEl("button", { cls: "fv-toc-row", attr: { type: "button" } });
      row.toggleClass("is-current", i === this.noteIdx);
      row.createSpan({ cls: "fv-toc-num", text: String(i + 1) });
      row.createSpan({ cls: "fv-toc-name", text: n.title });
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toc.removeClass("is-open");
        void this.goToNote(i);
      });
    });
    this.toc.addClass("is-open");
    list.querySelector(".is-current")?.scrollIntoView({ block: "center" });
  }
}
