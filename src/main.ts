import { Notice, Plugin, debounce } from "obsidian";
import { removeFonts, injectFonts } from "./render/fonts";
import { FlipViewSettingTab } from "./settings";
import { FlipViewSettings, freshSettings } from "./types";
import { NotebookItemView, VIEW_TYPE } from "./view";

export default class FlipViewPlugin extends Plugin {
  settings: FlipViewSettings = freshSettings();

  saveQuietly = debounce(() => void this.saveData(this.settings), 500, true);
  private refreshViewsDebounced = debounce(() => this.views().forEach((v) => v.settingsChanged()), 350, true);

  async onload(): Promise<void> {
    await this.loadSettings();
    injectFonts();

    this.registerView(VIEW_TYPE, (leaf) => new NotebookItemView(leaf, this));
    this.addRibbonIcon("library", "Open notebook view", () => void this.activateView());

    this.addCommand({
      id: "open-notebook-view",
      name: "Open notebook view",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "show-note-in-notebook",
      name: "Show current note in its notebook",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) void this.activateView(file.path);
        return true;
      },
    });
    this.addCommand({
      id: "toggle-handwritten-text",
      name: "Toggle handwritten / text preview",
      callback: () => {
        this.settings.viewMode = this.settings.viewMode === "handwritten" ? "text" : "handwritten";
        void this.saveSettings();
      },
    });

    this.addSettingTab(new FlipViewSettingTab(this.app, this));

    // keep per-note data (highlights, manual order) attached when a note is renamed or moved
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const s = this.settings;
        if (s.highlights[oldPath]) {
          s.highlights[file.path] = s.highlights[oldPath];
          delete s.highlights[oldPath];
        }
        for (const id of Object.keys(s.noteOrder)) s.noteOrder[id] = s.noteOrder[id].map((k) => (k === oldPath ? file.path : k));
        this.saveQuietly();
      }),
    );
  }

  onunload(): void {
    removeFonts();
  }

  private views(): NotebookItemView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view as NotebookItemView);
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<FlipViewSettings> | null;
    const base = freshSettings();
    this.settings = { ...base, ...saved };
    // make sure nested containers always exist, even for data saved by older versions
    for (const k of ["coverSeeds", "noteOrder", "separators", "notebookNames", "coverOverrides", "highlights"] as const) {
      (this.settings as unknown as Record<string, unknown>)[k] = { ...(base[k] as object), ...((saved?.[k] as object | undefined) ?? {}) };
    }
    if (!Array.isArray(this.settings.highlighters)) this.settings.highlighters = base.highlighters;
  }

  /** Persists settings and refreshes every open notebook view. */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshViewsDebounced();
  }

  async activateView(revealPath?: string): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
    if (revealPath) {
      const view = leaf.view as NotebookItemView;
      // the view may have just been created; give it a beat to load its notebooks
      window.setTimeout(() => void view.ui?.revealNote(revealPath), 250);
    }
  }

  afterNotebookCreated(id: string): void {
    this.settings.lastNotebook = id;
    void this.saveData(this.settings);
    new Notice("Notebook created");
    window.setTimeout(() => {
      this.views().forEach((v) => {
        v.refreshNotebooks();
        v.ui?.select(id);
      });
    }, 800);
  }
}
