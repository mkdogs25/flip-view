import { Notice, Plugin, debounce } from "obsidian";
import { removeFonts, injectFonts } from "./render/fonts";
import { FlipViewSettingTab } from "./settings";
import { DEFAULT_SETTINGS, FlipViewSettings } from "./types";
import { NotebookItemView, VIEW_TYPE } from "./view";

export default class FlipViewPlugin extends Plugin {
  settings: FlipViewSettings = { ...DEFAULT_SETTINGS, coverSeeds: {} };

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
  }

  onunload(): void {
    removeFonts();
  }

  private views(): NotebookItemView[] {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view as NotebookItemView);
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<FlipViewSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...saved, coverSeeds: { ...(saved?.coverSeeds ?? {}) } };
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
