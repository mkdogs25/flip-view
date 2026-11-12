import { NoteRef, isNote } from "../types";
import { clamp } from "../util/rng";

/**
 * Page counts per note, so the index and page numbers can show a notebook-wide folio.
 * Counts are exact once a note has been laid out; until then they are estimated from file size.
 * Every note starts on a left page, so counts are rounded up to whole spreads, except that (when packing)
 * two one-page notes in a row share a spread. A pair is the notes at positions 0+1, 2+3 ... of a run of notes.
 */
const padded = (pages: number): number => Math.max(2, Math.ceil(pages / 2) * 2);

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

  /** The measured page count, if known. */
  pages(path: string): number | undefined {
    return this.counts.get(path);
  }

  set(note: NoteRef, pages: number): void {
    if (this.counts.get(note.path) !== pages) {
      this.counts.set(note.path, pages);
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
  start(items: NoteRef[], idx: number, pack = false): { folio: number; exact: boolean } {
    let folio = 1;
    let exact = true;
    let run = 0; // position within a run of consecutive notes
    let hostStart = 1;
    let guest = false; // items[i] shares the spread of the note before it
    for (let i = 0; i < idx; i++) {
      const n = items[i];
      if (!isNote(n)) {
        run = 0;
        guest = false;
        continue;
      }
      if (guest) {
        guest = false;
        run++;
        continue;
      }
      const c = this.counts.get(n.path);
      const next = items[i + 1];
      if (pack && c === 1 && run % 2 === 0 && next && isNote(next) && this.counts.get(next.path) === 1) {
        hostStart = folio;
        folio += 2;
        guest = true;
      } else if (c === undefined) {
        exact = false;
        folio += this.estimate(n);
      } else folio += padded(c);
      run++;
    }
    if (guest) return { folio: hostStart + 1, exact };
    return { folio, exact };
  }

  /** Whether items[idx] is the second note of a shared spread (needs the counts of both to be known). */
  isGuest(items: NoteRef[], idx: number): boolean {
    const n = items[idx];
    if (!isNote(n) || this.counts.get(n.path) !== 1) return false;
    let run = 0;
    for (let i = idx - 1; i >= 0 && isNote(items[i]); i--) run++;
    if (run % 2 !== 1) return false;
    const prev = items[idx - 1];
    return isNote(prev) && this.counts.get(prev.path) === 1;
  }
}
