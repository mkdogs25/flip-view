import { NoteRef, isNote } from "../types";
import { clamp } from "../util/rng";

/**
 * Page counts per note, so the index and page numbers can show a notebook-wide folio.
 * Counts are exact once a note has been laid out; until then they are estimated from file size.
 * Every note starts on a left page, so counts are rounded up to whole spreads.
 */
export class PageTally {
  version = 0;
  private counts = new Map<string, number>();
  private sampleChars = 0;
  private samplePages = 0;

  reset(): void {
    this.counts.clear();
    this.sampleChars = 0;
    this.samplePages = 0;
    this.version++;
  }

  has(path: string): boolean {
    return this.counts.has(path);
  }

  set(note: NoteRef, pages: number): void {
    const padded = Math.max(2, Math.ceil(pages / 2) * 2);
    if (this.counts.get(note.path) !== padded) {
      this.counts.set(note.path, padded);
      this.version++;
    }
    if (isNote(note) && note.size) {
      this.sampleChars += note.size;
      this.samplePages += pages;
    }
  }

  estimate(note: NoteRef): number {
    const perPage = this.samplePages > 0 ? clamp(this.sampleChars / this.samplePages, 300, 6000) : 1400;
    return Math.max(2, Math.ceil(Math.ceil((note.size ?? 700) / perPage) / 2) * 2);
  }

  /** First folio (page number) of items[idx], and whether every note before it is exactly known. */
  start(items: NoteRef[], idx: number): { folio: number; exact: boolean } {
    let folio = 1;
    let exact = true;
    for (let i = 0; i < idx; i++) {
      const n = items[i];
      if (!isNote(n)) continue; // separators and the index are unnumbered
      const c = this.counts.get(n.path);
      if (c === undefined) {
        exact = false;
        folio += this.estimate(n);
      } else folio += c;
    }
    return { folio, exact };
  }
}
