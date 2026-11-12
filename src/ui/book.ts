import { setIcon } from "obsidian";
import { generateCover } from "../render/cover";
import { handFontInfo } from "../render/fonts";
import { applyHighlight, highlightColor, removeHighlightEls, textOffsetOf } from "../render/highlights";
import { Sfx } from "../render/sound";
import { notebookProgress, noteStatus } from "../progress";
import { Annotation, Bookmark, Highlight, NoteRef, Notebook, NotebookHost, ViewMode, WriteTool, isIndex, isNote, isSeparator, realNoteCount } from "../types";
import { clamp, hashString } from "../util/rng";
import { formatDate, iconButton, progressEl } from "./dom";
import { Laptop } from "./laptop";
import { resolveLook } from "./coverStyle";
import { ensureInkLayer, makeStrokeEl, renderInk, strokePath } from "./ink";
import { Heading, IndexData, LayoutConfig, LayoutEngine, NoteLayout } from "./layout";
import { PageTally } from "./tally";
import { penSvg } from "./pens";
import { propEl } from "./props";

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
  /** A real note is now on show (for reading progress). */
  noteVisited(note: NoteRef, spread: number, spreads: number): void;
  bookmarksChanged(): void;
  shelfRequested(): void;
  searchRequested(): void;
  openSettings(): void;
  toggleShelfVisible(): void;
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
  private plateProg: HTMLElement;
  private band: HTMLElement;
  private measure: HTMLElement;
  private spinner: HTMLElement;
  private toolbar: HTMLElement;
  private seg: HTMLElement;
  private btnClose: HTMLButtonElement;
  private btnShuffle: HTMLButtonElement;
  private btnCover: HTMLButtonElement;
  private btnOpenNote: HTMLButtonElement;
  private btnEdit: HTMLButtonElement;
  private editor: HTMLElement | null = null;
  private tray: HTMLElement;
  private moreMenu: HTMLElement;
  private tabsEl: HTMLElement;
  private scene = { on: false, strip: 0 };
  private insets = { top: 76, bottom: 84 };
  private laptop: Laptop;
  private drag: { update(x: number): void; release(): void } | null = null;
  private legend: HTMLElement;
  private sfx: Sfx;
  private activePen: number | null = null;
  private baselineKey = "";
  private tally = new PageTally();
  private shownKey = "";
  private crawlToken = 0;
  private indexTimer = 0;
  private writeTool: WriteTool | null = null;
  private wtray: HTMLElement;
  private ribbonEl: HTMLElement;
  private btnBookmark: HTMLButtonElement;
  private hlPop: HTMLElement;
  private metricsEx = { iw: 240, ih: 320, pin: 30, pout: 30, mw: 0 };
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
    iconButton(left, "panel-left", "Toggle notebook list", "fv-glass fv-tb-extra").addEventListener("click", () => this.cb.toggleSidebar());
    iconButton(left, "library-big", "Show the shelf", "fv-glass fv-btn-shelf fv-tb-extra").addEventListener("click", () => this.cb.shelfRequested());
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
    const right = this.toolbar.createDiv({ cls: "fv-toolbar-side fv-toolbar-right fv-tgroup" });
    this.btnBookmark = iconButton(right, "bookmark", "Bookmark this page", "fv-glass");
    this.btnBookmark.addEventListener("click", () => this.toggleBookmark());
    iconButton(right, "search", "Find a note", "fv-glass fv-btn-search").addEventListener("click", () => this.cb.searchRequested());
    this.btnShuffle = iconButton(right, "dices", "Shuffle cover design", "fv-glass fv-tb-extra");
    this.btnShuffle.addEventListener("click", () => this.shuffleCover());
    this.btnCover = iconButton(right, "palette", "Cover options", "fv-glass fv-tb-extra");
    this.btnCover.addEventListener("click", () => this.notebook && this.cb.customiseCover(this.notebook));
    iconButton(right, "maximize", "Full screen", "fv-glass").addEventListener("click", () => this.cb.toggleFocus());
    iconButton(right, "panel-right", "Toggle outline", "fv-glass fv-tb-extra").addEventListener("click", () => this.cb.toggleOutline());
    this.btnClose = iconButton(right, "x", "Close notebook", "fv-glass fv-tb-extra");
    this.btnClose.addEventListener("click", () => void this.close());
    const more = iconButton(right, "ellipsis", "More", "fv-glass fv-btn-more");
    more.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleMore();
    });
    this.moreMenu = this.el.createDiv({ cls: "fv-more fv-glass" });

    // the book
    this.wrap = this.el.createDiv({ cls: "fv-bookwrap" });
    const tilt = this.wrap.createDiv({ cls: "fv-tilt" });
    tilt.createDiv({ cls: "fv-deskmat" });
    this.book = tilt.createDiv({ cls: "fv-book is-closed" });
    this.book.createDiv({ cls: "fv-boards" });
    this.leftBase = this.book.createDiv({ cls: "fv-pagebase fv-left" });
    this.rightBase = this.book.createDiv({ cls: "fv-pagebase fv-right" });
    this.book.createDiv({ cls: "fv-gutter" });
    this.cover = this.book.createDiv({ cls: "fv-cover" });
    this.coverFront = this.cover.createDiv({ cls: "fv-cover-face fv-cover-front" });
    this.band = this.coverFront.createDiv({ cls: "fv-band" });
    this.coverFront.createDiv({ cls: "fv-bandh" });
    this.coverFront.createDiv({ cls: "fv-spine-deco" });
    const plate = this.coverFront.createDiv({ cls: "fv-plate" });
    this.plateTitle = plate.createDiv({ cls: "fv-plate-title" });
    const rule = plate.createDiv({ cls: "fv-plate-count" });
    rule.createSpan({ cls: "fv-plate-dash" });
    this.plateCount = rule.createSpan({ cls: "fv-plate-num" });
    rule.createSpan({ cls: "fv-plate-dash" });
    this.plateProg = plate.createDiv({ cls: "fv-plate-prog" });
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
    const things = this.el.createDiv({ cls: "fv-desk-things" });
    things.appendChild(propEl("pencil", "fv-thing fv-thing-pencil"));
    things.appendChild(propEl("clips", "fv-thing fv-thing-clips"));

    this.footer = this.el.createDiv({ cls: "fv-footer" });
    this.footerOpen = this.footer.createDiv({ cls: "fv-footer-open fv-glass" });
    this.btnPrev = iconButton(this.footerOpen, "chevron-left", "Previous page");
    this.btnPrev.addEventListener("click", () => void this.prev());
    this.footTitle = this.footerOpen.createEl("button", { cls: "fv-foot-title", attr: { type: "button", "aria-label": "Contents" } });
    this.footCount = this.footerOpen.createEl("button", { cls: "fv-foot-count", attr: { type: "button", "aria-label": "Contents" } });
    this.footCount.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleToc();
    });
    this.btnNext = iconButton(this.footerOpen, "chevron-right", "Next page");
    this.btnNext.addEventListener("click", () => void this.next());
    this.btnEdit = iconButton(this.footerOpen, "pencil-line", "Edit this note\u2019s text");
    this.btnEdit.addEventListener("click", () => void this.toggleEditor());
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

    this.ribbonEl = this.book.createDiv({ cls: "fv-ribbon", attr: { role: "button", "aria-label": "Ribbon bookmark" } });
    this.ribbonEl.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.followRibbon();
    });
    this.hlPop = this.el.createDiv({ cls: "fv-hlpop fv-glass" });
    this.tabsEl = this.book.createDiv({ cls: "fv-tabs" });
    const cupW = this.el.createDiv({ cls: "fv-cup fv-cup-write" });
    this.wtray = cupW.createDiv({ cls: "fv-wtray" });
    cupW.createDiv({ cls: "fv-cup-body" });
    this.book.addEventListener("pointerdown", (e) => this.onInkDown(e));
    this.book.addEventListener("dblclick", (e) => this.onDblClick(e));
    document.addEventListener("pointerdown", this.onDocPointerDown, true);
    const cupH = this.el.createDiv({ cls: "fv-cup fv-cup-hl" });
    this.tray = cupH.createDiv({ cls: "fv-tray" });
    cupH.createDiv({ cls: "fv-cup-body" }).createSpan({ cls: "fv-cup-star", text: "✦" });
    this.legend = this.el.createDiv({ cls: "fv-legend" });
    this.sfx = new Sfx(() => host.settings);
    document.addEventListener("pointerup", this.onPointerUp);

    this.engine = new LayoutEngine(host, this.measure, {
      measured: (note, pages) => this.onMeasured(note, pages),
      index: () => this.indexData(),
    });
    this.ro = new ResizeObserver(() => {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => void this.rebuild(), 140);
    });
    this.ro.observe(this.el);
    this.applySettings(false);
    this.updateChrome();
  }

  /* ------------------------------------------------------------ public API */

  /** Opens (or closes) the text editor laid over the pages. Front matter is kept out of the way and put back on save. */
  private async toggleEditor(): Promise<void> {
    if (this.editor) {
      this.closeEditor();
      return;
    }
    const note = this.currentNote();
    if (!note || !this.isOpen || isIndex(note) || isSeparator(note)) return;
    let text: string;
    try {
      text = await this.host.readNoteText(note.path);
    } catch {
      return;
    }
    const m = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
    const front = m ? m[0] : "";
    const body = text.slice(front.length);
    const ed = this.book.createDiv({ cls: "fv-editor" });
    this.editor = ed;
    ed.addEventListener("pointerdown", (e) => e.stopPropagation());
    ed.addEventListener("click", (e) => e.stopPropagation());
    const bar = ed.createDiv({ cls: "fv-editor-bar" });
    bar.createSpan({ cls: "fv-editor-title", text: `Editing \u201c${note.title}\u201d` });
    const save = bar.createEl("button", { cls: "fv-editor-btn mod-cta", text: "Save", attr: { type: "button" } });
    const cancel = bar.createEl("button", { cls: "fv-editor-btn", text: "Cancel", attr: { type: "button" } });
    const area = ed.createEl("textarea", { cls: "fv-editor-area", attr: { spellcheck: "true" } });
    area.value = body;
    const doSave = async (): Promise<void> => {
      try {
        await this.host.writeNoteText(note.path, front + area.value);
      } catch (err) {
        console.error("[flip-view] save failed", err);
        return;
      }
      this.closeEditor();
      this.engine.invalidate(note.path);
      void this.rebuild();
    };
    save.addEventListener("click", () => void doSave());
    cancel.addEventListener("click", () => this.closeEditor());
    area.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") this.closeEditor();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void doSave();
    });
    area.focus();
    this.updateChrome();
  }

  private closeEditor(): void {
    this.editor?.remove();
    this.editor = null;
    this.updateChrome();
  }

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
    this.tally.reset();
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
      if (this.isOpen) void this.crawl();
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
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return false;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && this.writeTool) {
      this.undoInk();
      return true;
    }
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return false;
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
        else if (this.hlPop.hasClass("is-open")) this.closeHlPop();
        else if (this.writeTool !== null) this.selectWriteTool(null);
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
    for (const t of ["fine", "none", "rough", "laid", "linen", "speckled"]) this.el.toggleClass(`fv-pt-${t}`, s.pageTexture === t);
    for (const l of ["classic", "realistic", "wide"]) this.el.toggleClass(`fv-pl-${l}`, s.pageLayout === l);
    this.el.toggleClass("fv-margins", s.marginNotes);
    this.el.toggleClass("fv-ribbon-on", s.ribbon);
    this.el.toggleClass("fv-nofolio", !s.showPageNumbers);
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
    this.applyLook();
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
    document.removeEventListener("pointerdown", this.onDocPointerDown, true);
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
    this.crawlToken++;
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
    const sc = this.scene;
    const ratio = sc.on ? 0.84 : PAGE_RATIO;
    const topPad = sc.on ? sc.strip + 22 : 76;
    const botPad = sc.on ? 76 : 84;
    const side = sc.on ? clamp(r.width * 0.15, 56, 200) : 40;
    this.insets = { top: topPad, bottom: botPad };
    this.el.style.setProperty("--fv-top", `${topPad}px`);
    this.el.style.setProperty("--fv-bot", `${botPad}px`);
    let ph = Math.min(r.height - topPad - botPad, 980);
    let pw = ph * ratio;
    const maxW = (r.width - side * 2) / 2;
    if (pw > maxW) {
      pw = maxW;
      ph = pw / ratio;
    }
    if (sc.on) {
      ph = Math.min(ph, r.width * 0.3);
      pw = ph * ratio;
    }
    ph = Math.max(ph, 180);
    pw = ph * ratio;
    const scale = ph / 660;
    const pt = ph * (s.pageLayout === "realistic" ? 0.095 : 0.085);
    const pb = ph * (s.pageLayout === "realistic" ? 0.115 : 0.1);
    const px = pw * 0.11;
    // gutter side (pin) and outer side (pout) of a page; margin notes widen the outer side
    const mw = s.marginNotes ? pw * 0.115 : 0;
    let pin = px;
    let pout = px;
    if (s.pageLayout === "realistic") {
      pin = px * 1.1;
      pout = px * 0.72;
    } else if (s.pageLayout === "wide") {
      pin = px * 1.05;
      pout = px * 1.3;
    }
    pout += mw;
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
    st.setProperty("--fv-pin", `${pin}px`);
    st.setProperty("--fv-pout", `${pout}px`);
    st.setProperty("--fv-mw", `${mw}px`);
    st.setProperty("--fv-iw", `${pw - pin - pout}px`);
    st.setProperty("--fv-ih", `${ph - pt - pb}px`);
    st.setProperty("--fv-s", String(scale));
    st.setProperty("--fv-fs", `${fs}px`);
    st.setProperty("--fv-lh", `${lh}px`);
    st.setProperty("--fv-shift", `${-pw / 2}px`);
    this.metrics = { pw, ph, shift: -pw / 2 };
    this.metricsEx = { iw: pw - pin - pout, ih: ph - pt - pb, pin, pout, mw };
    this.placeLegend();
    this.updateLaptopLayout();
  }

  private layoutConfig(): LayoutConfig {
    const s = this.host.settings;
    const { iw, ih } = this.metricsEx;
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
      s.indexTitle,
    ].join("|");
    const tame = s.paperStyle === "plain" ? 1 : 0.2;
    const lineVar = s.viewMode === "handwritten" && s.paperStyle === "plain" ? s.lineVariance / 100 : 0;
    return { mode: s.viewMode, w: Math.round(iw), h: Math.round(ih), gap: 48, messiness: s.messiness, tame, lineVar, margin: s.marginNotes, signature: sig };
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

  /** A page element with its folio, running head, margin notes and ink. */
  private pageFor(layout: NoteLayout, noteIdx: number, index: number, side: "left" | "right"): HTMLElement {
    const s = this.host.settings;
    const note = layout.note;
    const folio = isNote(note) && this.notebook ? this.tally.start(this.notebook.notes, noteIdx).folio + index : undefined;
    const annots = s.viewMode === "handwritten" ? s.annotations[note.path] : undefined;
    return layout.pageEl(index, side, { folio, annots, head: isNote(note) ? note.title : undefined });
  }

  private fillBases(): void {
    if (!this.layout) return;
    this.leftBase.replaceChildren(this.pageFor(this.layout, this.noteIdx, this.spread * 2, "left"));
    this.rightBase.replaceChildren(this.pageFor(this.layout, this.noteIdx, this.spread * 2 + 1, "right"));
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
      const { leaf, front, back, cast, land, sign } = this.makeLeaf(forward, target, noteIdx, spread);
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
  private makeLeaf(forward: boolean, target: NoteLayout, targetIdx: number, spread: number) {
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
      this.rightBase.replaceChildren(this.pageFor(target, targetIdx, spread * 2 + 1, "right"));
      front.prepend(this.pageFor(cur, this.noteIdx, curSpread * 2 + 1, "right"));
      const landed = this.pageFor(target, targetIdx, spread * 2, "left");
      back.prepend(landed);
      land = () => this.leftBase.replaceChildren(landed);
      undo = () => old && this.rightBase.replaceChildren(old);
    } else {
      const old = this.leftBase.firstElementChild;
      this.leftBase.replaceChildren(this.pageFor(target, targetIdx, spread * 2, "left"));
      front.prepend(this.pageFor(cur, this.noteIdx, curSpread * 2, "left"));
      const landed = this.pageFor(target, targetIdx, spread * 2 + 1, "right");
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
      parts = this.makeLeaf(forward, target, tNote, spread);
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

  private rootEl(): HTMLElement | null {
    return this.el.closest<HTMLElement>(".fv-root");
  }

  private showLaptop(url: string): void {
    this.laptop.open(url);
    this.el.addClass("is-laptop");
    this.rootEl()?.addClass("fv-laptop-on");
    this.updateLaptopLayout();
    this.sfx.pen(true);
  }

  private closeLaptop(): void {
    this.laptop.close();
    this.el.removeClass("is-laptop");
    this.rootEl()?.removeClass("fv-laptop-on");
    this.updateLaptopLayout();
  }

  /**
   * Places the browser over the laptop screen in the desk photo (the photo is drawn "cover" across the whole
   * window) and tucks the notebook into the lower right while the laptop is up.
   */
  private updateLaptopLayout(): void {
    const r = this.el.getBoundingClientRect();
    const root = this.rootEl();
    if (r.width === 0 || !root) return;
    const rr = root.getBoundingClientRect();
    const dark = root.classList.contains("fv-dark");
    const iw = 764;
    const ih = 508;
    const k = Math.max(rr.width / iw, rr.height / ih);
    const ox = (rr.width - iw * k) / 2;
    const oy = (rr.height - ih * k) / 2;
    const scr = dark ? { x: 275, y: 99, w: 264, h: 170 } : { x: 279, y: 99, w: 262, h: 168 };
    this.laptop.setRect({
      left: rr.left + ox + scr.x * k - r.left,
      top: rr.top + oy + scr.y * k - r.top,
      width: scr.w * k,
      height: scr.h * k,
    });
    // the notebook shrinks into the bottom-right corner
    const bookW = (this.isOpen ? this.metrics.pw * 2 : this.metrics.pw) + 40;
    const scale = clamp((r.width * 0.27) / bookW, 0.28, 0.62);
    const midY = this.insets.top + (r.height - this.insets.top - this.insets.bottom) / 2;
    const cx = r.width - (bookW * scale) / 2 - 26;
    const cy = r.height - (this.metrics.ph * scale) / 2 - 56;
    const st = this.el.style;
    st.setProperty("--fv-lscale", String(scale));
    st.setProperty("--fv-lshift", `${cx - r.width / 2}px`);
    st.setProperty("--fv-lshifty", `${cy - midY}px`);
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
    const row = target.closest<HTMLElement>(".fv-idx-row, .fv-idx-section");
    if (row) {
      e.preventDefault();
      void this.goTo(Number(row.dataset.idx));
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
    if (this.host.settings.flipMode !== "click" || !this.isOpen || this.busy || this.activePen !== null || this.writeTool !== null) return;
    if (e.detail > 1 || window.getSelection()?.isCollapsed === false) return;
    if (target.closest("input, button, summary, textarea, select, .fv-edge, .fv-sep-tab, .fv-hl, .fv-ink-edit, .fv-margin-note")) return;
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
    this.applyLook();
    const { seed, style, color } = resolveLook(this.host.settings, nb);
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
        this.coverFront.style.setProperty("--fv-cover-ink", res.ink);
        this.coverFront.toggleClass("is-light-cover", res.lightCover);
        this.book.style.setProperty("--fv-cover-base", res.base);
        this.book.style.setProperty("--fv-cover-dark", res.dark);
        this.book.style.setProperty("--fv-cover-img", `url(${res.url})`);
      } catch (err) {
        console.error("[flip-view] cover generation failed", err);
      }
      this.cover.removeClass("is-generating");
    }, 16);
  }

  /** Per-notebook physical appearance: paper colour, elastic band, ribbon and spine design. */
  private applyLook(): void {
    const s = this.host.settings;
    const look = this.notebook ? resolveLook(s, this.notebook) : null;
    const paper = look?.paper ?? s.paperColor;
    for (const p of ["cream", "white", "ivory", "yellow", "grey", "blue", "sepia", "custom"]) this.el.toggleClass(`fv-pc-${p}`, paper === p);
    this.el.style.setProperty("--fv-paper-custom", s.paperCustom);
    const band = look?.band ?? s.bandStyle;
    for (const b of ["none", "vertical", "horizontal", "double"]) this.el.toggleClass(`fv-band-${b}`, band === b);
    const bandColor = look?.bandColor ?? s.bandColor;
    bandColor ? this.el.style.setProperty("--fv-band", bandColor) : this.el.style.removeProperty("--fv-band");
    this.el.style.setProperty("--fv-ribbon", look?.ribbonColor || s.ribbonColor);
    const spine = look?.spine ?? s.spineStyle;
    for (const sp of ["plain", "banded", "striped", "foil", "label", "ribbed"]) this.el.toggleClass(`fv-spine-${sp}`, spine === sp);
  }

  /* --------------------------------------------- shelf animation support */

  /** Where the closed notebook sits on the desk, in stage coordinates. */
  closedCoverRect(): { cx: number; cy: number; w: number; h: number } {
    const r = this.el.getBoundingClientRect();
    const { top, bottom } = this.insets;
    return { cx: r.width / 2, cy: top + (r.height - top - bottom) / 2, w: this.metrics.pw, h: this.metrics.ph };
  }

  /** A finished copy of the closed cover (waits for it to be painted), used as the flying book's front. */
  async coverClone(): Promise<HTMLElement> {
    for (let i = 0; i < 60 && this.cover.hasClass("is-generating"); i++) await new Promise((r) => window.setTimeout(r, 25));
    const c = this.coverFront.cloneNode(true) as HTMLElement;
    c.removeAttribute("tabindex");
    c.removeAttribute("role");
    c.removeAttribute("aria-label");
    return c;
  }

  /** Reading progress shown on the cover's name plate. */
  refreshProgress(): void {
    const s = this.host.settings;
    const nb = this.notebook;
    this.plateProg.empty();
    if (!nb || !s.trackProgress || !s.progressCover) return;
    const p = notebookProgress(nb, s);
    if (p.total) this.plateProg.appendChild(progressEl(p, s.progressStyle, 22));
  }

  refreshBookmarks(): void {
    this.updateChrome();
    this.cb.bookmarksChanged();
    this.scheduleIndexRefresh();
  }

  setCoverHidden(hidden: boolean): void {
    this.el.toggleClass("fv-cover-hidden", hidden);
  }

  playSfx(kind: "pull" | "land"): void {
    this.sfx.shelf(kind);
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
    const sep = isSeparator(note) || isIndex(note);
    this.btnCover.toggleClass("is-hidden", open || !nb);
    this.btnOpenNote.toggleClass("is-hidden", sep);
    this.btnEdit.toggleClass("is-hidden", sep);
    this.btnEdit.toggleClass("is-on", !!this.editor);
    this.lastEdit.toggleClass("is-visible", open && !!note && !sep && this.host.settings.showLastEdited);
    if (note) {
      const seen = this.host.settings.trackProgress ? this.host.settings.readState[note.path] : undefined;
      this.lastEditText.empty();
      this.lastEditText.createDiv({ text: seen ? "Last read:" : "Last edited:" });
      this.lastEditText.createDiv({ text: formatDate(seen ? seen.last : note.mtime) });
    }
    if (open && note && this.notebook) {
      this.footTitle.setText(note.title);
      this.footCount.setText(`${this.noteIdx + 1} / ${this.notebook.notes.length}`);
      this.btnNext.disabled = !this.layout || (this.noteIdx >= this.notebook.notes.length - 1 && this.spread >= this.layout.spreads - 1);
      this.btnPrev.disabled = false;
      this.btnPrev.setAttr("aria-label", this.noteIdx === 0 && this.spread === 0 ? "Close notebook" : "Previous page");
    }
    this.cover.toggleClass("is-empty", !nb || nb.notes.length === 0);
    this.btnBookmark.toggleClass("is-hidden", !open || isIndex(note));
    this.btnBookmark.toggleClass("is-on", this.isBookmarked());
    this.btnBookmark.setAttr("aria-label", this.isBookmarked() ? "Remove bookmark" : "Bookmark this page");
    this.ribbonEl.toggleClass("has-marks", this.bookmarksOf().length > 0);
    this.ribbonEl.toggleClass("is-here", this.isBookmarked());
    if (open && this.layout && !this.busy && note) {
      const key = `${nb?.id}|${this.noteIdx}|${this.spread}`;
      if (key !== this.shownKey) {
        this.shownKey = key;
        if (isNote(note)) this.cb.noteVisited(note, this.spread, this.layout.spreads);
        this.refreshFolios();
      }
    } else if (!open) this.shownKey = "";
    this.renderTabs();
    this.updateLaptopLayout();
    this.cb.stateChanged();
  }

  /** Coloured divider tabs on the book's edge: Contents, then one per separator page (section). */
  private renderTabs(): void {
    const nb = this.notebook;
    this.tabsEl.empty();
    this.tabsEl.toggleClass("is-hidden", !this.isOpen || !nb);
    if (!nb || !this.isOpen) return;
    const sections = nb.notes.map((n, i) => ({ n, i })).filter((x) => isSeparator(x.n));
    if (sections.length === 0) return;
    const palette = ["#8bc34a", "#7e57c2", "#ff9800", "#42a5f5", "#ffca28", "#ef5350", "#26a69a"];
    const entries = [...nb.notes.map((n, i) => ({ n, i })).filter((x) => isIndex(x.n)), ...sections];
    let current = -1;
    entries.forEach((e) => {
      if (e.i <= this.noteIdx) current = e.i;
    });
    entries.forEach((e, k) => {
      const tab = this.tabsEl.createEl("button", { cls: "fv-tab", attr: { type: "button", title: e.n.title, "aria-label": `Go to ${e.n.title}` } });
      tab.style.setProperty("--tab", palette[k % palette.length]);
      tab.toggleClass("is-current", e.i === current);
      tab.createSpan({ cls: "fv-tab-text", text: e.n.title });
      tab.addEventListener("click", (ev) => {
        ev.stopPropagation();
        void this.goTo(e.i);
      });
    });
  }

  /** Scene layout: the shelf strip takes `strip` px at the top of the stage. */
  setScene(on: boolean, strip: number): void {
    if (this.scene.on === on && this.scene.strip === strip) return;
    this.scene = { on, strip };
    this.el.toggleClass("fv-scene-stage", on);
    this.el.style.setProperty("--fv-strip", `${strip}px`);
    this.el.style.setProperty("--fv-ts-k", String(Math.max(0.5, strip / 272)));
    this.measureSizes();
    if (this.isOpen) void this.rebuild();
  }

  /* -------------------------------------------- page tally, index and crawl */

  private onMeasured(note: NoteRef, pages: number): void {
    const before = this.tally.version;
    this.tally.set(note, pages);
    if (this.tally.version !== before) this.scheduleIndexRefresh();
  }

  /** What the index page needs to draw itself. */
  private indexData(): IndexData | null {
    const nb = this.notebook;
    if (!nb) return null;
    const s = this.host.settings;
    const marks = s.bookmarks[nb.id] ?? [];
    const folios = nb.notes.map((n, i) => (isNote(n) ? this.tally.start(nb.notes, i) : null));
    const sig = [
      this.tally.version,
      nb.notes.map((n) => `${n.path}:${n.mtime}`).join(","),
      nb.notes.map((n) => noteStatus(s, n.path)).join(""),
      marks.map((m) => m.path).join(","),
      s.indexTitle,
      s.indexPageNumbers,
      s.indexLastEdited,
      s.indexCreated,
      s.indexSections,
      s.indexStatus,
      s.indexBookmarks,
      s.indexLeader,
      s.indexDates,
    ].join("|");
    return { nb, folios, status: (p) => noteStatus(s, p), bookmarked: (p) => marks.some((m) => m.path === p), signature: sig };
  }

  private scheduleIndexRefresh(): void {
    window.clearTimeout(this.indexTimer);
    this.indexTimer = window.setTimeout(() => {
      this.refreshFolios();
      if (this.isOpen && isIndex(this.currentNote())) void this.rebuild();
    }, 450);
  }

  /** Page numbers printed on the visible pages follow the tally as it firms up. */
  private refreshFolios(): void {
    if (!this.isOpen || !this.notebook || !isNote(this.currentNote())) return;
    const first = this.tally.start(this.notebook.notes, this.noteIdx).folio;
    this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-page-no").forEach((el) => {
      el.setText(String(first + Number(el.dataset.index ?? 0)));
    });
  }

  /** Lays out every note in the background so the index can show exact page numbers. */
  private async crawl(): Promise<void> {
    const nb = this.notebook;
    if (!nb || !this.host.settings.indexPageNumbers) return;
    const token = ++this.crawlToken;
    const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
    for (const note of nb.notes) {
      if (!isNote(note) || this.tally.has(note.path)) continue;
      while (this.busy && token === this.crawlToken && !this.destroyed) await wait(250);
      if (token !== this.crawlToken || this.destroyed || this.notebook !== nb || !this.isOpen) return;
      try {
        await this.engine.get(note, this.layoutConfig());
      } catch {
        this.tally.set(note, 2);
      }
      await wait(60);
    }
  }

  /* ------------------------------------------------------------ bookmarks */

  private bookmarksOf(): Bookmark[] {
    return this.notebook ? this.host.settings.bookmarks[this.notebook.id] ?? [] : [];
  }

  private isBookmarked(): boolean {
    const n = this.currentNote();
    return !!n && this.bookmarksOf().some((b) => b.path === n.path && b.spread === this.spread);
  }

  toggleBookmark(): void {
    const nb = this.notebook;
    const n = this.currentNote();
    if (!nb || !n || !this.isOpen || isIndex(n)) return;
    const list = (this.host.settings.bookmarks[nb.id] ??= []);
    const i = list.findIndex((b) => b.path === n.path && b.spread === this.spread);
    if (i >= 0) list.splice(i, 1);
    else list.push({ path: n.path, spread: this.spread, at: Date.now() });
    this.host.saveSettings();
    this.sfx.pen(i < 0);
    this.updateChrome();
    this.cb.bookmarksChanged();
    this.scheduleIndexRefresh();
  }

  /** The ribbon: jumps to the next bookmark after the page you're on (wrapping round). */
  async followRibbon(): Promise<void> {
    const nb = this.notebook;
    const marks = this.bookmarksOf();
    if (!nb || marks.length === 0) return;
    const pos = (b: Bookmark) => nb.notes.findIndex((n) => n.path === b.path) * 1000 + b.spread;
    const here = this.isOpen ? this.noteIdx * 1000 + this.spread : -1;
    const ordered = [...marks].filter((b) => nb.notes.some((n) => n.path === b.path)).sort((a, b) => pos(a) - pos(b));
    const next = ordered.find((b) => pos(b) > here) ?? ordered[0];
    if (!next) return;
    const idx = nb.notes.findIndex((n) => n.path === next.path);
    if (!this.isOpen) {
      await this.open(idx);
      if (next.spread > 0) await this.turnTo(idx, next.spread);
    } else await this.turnTo(idx, next.spread);
  }

  jumpToBookmark(b: Bookmark): void {
    const nb = this.notebook;
    const idx = nb ? nb.notes.findIndex((n) => n.path === b.path) : -1;
    if (idx < 0) return;
    if (!this.isOpen) void this.open(idx).then(async () => { if (b.spread > 0) await this.turnTo(idx, b.spread); });
    else void this.turnTo(idx, b.spread);
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
      pen.style.setProperty("--r", `${(i - (n - 1) / 2) * 7}deg`);
      pen.style.setProperty("--i", String(i));
      pen.style.setProperty("--n", String(n));
      pen.toggleClass("is-active", i === this.activePen);
      pen.addClass("fv-pen-svg");
      pen.appendChild(penSvg("highlighter", p.color));
      pen.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectPen(i);
      });
    });

    this.renderWriteTools();
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

  /* ------------------------------------------- writing: pens, pencils, text */

  private renderWriteTools(): void {
    const s = this.host.settings;
    const hand = s.viewMode === "handwritten";
    this.wtray.empty();
    this.wtray.toggleClass("is-disabled", !hand);
    const defs: Array<[WriteTool, string]> = [
      ["pen", "Pen"],
      ["pencil", "Pencil"],
      ["marker", "Marker"],
      ["text", "Type text"],
      ["eraser", "Eraser"],
    ];
    if (this.writeTool && this.writeTool !== "text" && this.writeTool !== "eraser") {
      const tool = this.writeTool;
      const palette: Record<string, string[]> = {
        pen: ["#1d2a6b", "#111111", "#b3202a", "#1b6b3a", "#6b2aa6", "#0a7bb5"],
        pencil: ["#4b4b55", "#2a2a2a", "#7a5a3a", "#3a5a7a"],
        marker: ["#ff5fa8", "#ff9f1c", "#2ec4b6", "#3a86ff", "#8338ec", "#ffd60a"],
      };
      const fly = this.wtray.createDiv({ cls: "fv-wcolors fv-glass" });
      for (const c of palette[tool]) {
        const dot = fly.createEl("button", { cls: "fv-wdot", attr: { type: "button", "aria-label": c } });
        dot.style.setProperty("--c", c);
        dot.toggleClass("is-on", s.writeColors[tool] === c);
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          s.writeColors[tool] = c;
          this.host.saveSettings();
          this.renderWriteTools();
        });
      }
    }
    for (const [tool, label] of defs) {
      const b = this.wtray.createEl("button", {
        cls: `fv-pen fv-wpen fv-w-${tool}`,
        attr: { type: "button", "aria-label": label, title: hand ? label : `${label} (handwritten view only)` },
      });
      if (tool === "pen" || tool === "pencil" || tool === "marker") b.style.setProperty("--pen", s.writeColors[tool]);
      b.toggleClass("is-active", this.writeTool === tool);
      b.style.setProperty("--i", String(defs.findIndex((d) => d[0] === tool)));
      b.style.setProperty("--n", String(defs.length));
      b.style.setProperty("--r", `${(defs.findIndex((d) => d[0] === tool) - 2) * 6}deg`);
      if (tool === "text") {
        b.createDiv({ cls: "fv-pen-body" });
        b.createSpan({ cls: "fv-wpen-glyph", text: "Aa" });
      } else {
        b.addClass("fv-pen-svg");
        b.appendChild(penSvg(tool === "pen" ? "ballpoint" : tool, s.writeColors[tool === "eraser" ? "pen" : tool] ?? "#444"));
      }
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.selectWriteTool(tool);
      });
    }
  }

  private selectWriteTool(t: WriteTool | null): void {
    if (t === this.writeTool) t = null;
    if (t && this.host.settings.viewMode !== "handwritten") return;
    this.writeTool = t;
    if (t) {
      this.activePen = null;
      this.el.toggleClass("is-highlighting", false);
      this.closeHlPop();
    }
    this.el.toggleClass("is-writing", t !== null);
    this.el.setAttr("data-write", t ?? "");
    this.sfx.pen(t !== null);
    this.renderTools();
  }

  private currentAnnots(): Annotation[] {
    const n = this.currentNote();
    return n ? (this.host.settings.annotations[n.path] ??= []) : [];
  }

  private renderVisibleInk(): void {
    const all = this.currentAnnots();
    this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-page").forEach((p) => renderInk(p, all.filter((a) => a.page === Number(p.dataset.index))));
  }

  private undoInk(): void {
    const n = this.currentNote();
    const list = this.currentAnnots();
    if (!n || list.length === 0) return;
    list.pop();
    if (list.length === 0) delete this.host.settings.annotations[n.path];
    this.host.saveSettings();
    this.renderVisibleInk();
    this.sfx.erase();
  }

  private commitAnnot(a: Annotation): void {
    const n = this.currentNote();
    if (!n) return;
    (this.host.settings.annotations[n.path] ??= []).push(a);
    this.host.saveSettings();
  }

  private onInkDown(e: PointerEvent): void {
    const tool = this.writeTool;
    if (!tool || e.button !== 0 || !this.isOpen || this.busy || this.host.settings.viewMode !== "handwritten") return;
    const pageEl = (e.target as HTMLElement).closest<HTMLElement>(".fv-pagebase .fv-page");
    const note = this.currentNote();
    if (!pageEl || !note || isIndex(note)) return;
    if ((e.target as HTMLElement).closest(".fv-ink-edit")) return;
    e.preventDefault();
    e.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur?.();
    const idx = Number(pageEl.dataset.index ?? 0);
    const rect = pageEl.getBoundingClientRect();
    const at = (ev: PointerEvent): [number, number] => [clamp((ev.clientX - rect.left) / rect.width, 0, 1), clamp((ev.clientY - rect.top) / rect.height, 0, 1)];
    if (tool === "text") return this.startText(pageEl, idx, e);
    if (tool === "eraser") return this.startErase(pageEl, idx, e);

    const color = this.host.settings.writeColors[tool];
    const points: number[] = [...at(e)];
    const live = makeStrokeEl({ id: "live", tool, color, points });
    ensureInkLayer(pageEl).svg.appendChild(live);
    const move = (ev: PointerEvent) => {
      const [x, y] = at(ev);
      const n = points.length;
      if (Math.hypot((x - points[n - 2]) * rect.width, (y - points[n - 1]) * rect.height) < 1.5) return;
      points.push(x, y);
      live.setAttribute("d", strokePath(points));
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      live.remove();
      if (points.length < 2) return;
      this.commitAnnot({ id: Math.random().toString(36).slice(2, 9), kind: "stroke", page: idx, tool, color, points: points.map((v) => Math.round(v * 10000) / 10000) });
      this.renderVisibleInk();
      this.sfx.marker(points.length / 2);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  private startText(pageEl: HTMLElement, idx: number, e: PointerEvent): void {
    const note = this.currentNote();
    if (!note) return;
    const list = this.currentAnnots();
    let existing: Annotation | undefined;
    for (const el of Array.from(pageEl.querySelectorAll<HTMLElement>(".fv-ink-text"))) {
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left - 6 && e.clientX <= r.right + 6 && e.clientY >= r.top - 6 && e.clientY <= r.bottom + 6) {
        existing = list.find((a) => a.id === el.dataset.ink);
        el.style.visibility = "hidden";
        break;
      }
    }
    const rect = pageEl.getBoundingClientRect();
    const x = existing?.x ?? clamp((e.clientX - rect.left) / rect.width, 0, 0.82);
    const y = existing?.y ?? clamp((e.clientY - rect.top) / rect.height, 0, 0.95);
    const color = existing?.color ?? this.host.settings.writeColors.pen;
    const ed = ensureInkLayer(pageEl).text.createDiv({ cls: "fv-ink-text fv-ink-edit" });
    ed.contentEditable = "true";
    ed.style.left = `${x * 100}%`;
    ed.style.top = `${y * 100}%`;
    ed.style.setProperty("--c", color);
    ed.textContent = existing?.text ?? "";
    let cancelled = false;
    ed.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        ed.blur();
      } else if (ev.key === "Escape") {
        cancelled = true;
        ed.blur();
      }
    });
    ed.addEventListener("blur", () => {
      const text = (ed.innerText ?? "").trim();
      if (existing) {
        const at = list.indexOf(existing);
        if (!cancelled) {
          if (text) existing.text = text;
          else if (at >= 0) list.splice(at, 1);
        }
      } else if (!cancelled && text) {
        list.push({ id: Math.random().toString(36).slice(2, 9), kind: "text", page: idx, tool: "text", color, x, y, text });
      }
      if (list.length === 0) delete this.host.settings.annotations[note.path];
      this.host.saveSettings();
      this.renderVisibleInk();
    });
    window.setTimeout(() => {
      ed.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(ed);
        sel.collapseToEnd();
      }
    }, 0);
  }

  private startErase(pageEl: HTMLElement, idx: number, e: PointerEvent): void {
    const note = this.currentNote();
    if (!note) return;
    let removed = false;
    const hit = (ev: PointerEvent): void => {
      const list = this.host.settings.annotations[note.path];
      if (!list) return;
      const rect = pageEl.getBoundingClientRect();
      const px = ev.clientX;
      const py = ev.clientY;
      const keep = list.filter((a) => {
        if (a.page !== idx) return true;
        if (a.kind === "text") {
          const el = pageEl.querySelector<HTMLElement>(`.fv-ink-text[data-ink="${a.id}"]`);
          const r = el?.getBoundingClientRect();
          return !(r && px >= r.left - 6 && px <= r.right + 6 && py >= r.top - 6 && py <= r.bottom + 6);
        }
        const pts = a.points ?? [];
        for (let i = 0; i + 1 < pts.length; i += 2) {
          const x = rect.left + pts[i] * rect.width;
          const y = rect.top + pts[i + 1] * rect.height;
          if (Math.hypot(x - px, y - py) < 13) return false;
          if (i + 3 < pts.length) {
            const x2 = rect.left + pts[i + 2] * rect.width;
            const y2 = rect.top + pts[i + 3] * rect.height;
            if (Math.hypot((x + x2) / 2 - px, (y + y2) / 2 - py) < 13) return false;
          }
        }
        return true;
      });
      if (keep.length !== list.length) {
        removed = true;
        if (keep.length) this.host.settings.annotations[note.path] = keep;
        else delete this.host.settings.annotations[note.path];
        this.renderVisibleInk();
      }
    };
    hit(e);
    const move = (ev: PointerEvent) => hit(ev);
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
      if (removed) {
        this.host.saveSettings();
        this.sfx.erase();
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
  }

  /* -------------------------------- double-click a highlight: recolour/note/remove */

  private onDocPointerDown = (e: PointerEvent): void => {
    if (this.hlPop.hasClass("is-open") && !this.hlPop.contains(e.target as Node)) this.closeHlPop();
    if (this.moreMenu.hasClass("is-open") && !this.moreMenu.contains(e.target as Node)) this.moreMenu.removeClass("is-open");
  };

  private closeHlPop(): void {
    this.hlPop.removeClass("is-open");
  }

  private onDblClick(e: MouseEvent): void {
    const mark = (e.target as HTMLElement).closest<HTMLElement>(".fv-hl");
    if (!mark || !mark.dataset.hl || !this.isOpen) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    this.showHlPop(mark, e);
  }

  private showHlPop(mark: HTMLElement, e: MouseEvent): void {
    const note = this.currentNote();
    const id = mark.dataset.hl as string;
    const h = note ? this.host.settings.highlights[note.path]?.find((x) => x.id === id) : undefined;
    if (!note || !h) return;
    const pens = this.host.settings.highlighters;
    const pop = this.hlPop;
    pop.empty();
    pop.createDiv({ cls: "fv-hlpop-title", text: "Highlight" });
    const row = pop.createDiv({ cls: "fv-hlpop-row" });
    pens.forEach((p, i) => {
      const sw = row.createEl("button", { cls: "fv-hlpop-sw", attr: { type: "button", title: p.label || p.color, "aria-label": p.label || p.color } });
      sw.style.setProperty("--pen", p.color);
      sw.toggleClass("is-on", h.slot === i);
      sw.addEventListener("click", () => {
        h.slot = i;
        h.color = p.color;
        this.host.saveSettings();
        this.layout?.recolorHighlight(id, p.color);
        this.book.querySelectorAll<HTMLElement>(`.fv-pagebase .fv-hl[data-hl="${id}"]`).forEach((el) => el.style.setProperty("--hl", p.color));
        this.sfx.pen(true);
        this.cb.stateChanged();
        this.showHlPop(mark, e);
      });
    });
    const input = pop.createEl("input", { cls: "fv-hlpop-note", attr: { type: "text", placeholder: "Margin note…" } });
    input.value = h.note ?? "";
    const saveNote = () => this.setHighlightNote(h, mark, input.value.trim());
    input.addEventListener("keydown", (ev) => {
      ev.stopPropagation();
      if (ev.key === "Enter") {
        saveNote();
        this.closeHlPop();
      } else if (ev.key === "Escape") this.closeHlPop();
    });
    input.addEventListener("change", saveNote);
    const del = pop.createEl("button", { cls: "fv-hlpop-del", attr: { type: "button" } });
    setIcon(del.createSpan(), "trash-2");
    del.createSpan({ text: "Remove highlight" });
    del.addEventListener("click", () => {
      this.closeHlPop();
      this.removeHighlight(id);
    });
    const r = this.el.getBoundingClientRect();
    pop.style.left = `${clamp(e.clientX - r.left - 100, 8, r.width - 216)}px`;
    pop.style.top = `${clamp(e.clientY - r.top + 14, 8, r.height - 170)}px`;
    pop.addClass("is-open");
  }

  /** Types (or clears) the margin note attached to a highlight. */
  private setHighlightNote(h: Highlight, mark: HTMLElement, text: string): void {
    if ((h.note ?? "") === text) return;
    h.note = text || undefined;
    this.host.saveSettings();
    const layout = this.layout;
    if (!layout) return;
    const flow = mark.closest<HTMLElement>(".fv-flow");
    const inner = mark.closest<HTMLElement>(".fv-page-inner");
    const i = layout.margins.findIndex((m) => m.hlId === h.id);
    if (i >= 0) layout.margins.splice(i, 1);
    if (text && flow && inner) {
      const y = (mark.getClientRects()[0]?.top ?? inner.getBoundingClientRect().top) - inner.getBoundingClientRect().top;
      layout.margins.push({ page: Number(flow.dataset.page ?? 0), y, text, hlId: h.id });
    }
    this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-page").forEach((p) => layout.renderMargins(p, Number(p.dataset.index)));
  }

  private selectPen(i: number | null): void {
    const pens = this.host.settings.highlighters;
    if (i === this.activePen) i = null;
    if (i !== null) this.writeTool = null;
    this.el.toggleClass("is-writing", this.writeTool !== null);
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
    const lay = this.layout;
    if (lay) this.book.querySelectorAll<HTMLElement>(".fv-pagebase .fv-page").forEach((p) => lay.renderMargins(p, Number(p.dataset.index)));
    this.sfx.erase();
    this.cb.stateChanged();
  }

  tick(): void {
    this.sfx.tick();
  }

  private toggleMore(): void {
    const m = this.moreMenu;
    if (m.hasClass("is-open")) {
      m.removeClass("is-open");
      return;
    }
    m.empty();
    const item = (icon: string, label: string, id: string, fn: () => void) => {
      const b = m.createEl("button", { cls: "fv-more-item", attr: { type: "button", "data-id": id } });
      setIcon(b.createSpan({ cls: "fv-more-icon" }), icon);
      b.createSpan({ text: label });
      b.addEventListener("click", () => {
        m.removeClass("is-open");
        fn();
      });
    };
    item("panel-left", "Notebook list", "list", () => this.cb.toggleSidebar());
    item("panel-right", "Outline", "outline", () => this.cb.toggleOutline());
    item("layout-grid", "Shelf mode", "shelf", () => this.cb.shelfRequested());
    if (this.scene.on) item("library", this.host.settings.shelfHidden ? "Show the shelf" : "Hide the shelf", "toggleshelf", () => this.cb.toggleShelfVisible());
    if (this.notebook && !this.isOpen) {
      item("palette", "Cover options", "cover", () => this.notebook && this.cb.customiseCover(this.notebook));
      item("dices", "Shuffle cover", "shuffle", () => this.shuffleCover());
    }
    if (this.isOpen) item("x", "Close notebook", "close", () => void this.close());
    item("settings", "Settings", "settings", () => this.cb.openSettings());
    m.addClass("is-open");
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
