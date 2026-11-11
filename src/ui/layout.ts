import { applyHighlight, highlightColor, removeHighlightEls } from "../render/highlights";
import { handwrite, prepareForPages } from "../render/handwriting";
import { formatDateAs, NoteStatus } from "../progress";
import { Annotation, FlipViewSettings, NotebookHost, Notebook, NoteRef, isIndex, isSeparator } from "../types";
import { ensureInkLayer, renderInk } from "./ink";

export interface LayoutConfig {
  mode: "handwritten" | "text";
  /** Inner (content) size of one page in px. */
  w: number;
  h: number;
  gap: number;
  messiness: number;
  /** 0..1, how much words may drift off the baseline (ruled paper keeps them on the line). */
  tame: number;
  /** 0..1, how much line spacing wanders (handwriting on plain paper only). */
  lineVar: number;
  /** Pull `[!margin]` callouts and highlight notes out into the page margin. */
  margin: boolean;
  /** Anything that should invalidate cached layouts when it changes. */
  signature: string;
}

export interface Heading {
  text: string;
  level: number;
  page: number;
}

export interface MarginNote {
  page: number;
  /** Distance from the top of the page's text area, px. */
  y: number;
  text: string;
  hlId?: string;
}

export interface IndexData {
  nb: Notebook;
  /** First folio of each item (null for separators and the index itself). */
  folios: Array<{ folio: number; exact: boolean } | null>;
  status(path: string): NoteStatus;
  bookmarked(path: string): boolean;
  /** Changes whenever anything the index shows changes. */
  signature: string;
}

export interface PageOpts {
  folio?: number;
  annots?: Annotation[];
  /** Running head shown on realistic page layouts. */
  head?: string;
}

export interface EngineHooks {
  measured(note: NoteRef, pages: number): void;
  index(): IndexData | null;
}

export class NoteLayout {
  constructor(
    readonly note: NoteRef,
    private flow: HTMLElement,
    readonly pageCount: number,
    private step: number,
    private disposeFn: () => void,
    readonly headings: Heading[],
    readonly hlPages: Map<string, number>,
    readonly margins: MarginNote[] = [],
  ) {}

  get spreads(): number {
    return Math.max(1, Math.ceil(this.pageCount / 2));
  }

  get separator(): boolean {
    return isSeparator(this.note);
  }

  get index(): boolean {
    return isIndex(this.note);
  }

  /** Builds a page element showing column `index` of the flowed note (blank past the end). */
  pageEl(index: number, side: "left" | "right", opts: PageOpts = {}): HTMLElement {
    const page = createDiv({ cls: `fv-page fv-page-${side}` });
    page.dataset.index = String(index);
    const inner = page.createDiv({ cls: "fv-page-inner" });
    if (index < this.pageCount) {
      const clone = this.flow.cloneNode(true) as HTMLElement;
      clone.style.transform = `translateX(${-index * this.step}px)`;
      clone.dataset.page = String(index);
      inner.appendChild(clone);
      if (!this.separator && !this.index) {
        const no = page.createDiv({ cls: "fv-page-no", text: String(opts.folio ?? index + 1) });
        no.dataset.index = String(index);
        if (opts.head) page.createDiv({ cls: "fv-page-head", text: opts.head });
      }
    }
    this.renderMargins(page, index);
    if (opts.annots) renderInk(page, opts.annots.filter((a) => a.page === index));
    else ensureInkLayer(page);
    if (this.separator && side === "right") {
      const tab = page.createDiv({ cls: "fv-sep-tab" });
      tab.createSpan({ text: this.note.title });
    }
    return page;
  }

  /** Margin notes for one page. They sit in the outer margin, nudged apart so they don't overlap. */
  renderMargins(page: HTMLElement, index: number): void {
    page.querySelectorAll(":scope > .fv-margin-note").forEach((n) => n.remove());
    let floor = 0;
    for (const m of this.margins.filter((x) => x.page === index).sort((a, b) => a.y - b.y)) {
      const note = page.createDiv({ cls: "fv-margin-note", text: m.text });
      const y = Math.max(m.y, floor);
      note.style.top = `calc(var(--fv-pt) + ${y}px)`;
      if (m.hlId) note.dataset.hl = m.hlId;
      floor = y + (Math.ceil(m.text.length / 15) + 1) * 19;
    }
  }

  addHighlight(h: Parameters<typeof applyHighlight>[1], color: string, page: number, y?: number): void {
    applyHighlight(this.flow, h, color);
    this.hlPages.set(h.id, page);
    if (h.note && y !== undefined) this.margins.push({ page, y, text: h.note, hlId: h.id });
  }

