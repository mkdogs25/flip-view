import { setIcon } from "obsidian";
import { generateCover } from "../render/cover";
import { handFontInfo } from "../render/fonts";
import { Notebook, NotebookHost, ViewMode } from "../types";
import { clamp, hashString } from "../util/rng";
import { formatDate, iconButton } from "./dom";
import { LayoutConfig, LayoutEngine, NoteLayout } from "./layout";

export interface StageCallbacks {
  toggleSidebar(): void;
  toggleFocus(): void;
  modeChanged(mode: ViewMode): void;
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
    iconButton(right, "maximize", "Full screen", "fv-glass").addEventListener("click", () => this.cb.toggleFocus());
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
    this.book.createDiv({ cls: "fv-edge fv-edge-left" }).addEventListener("click", () => void this.prev());
    this.book.createDiv({ cls: "fv-edge fv-edge-right" }).addEventListener("click", () => void this.next());
    this.measure = this.wrap.createDiv({ cls: "fv-measure fv-page-inner" });
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
    iconButton(this.footerOpen, "file-text", "Open this note").addEventListener("click", (e) => {
      const n = this.currentNote();
      if (n) this.host.openNote(n.path, e.ctrlKey || e.metaKey);
    });
    this.toc = this.el.createDiv({ cls: "fv-toc fv-glass" });
    this.footTitle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleToc();
    });
    this.el.addEventListener("click", () => this.toc.removeClass("is-open"));

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
        if (this.toc.hasClass("is-open")) this.toc.removeClass("is-open");
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
    this.measureSizes();
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
      this.el.style.getPropertyValue("--fv-fs"),
    ].join("|");
    return { mode: s.viewMode, w: Math.round(iw), h: Math.round(ih), gap: 48, messiness: s.messiness, signature: sig };
  }

  private async getLayout(idx: number): Promise<NoteLayout> {
    const note = this.notebook?.notes[idx];
    if (!note) throw new Error("note index out of range");
    const timer = window.setTimeout(() => this.spinner.addClass("is-visible"), 220);
    try {
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

      const leaf = this.book.createDiv({ cls: `fv-leaf ${forward ? "fv-leaf-next" : "fv-leaf-prev"}` });
      const front = leaf.createDiv({ cls: "fv-leaf-face fv-face-front" });
      const back = leaf.createDiv({ cls: "fv-leaf-face fv-face-back" });
      front.createDiv({ cls: "fv-shade" });
      back.createDiv({ cls: "fv-shade" });
      const cast = this.book.createDiv({ cls: `fv-cast ${forward ? "fv-cast-right" : "fv-cast-left"}` });

      let landed: HTMLElement;
      if (forward) {
        this.rightBase.replaceChildren(target.pageEl(spread * 2 + 1, "right"));
        front.prepend(cur.pageEl(curSpread * 2 + 1, "right"));
        landed = target.pageEl(spread * 2, "left");
        back.prepend(landed);
      } else {
        this.leftBase.replaceChildren(target.pageEl(spread * 2, "left"));
        front.prepend(cur.pageEl(curSpread * 2, "left"));
        landed = target.pageEl(spread * 2 + 1, "right");
        back.prepend(landed);
      }
      const sign = forward ? -1 : 1;
      await this.animate(
        [
          [leaf, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${180 * sign}deg)` }], { duration: d, easing: EASE_PAGE }],
          [this.shadeOf(front), [{ opacity: 0 }, { opacity: 0.5 }], { duration: d * 0.5, easing: "ease-in" }],
          [this.shadeOf(back), [{ opacity: 0.5 }, { opacity: 0 }], { duration: d * 0.5, delay: d * 0.5, easing: "ease-out" }],
          [cast, [{ opacity: 0 }, { opacity: 0.7, offset: 0.5 }, { opacity: 0 }], { duration: d, easing: "ease-in-out" }],
        ],
        () => {
          (forward ? this.leftBase : this.rightBase).replaceChildren(landed);
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

  private onPageClick(e: MouseEvent): void {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    const href = a.getAttribute("data-href") ?? a.getAttribute("href");
    if (!href) return;
    const newTab = e.ctrlKey || e.metaKey;
    if (a.classList.contains("internal-link")) this.host.openLink(href, this.currentNote()?.path ?? "", newTab);
    else if (/^[a-z][a-z0-9+.-]*:/i.test(href)) this.host.openExternal(href);
    else if (href.startsWith("#")) return;
    else this.host.openLink(href, this.currentNote()?.path ?? "", newTab);
  }

  private countLabel(): string {
    const n = this.notebook?.notes.length ?? 0;
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
    const key = `${nb.id}|${seed}|${this.host.settings.coverStyle}`;
    if (key === this.coverKey) return;
    this.coverKey = key;
    const token = ++this.coverToken;
    this.cover.addClass("is-generating");
    window.setTimeout(() => {
      if (token !== this.coverToken || this.destroyed) return;
      try {
        const res = generateCover(seed, this.host.settings.coverStyle);
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
    this.lastEdit.toggleClass("is-visible", open && !!note && this.host.settings.showLastEdited);
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
