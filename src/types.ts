/** A page group in a notebook: either a real note or a user-made separator page. */
export interface NoteRef {
  path: string;
  title: string;
  mtime: number;
  ctime: number;
  kind?: "note" | "separator" | "index";
  /** Separators only. */
  sepId?: string;
  /** File size in bytes (notes only), used to estimate page counts before a note has been laid out. */
  size?: number;
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
export const isIndex = (n: NoteRef | undefined | null): boolean => n?.kind === "index";
/** A real note, not a separator page or the index. */
export const isNote = (n: NoteRef | undefined | null): boolean => !!n && n.kind !== "separator" && n.kind !== "index";
export const realNoteCount = (nb: Notebook): number => nb.notes.filter(isNote).length;

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
  | "waves"
  | "suede"
  | "canvas"
  | "cork"
  | "woodgrain"
  | "denim";
export type CoverLabel = "plate" | "foil" | "sticker";
export type SpineStyle = "plain" | "banded" | "striped" | "foil" | "label" | "ribbed";
export type BandStyle = "none" | "vertical" | "horizontal" | "double";
export type PaperColor = "cream" | "white" | "ivory" | "yellow" | "grey" | "blue" | "sepia" | "custom";
export type PageTexture = "fine" | "none" | "rough" | "laid" | "linen" | "speckled";
export type PageLayout = "classic" | "realistic" | "wide";
export type WriteTool = "pen" | "pencil" | "marker" | "text" | "eraser";
export type ProgressMode = "opened" | "finished" | "pages";
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
  | "la-belle-aurore"
  | "great-vibes"
  | "allura"
  | "architects-daughter"
  | "gochi-hand"
  | "covered-by-your-grace"
  | "handlee"
  | "schoolbell"
  | "just-another-hand"
  | "zeyada"
  | "nothing-you-could-do"
  | "permanent-marker";

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
  /** Optional margin note typed against the highlight. */
  note?: string;
}

/** Freehand ink or typed text written on a page. Coordinates are fractions of the page (0..1). */
export interface Annotation {
  id: string;
  kind: "stroke" | "text";
  /** Page index within the note. */
  page: number;
  tool: WriteTool;
  color: string;
  /** Stroke: flat [x0, y0, x1, y1, ...]. */
  points?: number[];
  /** Text: top-left position and the text itself. */
  x?: number;
  y?: number;
  text?: string;
}

export interface ReadEntry {
  /** First time the note was opened in the book (ms). */
  opened: number;
  /** Most recent time it was open (ms). */
  last: number;
  visits: number;
  /** Furthest spread reached, and how many spreads the note had then. */
  maxSpread: number;
  spreads: number;
  finished: boolean;
}

export interface Bookmark {
  path: string;
  spread: number;
  at: number;
}

export interface CoverOverride {
  style?: CoverStyle;
  color?: string;
  spine?: SpineStyle;
  band?: BandStyle;
  bandColor?: string;
  ribbonColor?: string;
  paper?: PaperColor;
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
  bandStyle: BandStyle;
  bandColor: string;
  spineStyle: SpineStyle;
  ribbon: boolean;
  ribbonColor: string;
  paperColor: PaperColor;
  paperCustom: string;
  pageTexture: PageTexture;
  pageLayout: PageLayout;
  marginNotes: boolean;
  /** 0..100: how much line spacing wanders in handwriting (ignored on ruled paper). */
  lineVariance: number;
  outlineCollapsed: boolean;
  shelfMode: boolean;
  /** "scene": shelf of covers above the desk, panels as drawers. "classic": sidebars on either side. */
  layoutStyle: "scene" | "classic";
  stripCollapsed: boolean;
  infoCollapsed: boolean;
  /** Open a notebook straight away when you pick it from the shelf. */
  openOnPick: boolean;
  showPageNumbers: boolean;

  // index page
  indexEnabled: boolean;
  indexTitle: string;
  indexPageNumbers: boolean;
  indexLastEdited: boolean;
  indexCreated: boolean;
  indexSections: boolean;
  indexStatus: boolean;
  indexBookmarks: boolean;
  indexLeader: "dots" | "line" | "none";
  indexDates: "short" | "long" | "relative";

  // reading progress
  trackProgress: boolean;
  progressMode: ProgressMode;
  progressStyle: "ring" | "bar" | "count";
  progressSidebar: boolean;
  progressCover: boolean;
  progressShelf: boolean;
  showRecent: boolean;
  recentCount: number;

  // writing tools
  writeColors: Record<"pen" | "pencil" | "marker", string>;

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
  /** note path -> ink and typed text */
  annotations: Record<string, Annotation[]>;
  /** note path -> reading history */
  readState: Record<string, ReadEntry>;
  /** notebook id -> bookmarks */
  bookmarks: Record<string, Bookmark[]>;
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
  bandStyle: "vertical",
  bandColor: "",
  spineStyle: "banded",
  ribbon: true,
  ribbonColor: "#b5303a",
  paperColor: "cream",
  paperCustom: "#f4ead2",
  pageTexture: "fine",
  pageLayout: "realistic",
  marginNotes: true,
  lineVariance: 30,
  outlineCollapsed: false,
  shelfMode: false,
  layoutStyle: "scene",
  stripCollapsed: false,
  infoCollapsed: false,
  openOnPick: true,
  showPageNumbers: true,

  indexEnabled: true,
  indexTitle: "Contents",
  indexPageNumbers: true,
  indexLastEdited: true,
  indexCreated: false,
  indexSections: true,
  indexStatus: true,
  indexBookmarks: true,
  indexLeader: "dots",
  indexDates: "short",

  trackProgress: true,
  progressMode: "opened",
  progressStyle: "ring",
  progressSidebar: true,
  progressCover: true,
  progressShelf: true,
  showRecent: true,
  recentCount: 5,

  writeColors: { pen: "#1d2a6b", pencil: "#4b4b55", marker: "#ff5fa8" },

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
  annotations: {},
  readState: {},
  bookmarks: {},
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
