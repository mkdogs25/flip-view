import { setIcon } from "obsidian";
import { Notebook, isNote } from "../types";

/** A quick finder: type to filter every note (and notebook) and jump straight to it. */
export class SearchPop {
  readonly el: HTMLElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private books: Notebook[] = [];
  private results: Array<{ path: string; nb: Notebook; title: string }> = [];
  private sel = 0;

  constructor(parent: HTMLElement, private cb: { go(path: string, nb: Notebook): void; pickNotebook(nb: Notebook): void }) {
    this.el = parent.createDiv({ cls: "fv-searchpop fv-glass" });
    const box = this.el.createDiv({ cls: "fv-searchpop-box" });
    setIcon(box.createSpan({ cls: "fv-searchpop-icon" }), "search");
    this.input = box.createEl("input", { attr: { type: "text", placeholder: "Find a note or notebook…", "aria-label": "Find a note" } });
    this.list = this.el.createDiv({ cls: "fv-searchpop-list" });
    this.input.addEventListener("input", () => this.update());
    this.input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") this.close();
      else if (e.key === "ArrowDown") (e.preventDefault(), this.move(1));
      else if (e.key === "ArrowUp") (e.preventDefault(), this.move(-1));
      else if (e.key === "Enter") this.choose(this.sel);
    });
    document.addEventListener("pointerdown", this.outside, true);
  }

  private outside = (e: PointerEvent): void => {
    if (this.el.hasClass("is-open") && !this.el.contains(e.target as Node) && !(e.target as HTMLElement).closest(".fv-btn-search")) this.close();
  };

  get isOpen(): boolean {
    return this.el.hasClass("is-open");
  }

  setBooks(books: Notebook[]): void {
    this.books = books;
  }

  open(): void {
    this.el.addClass("is-open");
    this.input.value = "";
    this.update();
    window.setTimeout(() => this.input.focus(), 30);
  }

  close(): void {
    this.el.removeClass("is-open");
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  destroy(): void {
    document.removeEventListener("pointerdown", this.outside, true);
    this.el.remove();
  }

  private update(): void {
    const q = this.input.value.trim().toLowerCase();
    this.results = [];
    for (const nb of this.books) for (const n of nb.notes) if (isNote(n) && (!q || n.title.toLowerCase().includes(q))) this.results.push({ path: n.path, nb, title: n.title });
    const matchedBooks = q ? this.books.filter((b) => b.name.toLowerCase().includes(q)) : [];
    this.sel = 0;
    this.list.empty();
    for (const b of matchedBooks.slice(0, 3)) {
      const r = this.list.createEl("button", { cls: "fv-sr-row is-book", attr: { type: "button" } });
      setIcon(r.createSpan({ cls: "fv-sr-icon" }), "book");
      r.createSpan({ cls: "fv-sr-title", text: b.name });
      r.createSpan({ cls: "fv-sr-meta", text: "notebook" });
      r.addEventListener("click", () => (this.close(), this.cb.pickNotebook(b)));
    }
    this.results.slice(0, 40).forEach((res, i) => {
      const r = this.list.createEl("button", { cls: "fv-sr-row", attr: { type: "button" } });
      r.toggleClass("is-sel", i === 0);
      setIcon(r.createSpan({ cls: "fv-sr-icon" }), "file-text");
      r.createSpan({ cls: "fv-sr-title", text: res.title });
      r.createSpan({ cls: "fv-sr-meta", text: res.nb.name });
      r.addEventListener("click", () => this.choose(i));
    });
    if (!this.results.length && !matchedBooks.length) this.list.createDiv({ cls: "fv-sr-empty", text: "Nothing found" });
  }

  private move(d: number): void {
    const rows = this.list.querySelectorAll<HTMLElement>(".fv-sr-row:not(.is-book)");
    if (!rows.length) return;
    this.sel = (this.sel + d + rows.length) % rows.length;
    rows.forEach((r, i) => r.toggleClass("is-sel", i === this.sel));
    rows[this.sel].scrollIntoView({ block: "nearest" });
  }

  private choose(i: number): void {
    const r = this.results[i];
    if (!r) return;
    this.close();
    this.cb.go(r.path, r.nb);
  }
}