  recolorHighlight(id: string, color: string): void {
    this.flow.querySelectorAll<HTMLElement>(`.fv-hl[data-hl="${id}"]`).forEach((el) => el.style.setProperty("--hl", color));
  }

  removeHighlight(id: string): void {
    removeHighlightEls(this.flow, id);
    this.hlPages.delete(id);
    const i = this.margins.findIndex((m) => m.hlId === id);
    if (i >= 0) this.margins.splice(i, 1);
  }

  dispose(): void {
    this.disposeFn();
    this.flow.remove();
  }
}

interface Entry {
  sig: string;
  mtime: number;
  promise: Promise<NoteLayout>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function waitForImages(root: HTMLElement, timeout = 2500): Promise<void> {
  const pending = Array.from(root.querySelectorAll("img")).filter((i) => !i.complete);
  if (pending.length === 0) return;
  await Promise.race([
    Promise.all(pending.map((img) => new Promise<void>((res) => { img.onload = img.onerror = () => res(); }))),
    sleep(timeout),
  ]);
}

/** Renders notes into a hidden measuring box, splits them into page-sized CSS columns and caches the result. */
export class LayoutEngine {
  private cache = new Map<string, Entry>();

  constructor(private host: NotebookHost, private measureEl: HTMLElement, private hooks: EngineHooks) {}

  get(note: NoteRef, cfg: LayoutConfig): Promise<NoteLayout> {
    const extra = isIndex(note) ? (this.hooks.index()?.signature ?? "") : "";
    const sig = `${cfg.mode}|${cfg.w}x${cfg.h}|${cfg.gap}|${cfg.messiness}|${cfg.tame}|${cfg.lineVar}|${cfg.margin}|${cfg.signature}|${extra}`;
    const hit = this.cache.get(note.path);
    if (hit && hit.sig === sig && hit.mtime === note.mtime) {
      // refresh LRU position
      this.cache.delete(note.path);
      this.cache.set(note.path, hit);
      return hit.promise;
    }
    if (hit) void hit.promise.then((l) => l.dispose(), () => undefined);
    const promise = this.build(note, cfg);
    this.cache.set(note.path, { sig, mtime: note.mtime, promise });
    promise.catch(() => this.cache.delete(note.path));
    while (this.cache.size > 8) {
      const oldest = this.cache.keys().next().value as string;
      const e = this.cache.get(oldest);
      this.cache.delete(oldest);
      void e?.promise.then((l) => l.dispose(), () => undefined);
    }
    return promise;
  }

  invalidate(path?: string): void {
    const drop = (key: string) => {
      const e = this.cache.get(key);
      this.cache.delete(key);
      void e?.promise.then((l) => l.dispose(), () => undefined);
    };
    if (path) drop(path);
    else [...this.cache.keys()].forEach(drop);
  }

