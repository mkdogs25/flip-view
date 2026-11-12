import { setIcon } from "obsidian";
import { handFontInfo } from "../render/fonts";
import deskDark from "../../assets/desk/desk-dark.jpg";
import deskDarkLaptop from "../../assets/desk/desk-dark-laptop.jpg";
import deskLight from "../../assets/desk/desk-light.jpg";
import deskLightLaptop from "../../assets/desk/desk-light-laptop.jpg";
import shelfDark from "../../assets/shelf/shelf-dark.webp";
import shelfLight from "../../assets/shelf/shelf-light.webp";
import { BRICKS, WOODS, brickTexture, leatherTexture, woodTexture } from "../render/textures";
import { notebookProgress, noteStatus, recentNotes, recordVisit, relativeTime } from "../progress";
import { Bookmark, Notebook, NotebookHost, NoteRef, ViewMode, isNote, realNoteCount } from "../types";
import { BookStage } from "./book";
import { iconButton, progressEl } from "./dom";
import { OutlinePanel } from "./outline";
import { InfoPanel } from "./infopanel";
import { SearchPop } from "./searchpop";
import { Shelf } from "./shelf";
import { TopShelf } from "./topshelf";

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;

/** Sidebar (notebook list) + desk. Owns theme, fonts and selection. */
export class NotebookApp {
  readonly root: HTMLElement;
  private sidebar: HTMLElement;
  private listEl: HTMLElement;
  private searchInput: HTMLInputElement;
  private empty: HTMLElement;
  private stage: BookStage;
  private outline: OutlinePanel;
  private shelf: Shelf;
  private topShelf: TopShelf;
  private info: InfoPanel;
  private search: SearchPop;
  private drawers = false;
  private pickBusy = false;
  private recentEl: HTMLElement;
  private progressTimer = 0;
  private displace: SVGElement;
  private wobbleId: string;
  private pencilId = "";
  private texToken = 0;
  private notebooks: Notebook[] = [];
  private selectedId = "";
  private filter = "";
  private ro: ResizeObserver;
  private narrow = false;
  private fsActive = false;
  private onFsChange = () => {
    if (this.fsActive && document.fullscreenElement !== this.root) {
      this.fsActive = false;
      this.root.removeClass("fv-focus");
    }
  };

