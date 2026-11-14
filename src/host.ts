import { Component, MarkdownRenderer, Notice, TFile, finishRenderMath, normalizePath } from "obsidian";
import { buildNotebooks } from "./grouping";
import { CoverModal, HelpModal, NewNotebookModal, PromptModal } from "./modals";
import { MathItem, extractMath, restoreMath } from "./render/handmath";
import type FlipViewPlugin from "./main";
import { FlipViewSettings, NotebookHost, NoteRef, Notebook } from "./types";

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

export class ObsidianHost implements NotebookHost {
  constructor(private plugin: FlipViewPlugin, private owner: Component) {}

  get settings(): FlipViewSettings {
    return this.plugin.settings;
  }

  saveSettings(): void {
    this.plugin.saveQuietly();
  }

  getNotebooks(): Notebook[] {
    return buildNotebooks(this.plugin.app, this.plugin.settings);
  }

  async renderNote(note: NoteRef, el: HTMLElement, opts: { hand: boolean }): Promise<() => void> {
    const { app } = this.plugin;
    const file = app.vault.getAbstractFileByPath(note.path);
    if (!(file instanceof TFile)) throw new Error(`Note not found: ${note.path}`);
    let md = (await app.vault.read(file)).replace(FRONTMATTER, "");
    if (this.settings.showNoteTitle && !/^\s*#\s+\S/.test(md)) md = `# ${note.title}\n\n${md}`;
    let math: MathItem[] = [];
    if (opts.hand) {
      const x = extractMath(md);
      md = x.md;
      math = x.items;
    }
    const child = new Component();
    this.owner.addChild(child);
    try {
      await MarkdownRenderer.render(app, md, el, note.path, child);
      if (opts.hand) restoreMath(el, math);
      else await finishRenderMath().catch(() => undefined); // flushes the MathJax stylesheet, or equations stay unstyled
    } catch (err) {
      console.error("[flip-view] render failed", err);
      el.createEl("p", { text: "This note could not be rendered." });
    }
    return () => this.owner.removeChild(child);
  }

  promptText(opts: { title: string; value?: string; hint?: string; placeholder?: string; resetLabel?: string }): Promise<string | null> {
    return new Promise((resolve) => new PromptModal(this.plugin.app, opts, resolve).open());
  }

  customiseCover(nb: Notebook): Promise<void> {
    return new Promise((resolve) => new CoverModal(this.plugin.app, this.plugin.settings, nb, resolve).open());
  }

  async readNoteText(path: string): Promise<string> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error("Note not found");
    return this.plugin.app.vault.read(file);
  }

  async writeNoteText(path: string, text: string): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) throw new Error("Note not found");
    await this.plugin.app.vault.modify(file, text);
  }

  openNote(path: string, newTab: boolean): void {
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    const leaf = this.plugin.app.workspace.getLeaf(newTab ? "split" : "tab");
    void leaf.openFile(file);
  }

  openLink(href: string, sourcePath: string, newTab: boolean): void {
    void this.plugin.app.workspace.openLinkText(href, sourcePath, newTab ? "split" : "tab");
  }

  resolveLink(href: string, sourcePath: string): { path: string; heading?: string } | null {
    const hash = href.indexOf("#");
    const linkPath = hash >= 0 ? href.slice(0, hash) : href;
    const sub = hash >= 0 ? href.slice(hash + 1) : "";
    let path: string | null = sourcePath;
    if (linkPath) path = this.plugin.app.metadataCache.getFirstLinkpathDest(linkPath, sourcePath)?.path ?? null;
    if (!path) return null;
    let heading: string | undefined;
    if (sub && !sub.startsWith("^")) {
      const last = sub.split("#").pop() ?? "";
      try {
        heading = decodeURIComponent(last);
      } catch {
        heading = last;
      }
    }
    return { path, heading };
  }

  openExternal(href: string): void {
    window.open(href, "_blank", "noopener");
  }

  createNotebook(): void {
    const s = this.settings;
    const hint =
      s.groupBy === "folder"
        ? `A new folder is created${s.rootFolder ? ` inside "${s.rootFolder}"` : ""} with a first note in it.`
        : `A first note is created with the property "${s.propertyName}" set to the notebook's name.`;
    new NewNotebookModal(this.plugin.app, hint, (name) => void this.create(name)).open();
  }

  private async create(name: string): Promise<void> {
    const { app } = this.plugin;
    const s = this.settings;
    try {
      let id: string;
      if (s.groupBy === "folder") {
        const root = s.rootFolder.trim().replace(/^\/+|\/+$/g, "");
        const folder = normalizePath([root, name].filter(Boolean).join("/"));
        if (app.vault.getAbstractFileByPath(folder)) {
          new Notice(`"${name}" already exists.`);
          return;
        }
        await app.vault.createFolder(folder);
        await app.vault.create(`${folder}/First note.md`, "# First note\n\n");
        id = `folder:${root ? root + "/" : ""}${name}`;
      } else {
        let path = normalizePath(`${name}.md`);
        for (let i = 2; app.vault.getAbstractFileByPath(path); i++) path = normalizePath(`${name} ${i}.md`);
        await app.vault.create(path, `---\n${s.propertyName}: ${name}\n---\n\n# ${name}\n\n`);
        id = `prop:${name.toLowerCase()}`;
      }
      this.plugin.afterNotebookCreated(id);
    } catch (err) {
      console.error("[flip-view] could not create notebook", err);
      new Notice("Could not create the notebook. See the console for details.");
    }
  }

  openSettings(): void {
    const setting = (this.plugin.app as unknown as { setting?: { open(): void; openTabById(id: string): void } }).setting;
    setting?.open();
    setting?.openTabById(this.plugin.manifest.id);
  }

  showHelp(): void {
    new HelpModal(this.plugin.app).open();
  }

  isDarkTheme(): boolean {
    return document.body.classList.contains("theme-dark");
  }
}
