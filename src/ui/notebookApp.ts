import { setIcon } from "obsidian";
import { handFontInfo } from "../render/fonts";
import deskDark from "../../assets/desk/desk-dark.jpg";
import deskLight from "../../assets/desk/desk-light.jpg";
import { Notebook, NotebookHost, ViewMode } from "../types";
import { BookStage } from "./book";
import { iconButton } from "./dom";

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
  private displace: SVGElement;
  private wobbleId: string;
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
    svg.appendChild(defs);
    this.root.appendChild(svg);
    this.displace = disp;
    this.root.style.setProperty("--fv-wobble", `url(#${this.wobbleId})`);

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
      toggleFocus: () => this.toggleFocus(),
      modeChanged: (mode) => this.setMode(mode),
    });
    this.empty = this.stage.el.createDiv({ cls: "fv-empty" });

    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.root.hasClass("fv-focus") && !this.stage.currentNotebook()?.notes.length) {
        this.toggleFocus();
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
    this.applySettings();
  }

  /* ------------------------------------------------------------------ data */

  setNotebooks(list: Notebook[]): void {
    this.notebooks = list;
    let sel = list.find((n) => n.id === this.selectedId);
    if (!sel) sel = list.find((n) => n.id === this.host.settings.lastNotebook) ?? list[0];
    this.selectedId = sel?.id ?? "";
    this.renderList();
    this.stage.setNotebook(sel ?? null);
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
    if (this.narrow) this.setSidebarCollapsed(true);
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
    const font = handFontInfo(s.handFont);
    const r = this.root.style;
    r.setProperty("--fv-hand-font", `"${font.family}", "Segoe Print", "Bradley Hand", cursive`);
    s.inkColor ? r.setProperty("--fv-ink-user", s.inkColor) : r.removeProperty("--fv-ink-user");
    s.accentColor ? r.setProperty("--fv-accent-user", s.accentColor) : r.removeProperty("--fv-accent-user");
    s.textFont.trim() ? r.setProperty("--fv-text-font", s.textFont) : r.removeProperty("--fv-text-font");
    r.setProperty("--fv-desk-img", `url("${dark ? deskDark : deskLight}")`);
    this.displace.setAttribute("scale", String(1 + (s.messiness / 100) * 4));
    this.stage.applySettings();
    this.renderList();
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
    if (!this.narrow) {
      this.host.settings.sidebarCollapsed = collapsed;
      this.host.saveSettings();
    }
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
    if (narrow === this.narrow) return;
    this.narrow = narrow;
    this.root.toggleClass("is-narrow", narrow);
    this.root.toggleClass("is-sidebar-collapsed", narrow ? true : this.host.settings.sidebarCollapsed);
  }

  private renderList(): void {
    this.listEl.empty();
    const items = this.notebooks.filter((n) => !this.filter || n.name.toLowerCase().includes(this.filter));
    for (const nb of items) {
      const row = this.listEl.createEl("button", { cls: "fv-nbitem", attr: { type: "button", title: nb.name } });
      row.toggleClass("is-selected", nb.id === this.selectedId);
      setIcon(row.createSpan({ cls: "fv-nbitem-icon" }), "book");
      row.createSpan({ cls: "fv-nbitem-name", text: nb.name });
      row.createSpan({ cls: "fv-nbitem-count", text: String(nb.notes.length) });
      row.addEventListener("click", () => this.select(nb.id));
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
