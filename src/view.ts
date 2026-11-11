import { ItemView, WorkspaceLeaf, debounce } from "obsidian";
import { ObsidianHost } from "./host";
import type FlipViewPlugin from "./main";
import { NotebookApp } from "./ui/notebookApp";

export const VIEW_TYPE = "flip-view-notebooks";

export class NotebookItemView extends ItemView {
  ui: NotebookApp | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: FlipViewPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Notebook view";
  }

  getIcon(): string {
    return "library";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("fv-host");
    this.ui = new NotebookApp(this.contentEl, new ObsidianHost(this.plugin, this));
    this.refreshNotebooks();

    const { vault, metadataCache, workspace } = this.app;
    const schedule = debounce(() => this.refreshNotebooks(), 600, true);
    this.registerEvent(vault.on("create", schedule));
    this.registerEvent(vault.on("delete", schedule));
    this.registerEvent(vault.on("rename", schedule));
    this.registerEvent(metadataCache.on("resolved", schedule));
    this.registerEvent(
      metadataCache.on("changed", (file) => {
        this.ui?.fileChanged(file.path);
        schedule();
      }),
    );
    this.registerEvent(workspace.on("css-change", () => this.ui?.applySettings()));
  }

  async onClose(): Promise<void> {
    this.ui?.destroy();
    this.ui = null;
  }

  refreshNotebooks(): void {
    this.ui?.setNotebooks(new ObsidianHost(this.plugin, this).getNotebooks());
  }

  /** Settings changed: restyle and regroup. */
  settingsChanged(): void {
    this.ui?.applySettings();
    this.refreshNotebooks();
  }
}