  private async build(note: NoteRef, cfg: LayoutConfig): Promise<NoteLayout> {
    const flow = createDiv({ cls: "fv-flow markdown-rendered" });
    flow.style.width = `${cfg.w}px`;
    flow.style.height = `${cfg.h}px`;
    flow.style.columnWidth = `${cfg.w}px`;
    flow.style.columnGap = `${cfg.gap}px`;
    this.measureEl.appendChild(flow);

    let dispose: () => void = () => undefined;
    const margins: MarginNote[] = [];
    if (isIndex(note)) {
      flow.addClass("fv-flow-index");
      const data = this.hooks.index();
      if (data) buildIndexFlow(flow, data, this.host.settings);
    } else if (isSeparator(note)) {
      flow.addClass("fv-flow-sep");
      flow.createDiv({ cls: "fv-sep-spacer" });
      const sep = flow.createDiv({ cls: "fv-sep" });
      sep.createEl("h1", { cls: "fv-sep-title", text: note.title });
      sep.createDiv({ cls: "fv-sep-flourish" });
    } else {
      dispose = await this.host.renderNote(note, flow, { hand: cfg.mode === "handwritten" });
    }
    // [!margin] / [!aside] callouts leave the text and become margin notes
    const callouts: string[] = [];
    if (cfg.margin && !isIndex(note) && !isSeparator(note)) {
      flow.querySelectorAll<HTMLElement>('.callout[data-callout="margin"], .callout[data-callout="aside"]').forEach((c) => {
        const content = c.querySelector(".callout-content") ?? c;
        const text = (content.textContent ?? "").trim();
        const anchor = document.createElement("span");
        anchor.className = "fv-margin-anchor";
        anchor.dataset.m = String(callouts.length);
        callouts.push(text);
        c.replaceWith(anchor);
      });
    }
    if (cfg.mode === "handwritten") handwrite(flow, note.path, cfg.messiness / 100, cfg.tame, cfg.lineVar);
    prepareForPages(flow);

    // saved highlights
    const s = this.host.settings;
    for (const h of s.highlights[note.path] ?? []) applyHighlight(flow, h, highlightColor(h, s.highlighters));

    try {
      await document.fonts.load(`20px ${getComputedStyle(flow).fontFamily.split(",")[0]}`);
      await document.fonts.ready;
    } catch {
      /* fonts API unavailable – measure with whatever is loaded */
    }
    await waitForImages(flow);
    await sleep(30); // let late post-processors (embeds, math) settle

    const step = cfg.w + cfg.gap;
    const pages = Math.max(1, Math.round((flow.scrollWidth + cfg.gap) / step));
    const left = flow.getBoundingClientRect().left;
    const pageOf = (el: Element): number => {
      const r = el.getClientRects()[0];
      return r ? Math.max(0, Math.floor((r.left - left + 2) / step)) : 0;
    };
    const headings: Heading[] = Array.from(flow.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => ({
      text: (h.textContent ?? "").trim(),
      level: Number(h.tagName[1]),
      page: pageOf(h),
    }));
    const hlPages = new Map<string, number>();
    const top = flow.getBoundingClientRect().top;
    const yOf = (el: Element): number => (el.getClientRects()[0]?.top ?? top) - top;
    flow.querySelectorAll<HTMLElement>(".fv-hl").forEach((el) => {
      const id = el.dataset.hl;
      if (id && !hlPages.has(id)) {
        hlPages.set(id, pageOf(el));
        const h = (s.highlights[note.path] ?? []).find((x) => x.id === id);
        if (cfg.margin && h?.note) margins.push({ page: pageOf(el), y: yOf(el), text: h.note, hlId: id });
      }
    });
    flow.querySelectorAll<HTMLElement>(".fv-margin-anchor").forEach((el) => {
      margins.push({ page: pageOf(el), y: yOf(el), text: callouts[Number(el.dataset.m)] ?? "" });
    });
    flow.remove();
    this.hooks.measured(note, pages);
    return new NoteLayout(note, flow, pages, step, dispose, headings.filter((h) => h.text), hlPages, margins);
  }
}


/** The contents page: section headings and clickable note rows with dates, status and page numbers. */
function buildIndexFlow(flow: HTMLElement, data: IndexData, s: FlipViewSettings): void {
  const wrap = flow.createDiv({ cls: "fv-index" });
  wrap.createEl("h1", { cls: "fv-index-title", text: s.indexTitle.trim() || "Contents" });
  const count = data.nb.notes.filter((n) => n.kind !== "separator" && n.kind !== "index").length;
  wrap.createDiv({ cls: "fv-index-sub", text: `${data.nb.name} · ${count} ${count === 1 ? "note" : "notes"}` });
  data.nb.notes.forEach((n, i) => {
    if (n.kind === "index") return;
    if (n.kind === "separator") {
      if (!s.indexSections) return;
      const sec = wrap.createDiv({ cls: "fv-idx-section", attr: { "data-idx": String(i), role: "link" } });
      sec.createSpan({ text: n.title });
      return;
    }
    const row = wrap.createDiv({ cls: "fv-idx-row", attr: { "data-idx": String(i), role: "link" } });
    if (s.indexStatus) {
      const st = data.status(n.path);
      row.createSpan({ cls: `fv-idx-status is-${st}`, text: st === "finished" ? "✓" : st === "opened" ? "●" : "○" });
    }
    if (s.indexBookmarks && data.bookmarked(n.path)) row.createSpan({ cls: "fv-idx-star", text: "★" });
    row.createSpan({ cls: "fv-idx-title", text: n.title });
    if (s.indexLeader !== "none") row.createSpan({ cls: `fv-idx-lead is-${s.indexLeader}` });
    if (s.indexCreated && n.ctime) row.createSpan({ cls: "fv-idx-date", text: `+${formatDateAs(n.ctime, s.indexDates)}` });
    if (s.indexLastEdited) row.createSpan({ cls: "fv-idx-date", text: formatDateAs(n.mtime, s.indexDates) });
    if (s.indexPageNumbers) {
      const f = data.folios[i];
      row.createSpan({ cls: "fv-idx-page", text: f ? `${f.exact ? "" : "~"}${f.folio}` : "" });
    }
  });
}
