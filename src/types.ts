export interface NoteRef {
  path: string;
  title: string;
  mtime: number;
  ctime: number;
}

export interface Notebook {
  /** Stable identifier, e.g. `folder:Physics` or `prop:Physics`. */
  id: string;
  name: string;
  notes: NoteRef[];
}

export type ViewMode = "handwritten" | "text";
export type GroupBy = "folder" | "property";
export type CoverStyle = "random" | "cosmic" | "leather" | "linen" | "marble" | "geometric";
export type PaperStyle = "plain" | "lined" | "grid" | "dotted";
export type HandFont = "caveat" | "kalam" | "patrick-hand" | "reenie-beanie" | "indie-flower" | "shadows-into-light";

export interface FlipViewSettings {
  // grouping
  groupBy: GroupBy;
  rootFolder: string;
  folderScope: "top" | "all";
  excludedFolders: string;
  propertyName: string;
  includeUnfiled: boolean;
  noteSort: "name-asc" | "name-desc" | "modified-desc" | "modified-asc" | "created-asc" | "created-desc";
  notebookSort: "name" | "recent" | "count";

  // appearance
  viewMode: ViewMode;
  theme: "auto" | "light" | "dark";
  showDesk: boolean;
  coverStyle: CoverStyle;
  paperStyle: PaperStyle;
  animation: "full" | "fast" | "off";
  showNoteTitle: boolean;
  showLastEdited: boolean;
  accentColor: string;

  // handwriting
  handFont: HandFont;
  handSize: number; // percent
  messiness: number; // 0..100
  inkColor: string;

  // text view
  textFont: string;
  textSize: number; // percent

  // state
  coverSeeds: Record<string, number>;
  coverSalt: number;
  lastNotebook: string;
  sidebarCollapsed: boolean;
}

export const DEFAULT_SETTINGS: FlipViewSettings = {
  groupBy: "folder",
  rootFolder: "",
  folderScope: "top",
  excludedFolders: "",
  propertyName: "notebook",
  includeUnfiled: false,
  noteSort: "name-asc",
  notebookSort: "name",

  viewMode: "handwritten",
  theme: "auto",
  showDesk: true,
  coverStyle: "random",
  paperStyle: "plain",
  animation: "full",
  showNoteTitle: true,
  showLastEdited: true,
  accentColor: "",

  handFont: "caveat",
  handSize: 100,
  messiness: 35,
  inkColor: "",

  textFont: "",
  textSize: 100,

  coverSeeds: {},
  coverSalt: 0,
  lastNotebook: "",
  sidebarCollapsed: false,
};

/** Everything the UI needs from Obsidian. Lets the UI be driven by a mock in the dev harness. */
export interface NotebookHost {
  readonly settings: FlipViewSettings;
  saveSettings(): void;
  getNotebooks(): Notebook[];
  /** Renders the note's markdown into `el`; resolves to a disposer. */
  renderNote(note: NoteRef, el: HTMLElement): Promise<() => void>;
  openNote(path: string, newTab: boolean): void;
  openLink(href: string, sourcePath: string, newTab: boolean): void;
  openExternal(href: string): void;
  createNotebook(): void;
  openSettings(): void;
  showHelp(): void;
  isDarkTheme(): boolean;
}
