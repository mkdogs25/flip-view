/** A page group in a notebook: either a real note or a user-made separator page. */
export interface NoteRef {
  path: string;
  title: string;
  mtime: number;
  ctime: number;
  kind?: "note" | "separator";
  /** Separators only. */
  sepId?: string;
}

export interface Notebook {
  /** Stable identifier, e.g. `folder:Physics` or `prop:physics`. */
  id: string;
  /** Display name (user rename applied). */
  name: string;
  /** Name derived from the folder / property value. */
  originalName: string;
  /** Notes and separators, in reading order. */
  notes: NoteRef[];
}

export const isSeparator = (n: NoteRef | undefined | null): boolean => n?.kind === "separator";
export const realNoteCount = (nb: Notebook): number => nb.notes.filter((n) => n.kind !== "separator").length;

export type ViewMode = "handwritten" | "text";
export type GroupBy = "folder" | "property";
export type CoverStyle =
  | "random"
  | "cosmic"
  | "leather"
  | "linen"
  | "marble"
  | "geometric"
  | "plain"
  | "kraft"
  | "gradient"
  | "watercolor"
  | "terrazzo"
  | "waves";
export type CoverLabel = "plate" | "foil" | "sticker";
export type TextCase = "normal" | "smallcaps" | "uppercase";
export type PaperStyle = "plain" | "lined" | "grid" | "dotted";
export type HandFont =
  | "caveat"
  | "kalam"
  | "patrick-hand"
  | "reenie-beanie"
  | "indie-flower"
  | "shadows-into-light"
  | "dancing-script"
  | "alex-brush"
  | "la-belle-aurore";

export interface HighlighterDef {
  color: string;
  label: string;
}

export interface Highlight {
  id: string;
  /** Character offsets into the rendered note text; `quote` re-anchors them if the text moved. */
  start: number;
  end: number;
  quote: string;
  /** Index into the highlighter list; `color` is the fallback if that highlighter was removed. */
  slot: number;
  color: string;
}

export interface CoverOverride {
  style?: CoverStyle;
  color?: string;
}

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
  /** How pages are turned: click a page, pull its corner, or only the nav bar. */
  flipMode: "click" | "drag" | "nav";
  showNoteTitle: boolean;
  showLastEdited: boolean;
  accentColor: string;
  coverColor: string;
  coverLabel: CoverLabel;
  coverBand: boolean;
  outlineCollapsed: boolean;

  // handwriting
  handFont: HandFont;
  handSize: number; // percent
  messiness: number; // 0..100
  inkColor: string;
  headingFont: HandFont | "same";
  headingCase: TextCase;
  bodyCase: TextCase;

  // highlighters
  highlighters: HighlighterDef[];
  showLegend: boolean;
  legendPos: { x: number; y: number } | null;

  // sound
  soundEnabled: boolean;
  soundVolume: number; // 0..100

  // text view
  textFont: string;
  textSize: number; // percent

  // state
  coverSeeds: Record<string, number>;
  coverSalt: number;
  lastNotebook: string;
  sidebarCollapsed: boolean;
  /** notebook id -> ordered keys (note paths, or `sep:<id>`) */
  noteOrder: Record<string, string[]>;
  /** notebook id -> separator id -> title */
  separators: Record<string, Record<string, string>>;
  /** notebook id -> display name */
  notebookNames: Record<string, string>;
  coverOverrides: Record<string, CoverOverride>;
  /** note path -> highlights */
  highlights: Record<string, Highlight[]>;
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
  flipMode: "click",
  showNoteTitle: true,
  showLastEdited: true,
  accentColor: "",
  coverColor: "",
  coverLabel: "plate",
  coverBand: true,
  outlineCollapsed: false,

  handFont: "caveat",
  handSize: 100,
  messiness: 35,
  inkColor: "",
  headingFont: "same",
  headingCase: "smallcaps",
  bodyCase: "normal",

  highlighters: [
    { color: "#ffe45e", label: "Important" },
    { color: "#ff9ecb", label: "Definition" },
    { color: "#8de58a", label: "Example" },
    { color: "#8fd3ff", label: "Question" },
  ],
  showLegend: true,
  legendPos: null,

  soundEnabled: true,
  soundVolume: 45,

  textFont: "",
  textSize: 100,

  coverSeeds: {},
  coverSalt: 0,
  lastNotebook: "",
  sidebarCollapsed: false,
  noteOrder: {},
  separators: {},
  notebookNames: {},
  coverOverrides: {},
  highlights: {},
};

/** A fresh settings object that shares no mutable state with the defaults. */
export function freshSettings(): FlipViewSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as FlipViewSettings;
}

/** Everything the UI needs from Obsidian. Lets the UI be driven by a mock in the dev harness. */
export interface NotebookHost {
  readonly settings: FlipViewSettings;
  saveSettings(): void;
  getNotebooks(): Notebook[];
  /** Renders the note's markdown into `el`; resolves to a disposer. `hand` asks for maths to be set as handwriting. */
  renderNote(note: NoteRef, el: HTMLElement, opts: { hand: boolean }): Promise<() => void>;
  /** Asks the user for a line of text. Resolves to null if cancelled. */
  promptText(opts: { title: string; value?: string; hint?: string; placeholder?: string; resetLabel?: string }): Promise<string | null>;
  /** Opens the per-notebook cover options. Resolves when closed. */
  customiseCover(nb: Notebook): Promise<void>;
  openNote(path: string, newTab: boolean): void;
  openLink(href: string, sourcePath: string, newTab: boolean): void;
  openExternal(href: string): void;
  createNotebook(): void;
  openSettings(): void;
  showHelp(): void;
  /** Resolves an internal link to a vault path (and heading), or null if it points nowhere. */
  resolveLink(href: string, sourcePath: string): { path: string; heading?: string } | null;
  isDarkTheme(): boolean;
}