  constructor(parent: HTMLElement, private host: NotebookHost) {
    this.root = parent.createDiv({ cls: "fv-root" });
    this.root.tabIndex = 0;

    // hand-drawn wobble filter (used for rules, underlines and frames)
    this.wobbleId = `fv-wobble-${++uid}`;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("fv-defs");
    const defs = document.createElementNS(SVG_NS, "defs");
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", this.wobbleId);
    filter.setAttribute("filterUnits", "userSpaceOnUse");
    for (const [k, v] of Object.entries({ x: "-50", y: "-50", width: "5000", height: "5000" })) filter.setAttribute(k, v);
    const turb = document.createElementNS(SVG_NS, "feTurbulence");
    for (const [k, v] of Object.entries({ type: "fractalNoise", baseFrequency: "0.035", numOctaves: "2", seed: "4", result: "n" })) turb.setAttribute(k, v);
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "n", scale: "3" })) disp.setAttribute(k, v);
    filter.append(turb, disp);
    defs.appendChild(filter);
    // pencil grain: noise used as an alpha mask over the stroke
    this.pencilId = `fv-pencil-${uid}`;
    const pencil = document.createElementNS(SVG_NS, "filter");
    pencil.setAttribute("id", this.pencilId);
    pencil.setAttribute("filterUnits", "userSpaceOnUse");
    for (const [k, v] of Object.entries({ x: "-50", y: "-50", width: "5000", height: "5000" })) pencil.setAttribute(k, v);
    const pt = document.createElementNS(SVG_NS, "feTurbulence");
    for (const [k, v] of Object.entries({ type: "fractalNoise", baseFrequency: "0.9", numOctaves: "2", seed: "9", result: "g" })) pt.setAttribute(k, v);
    const pm = document.createElementNS(SVG_NS, "feColorMatrix");
    for (const [k, v] of Object.entries({ in: "g", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.55", result: "m" })) pm.setAttribute(k, v);
    const pc = document.createElementNS(SVG_NS, "feComposite");
    for (const [k, v] of Object.entries({ in: "SourceGraphic", in2: "m", operator: "in" })) pc.setAttribute(k, v);
    pencil.append(pt, pm, pc);
    defs.appendChild(pencil);
    svg.appendChild(defs);
    this.root.appendChild(svg);
    this.displace = disp;
    this.root.style.setProperty("--fv-wobble", `url(#${this.wobbleId})`);
    this.root.style.setProperty("--fv-pencil", `url(#${this.pencilId})`);

    // sidebar
    this.sidebar = this.root.createDiv({ cls: "fv-sidebar fv-glass" });
    const brand = this.sidebar.createDiv({ cls: "fv-brand" });
    setIcon(brand.createSpan({ cls: "fv-brand-icon" }), "library");
    brand.createSpan({ cls: "fv-brand-name", text: "Notebook View" });
    const search = this.sidebar.createDiv({ cls: "fv-search" });
    setIcon(search.createSpan({ cls: "fv-search-icon" }), "search");
    this.searchInput = search.createEl("input", { attr: { type: "text", placeholder: "Search notebooks...", "aria-label": "Search notebooks" } });
    this.searchInput.addEventListener("input", () => {
      this.filter = this.searchInput.value.trim().toLowerCase();
      this.renderList();
    });
    this.recentEl = this.sidebar.createDiv({ cls: "fv-recent" });
    this.listEl = this.sidebar.createDiv({ cls: "fv-nblist" });
    const add = this.sidebar.createEl("button", { cls: "fv-newnb", attr: { type: "button" } });
    setIcon(add.createSpan({ cls: "fv-newnb-icon" }), "plus");
    add.createSpan({ text: "New Notebook" });
    add.addEventListener("click", () => this.host.createNotebook());
    const foot = this.sidebar.createDiv({ cls: "fv-sidebar-foot" });
    iconButton(foot, "settings", "Plugin settings").addEventListener("click", () => this.host.openSettings());
    iconButton(foot, "circle-help", "How it works").addEventListener("click", () => this.host.showHelp());

    // stage
    this.stage = new BookStage(this.root, host, {
      toggleSidebar: () => this.toggleSidebar(),
      toggleOutline: () => this.toggleOutline(),
      toggleFocus: () => this.toggleFocus(),
      modeChanged: (mode) => this.setMode(mode),
      customiseCover: (nb) => void this.customiseCover(nb),
      stateChanged: () => this.refreshOutline(),
      followInternal: (href, source) => void this.followInternal(href, source),
      noteVisited: (note, spread, spreads) => this.noteVisited(note, spread, spreads),
      bookmarksChanged: () => this.refreshOutline(),
      shelfRequested: () => void this.showShelf(),
      searchRequested: () => this.search.toggle(),
      openSettings: () => host.openSettings(),
      toggleShelfVisible: () => {
        host.settings.shelfHidden = !host.settings.shelfHidden;
        host.saveSettings();
        this.applySettings();
      },
    });
    this.topShelf = new TopShelf(this.stage.el, host, {
      pick: (nb, el) => void this.pickFromTop(nb, el),
      create: () => host.createNotebook(),
      fullShelf: () => void this.showShelf(),
      collapse: (c) => this.setStripCollapsed(c),
    });
    this.info = new InfoPanel(this.stage.el, host, {
      changed: () => {
        this.applySettings();
        this.refreshProgress();
      },
      regenerate: (nb) => this.regenerate(nb),
      openSettings: () => host.openSettings(),
    });
    this.search = new SearchPop(this.stage.el, {
      go: (path) => void this.goToPath(path),
      pickNotebook: (nb) => {
        const el = this.topShelf.coverEl(nb.id);
        if (el) void this.pickFromTop(nb, el);
        else this.select(nb.id);
      },
    });
    this.shelf = new Shelf(this.stage.el, host, {
      pick: (nb, spine) => void this.pickFromShelf(nb, spine),
      close: () => this.hideShelf(),
    });
    this.empty = this.stage.el.createDiv({ cls: "fv-empty" });

    this.outline = new OutlinePanel(this.root, {
      open: (i) => void this.stage.goToNote(i),
      page: (i, page) => void this.stage.jumpToPage(i, page),
      reorder: (from, to) => this.reorder(from, to),
      addSeparator: () => void this.addSeparator(),
      renameSeparator: (i) => void this.renameSeparator(i),
      deleteSeparator: (i) => this.deleteSeparator(i),
      removeHighlight: (id) => this.stage.removeHighlight(id),
      jumpBookmark: (b) => this.stage.jumpToBookmark(b),
      removeBookmark: (b) => this.removeBookmark(b),
      toggle: () => this.toggleOutline(),
    });

    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.shelf.isOpen && !this.shelf.isBusy) {
        this.hideShelf();
        return;
      }
      if (e.key === "Escape" && this.root.hasClass("fv-focus") && !this.stage.currentNotebook()?.notes.length) {
        this.toggleFocus();
        return;
      }
      if (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea, [contenteditable]")) {
        e.preventDefault();
        this.search.open();
        return;
      }
      if (e.key === "Escape" && this.search.isOpen) {
        this.search.close();
        return;
      }
      if (this.stage.handleKey(e)) e.preventDefault();
      else if (e.key === "Escape" && this.root.hasClass("fv-focus")) {
        this.toggleFocus();
        e.preventDefault();
      }
    });
    this.root.addEventListener("pointerdown", (e) => {
      if (!(e.target as HTMLElement).closest("input, button, a")) this.root.focus({ preventScroll: true });
    });
    document.addEventListener("fullscreenchange", this.onFsChange);

    this.ro = new ResizeObserver(() => this.checkNarrow());
    this.ro.observe(this.root);
    this.root.toggleClass("is-sidebar-collapsed", host.settings.sidebarCollapsed);
    this.root.toggleClass("is-outline-collapsed", host.settings.outlineCollapsed);
    this.applySettings();
    if (host.settings.shelfMode) {
      this.root.addClass("fv-shelf-mode");
      this.shelf.open();
    }
  }

  /* ------------------------------------------------------------------ data */

  setNotebooks(list: Notebook[]): void {
    this.notebooks = list;
    let sel = list.find((n) => n.id === this.selectedId);
    if (!sel) sel = list.find((n) => n.id === this.host.settings.lastNotebook) ?? list[0];
    this.selectedId = sel?.id ?? "";
    this.renderList();
    this.renderRecent();
    this.shelf.render(list, this.selectedId);
    this.stage.setNotebook(sel ?? null);
    this.renderScene();
    this.renderEmpty(list.length === 0);
  }

  select(id: string): void {
    const nb = this.notebooks.find((n) => n.id === id);
    if (!nb) return;
    this.selectedId = id;
    this.host.settings.lastNotebook = id;
    this.host.saveSettings();
    this.renderList();
    this.stage.setNotebook(nb);
    if (this.drawers) this.setSidebarCollapsed(true);
    this.renderScene();
    this.root.focus({ preventScroll: true });
  }

  /** Opens the notebook that holds `path` and flips to that note. */
  async revealNote(path: string): Promise<void> {
    const holders = this.notebooks.filter((n) => n.notes.some((x) => x.path === path));
    if (holders.length === 0) return;
    const nb = holders.find((n) => n.id === this.selectedId) ?? holders[0];
    if (nb.id !== this.selectedId) this.select(nb.id);
    const idx = nb.notes.findIndex((x) => x.path === path);
    await new Promise((r) => window.setTimeout(r, 60));
    if (this.stage.currentNotebook()?.id === nb.id) {
      if (this.stage.currentNote()?.path === path) return;
      await this.stage.goToNote(idx);
    }
  }

  fileChanged(path: string): void {
    this.stage.fileChanged(path);
  }

  applySettings(): void {
    const s = this.host.settings;
    const dark = s.theme === "dark" || (s.theme === "auto" && this.host.isDarkTheme());
    this.root.toggleClass("fv-dark", dark);
    this.root.toggleClass("fv-light", !dark);
    this.root.toggleClass("fv-no-desk", !s.showDesk);
    const scene = s.layoutStyle === "scene";
    this.root.toggleClass("fv-scene", scene);
    this.root.toggleClass("fv-classic", !scene);
    this.updateDrawerMode();
    this.topShelf.setCollapsed(scene && s.stripCollapsed);
    this.topShelf.el.toggleClass("is-hidden", s.shelfHidden);
    this.stage.setScene(scene, scene ? this.stripHeight() : 0);
    const font = handFontInfo(s.handFont);
    const r = this.root.style;
    r.setProperty("--fv-hand-font", `"${font.family}", "Segoe Print", "Bradley Hand", cursive`);
    s.inkColor ? r.setProperty("--fv-ink-user", s.inkColor) : r.removeProperty("--fv-ink-user");
    s.accentColor ? r.setProperty("--fv-accent-user", s.accentColor) : r.removeProperty("--fv-accent-user");
    s.textFont.trim() ? r.setProperty("--fv-text-font", s.textFont) : r.removeProperty("--fv-text-font");
    this.applyTextures(dark);
    r.setProperty("--fv-hand-stroke", `${font.stroke ?? 0}px`);
    this.displace.setAttribute("scale", String(1 + (s.messiness / 100) * 4));
    this.stage.applySettings();
    this.renderList();
    this.renderScene();
  }

  destroy(): void {
    this.ro.disconnect();
    document.removeEventListener("fullscreenchange", this.onFsChange);
    this.stage.destroy();
    this.root.remove();
  }

  /* ---------------------------------------------------------------- chrome */

  private setMode(mode: ViewMode): void {
    this.host.settings.viewMode = mode;
    this.host.saveSettings();
    this.applySettings();
  }

  private toggleSidebar(): void {
    this.setSidebarCollapsed(!this.root.hasClass("is-sidebar-collapsed"));
  }

  private setSidebarCollapsed(collapsed: boolean): void {
    this.root.toggleClass("is-sidebar-collapsed", collapsed);
    if (!this.drawers) {
      this.host.settings.sidebarCollapsed = collapsed;
      this.host.saveSettings();
    }
  }

  private toggleOutline(): void {
    const collapsed = !this.root.hasClass("is-outline-collapsed");
    this.root.toggleClass("is-outline-collapsed", collapsed);
    if (!this.drawers) {
      this.host.settings.outlineCollapsed = collapsed;
      this.host.saveSettings();
    }
  }

  /* ------------------------------------------------- editing the notebook */

  private refreshOutline(): void {
    if (!this.outline) return;
    const nb = this.stage.currentNotebook();
    this.outline.render(nb, {
      current: this.stage.currentIndex(),
      headings: this.stage.currentHeadings(),
      highlights: this.stage.currentHighlights(),
      bookmarks: nb ? this.host.settings.bookmarks[nb.id] ?? [] : [],
      status: this.host.settings.trackProgress ? (p: string) => noteStatus(this.host.settings, p) : null,
    });
  }

  private reload(): void {
    this.setNotebooks(this.host.getNotebooks());
  }

  private reorder(from: number, to: number): void {
    const nb = this.stage.currentNotebook();
    const first = nb?.notes[0]?.kind === "index" ? 1 : 0; // the index page stays first
    if (!nb || to < first || from < first || to >= nb.notes.length || from === to) return;
    const keys = nb.notes.map((n) => n.path);
    const [moved] = keys.splice(from, 1);
    keys.splice(to, 0, moved);
    this.host.settings.noteOrder[nb.id] = keys.filter((k) => !k.startsWith("index:"));
    this.host.saveSettings();
    this.stage.tick();
    this.reload();
  }

  private async addSeparator(): Promise<void> {
    const nb = this.stage.currentNotebook();
    if (!nb) return;
    const title = await this.host.promptText({
      title: "Add separator page",
      placeholder: "Chapter two",
      hint: "A divider page with this title, placed after the note you're reading (or at the end).",
    });
    if (!title?.trim()) return;
    const id = Math.random().toString(36).slice(2, 9);
    const keys = nb.notes.map((n) => n.path);
    const at = this.stage.currentIndex();
    keys.splice(at >= 0 ? at + 1 : keys.length, 0, "sep:" + id);
    (this.host.settings.separators[nb.id] ??= {})[id] = title.trim();
    this.host.settings.noteOrder[nb.id] = keys.filter((k) => !k.startsWith("index:"));
    this.host.saveSettings();
    this.reload();
  }

  private async renameSeparator(index: number): Promise<void> {
    const nb = this.stage.currentNotebook();
    const n = nb?.notes[index];
    if (!nb || !n?.sepId) return;
    const title = await this.host.promptText({ title: "Rename separator", value: n.title });
    if (!title?.trim()) return;
    this.host.settings.separators[nb.id][n.sepId] = title.trim();
    this.host.saveSettings();
    this.reload();
  }

  private deleteSeparator(index: number): void {
    const nb = this.stage.currentNotebook();
    const n = nb?.notes[index];
    if (!nb || !n?.sepId) return;
    delete this.host.settings.separators[nb.id]?.[n.sepId];
    this.host.settings.noteOrder[nb.id] = (this.host.settings.noteOrder[nb.id] ?? nb.notes.map((x) => x.path)).filter((k) => k !== n.path && !k.startsWith("index:"));
    this.host.saveSettings();
    this.reload();
  }

  private async renameNotebook(nb: Notebook): Promise<void> {
    const v = await this.host.promptText({
      title: "Rename notebook",
      value: nb.name,
      hint: `This only changes the name shown here. Your folders, properties and notes are not touched. Original: "${nb.originalName}".`,
      resetLabel: "Reset to original",
    });
    if (v === null) return;
    const name = v.trim();
    if (!name || name === nb.originalName) delete this.host.settings.notebookNames[nb.id];
    else this.host.settings.notebookNames[nb.id] = name;
    this.host.saveSettings();
    this.reload();
  }

  /** An internal link was clicked: flip to the note if it is in this notebook, else move to its notebook, else open it normally. */
  private async followInternal(href: string, source: string): Promise<void> {
    const hit = this.host.resolveLink(href, source);
    if (!hit || !(await this.goToPath(hit.path, hit.heading))) this.host.openLink(href, source, false);
  }

  /** Flips to a note by path, switching notebook if needed. Returns false if no notebook holds it. */
  private async goToPath(path: string, heading?: string): Promise<boolean> {
    const cur = this.stage.currentNotebook();
    const here = cur ? cur.notes.findIndex((n) => n.path === path) : -1;
    if (cur && here >= 0) {
      await this.stage.goTo(here, heading);
      return true;
    }
    const other = this.notebooks.find((nb) => nb.notes.some((n) => n.path === path));
    if (!other) return false;
    if (this.shelf.isOpen) this.hideShelf();
    if (this.stage.isBookOpen()) await this.stage.close();
    this.select(other.id);
    await new Promise((r) => window.setTimeout(r, 140)); // let the new cover appear
    await this.stage.goTo(
      other.notes.findIndex((n) => n.path === path),
      heading,
    );
    return true;
  }

  /* --------------------------------------------------------------- shelf */

  private animMs(ms: number): number {
    const a = this.host.settings.animation;
    if (a === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;
    return a === "fast" ? ms * 0.5 : ms;
  }

  async showShelf(): Promise<void> {
    if (this.shelf.isOpen) return;
    if (this.stage.isBookOpen()) await this.stage.close();
    this.root.addClass("fv-shelf-mode");
    this.shelf.render(this.notebooks, this.selectedId);
    this.shelf.open();
    this.host.settings.shelfMode = true;
    this.host.saveSettings();
  }

  hideShelf(): void {
    this.shelf.hide();
    this.root.removeClass("fv-shelf-mode");
    this.host.settings.shelfMode = false;
    this.host.saveSettings();
  }

  /** The pull-out: slide the book off the shelf, lay it on the desk, then the desk view takes over. */
  private async pickFromShelf(nb: Notebook, spine: HTMLElement): Promise<void> {
    this.selectedId = nb.id;
    this.host.settings.lastNotebook = nb.id;
    this.renderList();
    this.stage.setCoverHidden(true);
    this.stage.setNotebook(nb);
    this.stage.playSfx("pull");
    const face = await this.stage.coverClone();
    try {
      await this.shelf.pullOut(nb, spine, this.stage.closedCoverRect(), face, this.animMs(1700), () => this.stage.playSfx("land"));
    } finally {
      this.stage.setCoverHidden(false);
    }
    this.root.removeClass("fv-shelf-mode");
    this.host.settings.shelfMode = false;
    this.host.saveSettings();
    this.root.focus({ preventScroll: true });
  }

  /* ---------------------------------------------- reading progress & recents */

  private noteVisited(note: NoteRef, spread: number, spreads: number): void {
    const s = this.host.settings;
    if (!s.trackProgress || !isNote(note)) return;
    if (recordVisit(s, note.path, spread, spreads)) {
      this.host.saveSettings();
      window.clearTimeout(this.progressTimer);
      this.progressTimer = window.setTimeout(() => this.refreshProgress(), 350);
    }
  }

  /** Re-draws everything that shows reading progress. */
  refreshProgress(): void {
    this.renderList();
    this.renderRecent();
    this.stage.refreshProgress();
    if (this.shelf.isOpen) this.shelf.render(this.notebooks, this.selectedId);
    this.renderScene();
    this.refreshOutline();
  }

  private removeBookmark(b: Bookmark): void {
    const nb = this.stage.currentNotebook();
    if (!nb) return;
    const list = this.host.settings.bookmarks[nb.id] ?? [];
    this.host.settings.bookmarks[nb.id] = list.filter((x) => !(x.path === b.path && x.spread === b.spread));
    this.host.saveSettings();
    this.stage.refreshBookmarks();
  }

  private renderRecent(): void {
    this.recentEl.empty();
    const s = this.host.settings;
    if (!s.trackProgress || !s.showRecent) return;
    const items = recentNotes(s, this.notebooks, Math.max(1, s.recentCount));
    if (items.length === 0) return;
    this.recentEl.createDiv({ cls: "fv-recent-head", text: "Recently read" });
    for (const r of items) {
      const row = this.recentEl.createEl("button", { cls: "fv-recent-row", attr: { type: "button", title: `${r.note.title} · ${r.notebook.name}` } });
      setIcon(row.createSpan({ cls: "fv-recent-icon" }), "clock");
      const txt = row.createSpan({ cls: "fv-recent-text" });
      txt.createSpan({ cls: "fv-recent-title", text: r.note.title });
      txt.createSpan({ cls: "fv-recent-meta", text: `${r.notebook.name} · ${relativeTime(r.last)}` });
      row.addEventListener("click", () => void this.goToPath(r.note.path));
    }
  }

  private async customiseCover(nb: Notebook): Promise<void> {
    await this.host.customiseCover(nb);
    this.host.saveSettings();
    this.stage.applySettings();
  }

  private toggleFocus(): void {
    const on = !this.root.hasClass("fv-focus");
    this.root.toggleClass("fv-focus", on);
    if (on && this.root.requestFullscreen) {
      this.root.requestFullscreen().then(
        () => (this.fsActive = true),
        () => undefined,
      );
    } else if (!on && document.fullscreenElement === this.root) {
      this.fsActive = false;
      void document.exitFullscreen().catch(() => undefined);
    }
  }

  private checkNarrow(): void {
    const narrow = this.root.clientWidth > 0 && this.root.clientWidth < 760;
    this.updateStrip();
    if (narrow !== this.narrow) {
      this.narrow = narrow;
      this.root.toggleClass("is-narrow", narrow);
      this.updateDrawerMode();
    }
  }

  /** Panels are slide-out drawers in the scene layout and on narrow panes; fixed sidebars otherwise. */
  private updateDrawerMode(): void {
    const scene = this.host.settings.layoutStyle === "scene";
    const drawers = scene || this.narrow;
    const changed = drawers !== this.drawers;
    this.drawers = drawers;
    this.root.toggleClass("fv-drawers", drawers);
    if (changed) {
      this.root.toggleClass("is-sidebar-collapsed", drawers ? true : this.host.settings.sidebarCollapsed);
      this.root.toggleClass("is-outline-collapsed", drawers ? true : this.host.settings.outlineCollapsed);
    }
  }

  /* ------------------------------------------------------------ the scene */

  /** Renders the desk, shelf plank, brick wall and leather mat one after another so the UI appears first. */
  private applyTextures(dark: boolean): void {
    const s = this.host.settings;
    const token = ++this.texToken;
    const r = this.root.style;
    const wood = s.deskWood === "auto" ? (dark ? "walnut" : "oak") : s.deskWood;
    // the supplied desk photos by default; a generated wood if one is chosen
    r.setProperty("--fv-desk-laptop-img", `url(${dark ? deskDarkLaptop : deskLightLaptop})`);
    r.setProperty("--fv-plank-img", `url(${dark ? shelfDark : shelfLight})`);
    const jobs: Array<() => void> = [
      () => r.setProperty("--fv-desk-img", s.deskWood === "auto" ? `url(${dark ? deskDark : deskLight})` : `url(${woodTexture(1500, 940, WOODS[wood], 3, 124)})`),
      () => r.setProperty("--fv-wall-img", `url(${brickTexture(dark ? "dark" : "light")})`),
      () => r.setProperty("--fv-mat-img", `url(${leatherTexture(dark ? [30, 46, 38] : [158, 104, 62])})`),
    ];
    void BRICKS;
    const next = () => {
      const job = jobs.shift();
      if (!job || token !== this.texToken) return;
      try {
        job();
      } catch (err) {
        console.error("[flip-view] texture failed", err);
      }
      window.setTimeout(next, 16);
    };
    window.setTimeout(next, 0);
  }

  /** The shelf takes about a quarter of the window, so shelf : desk is roughly 1 : 3. */
  private stripHeight(): number {
    if (this.host.settings.shelfHidden) return 0;
    if (this.host.settings.stripCollapsed) return 46;
    const h = this.stage.el.clientHeight || this.root.clientHeight || 900;
    return Math.round(Math.min(300, Math.max(168, h * 0.25)));
  }

  private stripTimer = 0;

  private updateStrip(): void {
    if (this.host.settings.layoutStyle !== "scene") return;
    window.clearTimeout(this.stripTimer);
    this.stripTimer = window.setTimeout(() => this.stage.setScene(true, this.stripHeight()), 140);
  }

  private setStripCollapsed(c: boolean): void {
    this.host.settings.stripCollapsed = c;
    this.host.saveSettings();
    this.topShelf.setCollapsed(c);
    this.stage.setScene(true, this.stripHeight());
  }

  /** Shelf covers, the info card and the search list follow the notebooks and the current selection. */
  private renderScene(): void {
    if (this.host.settings.layoutStyle !== "scene") return;
    this.topShelf.render(this.notebooks, this.selectedId, !!this.stage.currentNotebook());
    this.info.render(this.notebooks.find((n) => n.id === this.selectedId) ?? null);
    this.search.setBooks(this.notebooks);
  }

  private regenerate(nb: Notebook): void {
    this.host.settings.coverSeeds[nb.id] = (Math.random() * 0xffffffff) >>> 0;
    this.host.saveSettings();
    this.stage.applySettings();
    this.renderScene();
  }

  /**
   * Pick a cover from the shelf: it slides off the shelf, lands on the desk and (optionally) opens.
   * The previous notebook goes back on the shelf.
   */
  private async pickFromTop(nb: Notebook, el: HTMLElement): Promise<void> {
    if (this.pickBusy) return;
    this.pickBusy = true;
    try {
      const s = this.host.settings;
      const from = this.topShelf.rectOf(nb.id);
      if (this.stage.isBookOpen()) await this.stage.close(true);
      this.selectedId = nb.id;
      s.lastNotebook = nb.id;
      this.host.saveSettings();
      this.renderList();
      this.stage.setCoverHidden(true);
      this.stage.setNotebook(nb);
      this.info.render(nb);
      this.topShelf.render(this.notebooks, nb.id, true);
      const face = await this.stage.coverClone();
      this.stage.playSfx("pull");
      if (from) await this.topShelf.fly(face, from, this.stage.closedCoverRect(), this.animMs(1150), () => this.stage.playSfx("land"));
      this.stage.setCoverHidden(false);
      if (s.openOnPick) await this.stage.open(0);
      void el;
    } finally {
      this.pickBusy = false;
    }
  }

  private renderList(): void {
    this.listEl.empty();
    const items = this.notebooks.filter((n) => !this.filter || n.name.toLowerCase().includes(this.filter));
    for (const nb of items) {
      const row = this.listEl.createEl("button", { cls: "fv-nbitem", attr: { type: "button", title: nb.name } });
      row.toggleClass("is-selected", nb.id === this.selectedId);
      setIcon(row.createSpan({ cls: "fv-nbitem-icon" }), "book");
      row.createSpan({ cls: "fv-nbitem-name", text: nb.name });
      const s = this.host.settings;
      if (s.trackProgress && s.progressSidebar) {
        const p = notebookProgress(nb, s);
        if (p.total) row.appendChild(progressEl(p, s.progressStyle));
      }
      row.createSpan({ cls: "fv-nbitem-count", text: String(realNoteCount(nb)) });
      const rename = row.createSpan({ cls: "fv-nbitem-rename", attr: { role: "button", "aria-label": "Rename notebook", title: "Rename notebook" } });
      setIcon(rename, "pencil");
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.renameNotebook(nb);
      });
      row.addEventListener("click", () => this.select(nb.id));
      row.addEventListener("dblclick", () => void this.renameNotebook(nb));
    }
    if (items.length === 0 && this.notebooks.length > 0) this.listEl.createDiv({ cls: "fv-nblist-empty", text: "No matching notebooks" });
  }

  private renderEmpty(show: boolean): void {
    this.empty.empty();
    this.empty.toggleClass("is-visible", show);
    if (!show) return;
    const s = this.host.settings;
    const box = this.empty.createDiv({ cls: "fv-empty-box fv-glass" });
    box.createEl("h3", { text: "No notebooks yet" });
    if (s.groupBy === "folder") {
      box.createEl("p", {
        text: s.rootFolder
          ? `Create a folder with notes inside "${s.rootFolder}" and it will appear here as a notebook.`
          : "Every folder that contains notes becomes a notebook. Create a folder with a few notes to get started.",
      });
    } else {
      box.createEl("p", { text: `Notes that share a "${s.propertyName}" property are grouped into a notebook. Add that property to a few notes to get started.` });
    }
    const b = box.createEl("button", { cls: "mod-cta", text: "Create a notebook", attr: { type: "button" } });
    b.addEventListener("click", () => this.host.createNotebook());
  }
}
