import { NotebookHost, NoteRef } from "../types";
import { handwrite, prepareForPages } from "../render/handwriting";

export interface LayoutConfig {
  mode: "handwritten" | "text";
  /** Inner (content) size of one page in px. */
  w: number;
  h: number;
  gap: number;
  messiness: number;
  /** Anything that should invalidate cached layouts when it changes. */
  signature: string;
}

export class NoteLayout {
  constructor(
    readonly note: NoteRef,
    private flow: HTMLElement,
    readonly pageCount: number,
    private step: number,
    private disposeFn: () => void,
  ) {}

  get spreads(): number {
    return Math.max(1, Math.ceil(this.pageCount / 2));
  }

  /** Builds a page element showing column `index` of the flowed note (blank past the end). */
  pageEl(index: number, side: "left" | "right"): HTMLElement {
    const page = createDiv({ cls: `fv-page fv-page-${side}` });
    const inner = page.createDiv({ cls: "fv-page-inner" });
    if (index < this.pageCount) {
      const clone = this.flow.cloneNode(true) as HTMLElement;
      clone.style.transform = `translateX(${-index * this.step}px)`;
      inner.appendChild(clone);
      page.createDiv({ cls: "fv-page-no", text: String(index + 1) });
    }
    return page;
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

  constructor(private host: NotebookHost, private measureEl: HTMLElement) {}

  get(note: NoteRef, cfg: LayoutConfig): Promise<NoteLayout> {
    const sig = `${cfg.mode}|${cfg.w}x${cfg.h}|${cfg.gap}|${cfg.messiness}|${cfg.signature}`;
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

    const dispose = await this.host.renderNote(note, flow);
    if (cfg.mode === "handwritten") handwrite(flow, note.path, cfg.messiness / 100);
    prepareForPages(flow);

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
    flow.remove();
    return new NoteLayout(note, flow, pages, step, dispose);
  }
}
