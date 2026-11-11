import { setIcon } from "obsidian";
import { Highlight, Notebook, isSeparator, realNoteCount } from "../types";
import { iconButton } from "./dom";
import { Heading } from "./layout";

export interface OutlineHandlers {
  open(index: number): void;
  page(index: number, page: number): void;
  /** `to` is the index the item should have once moved. */
  reorder(from: number, to: number): void;
  addSeparator(): void;
  renameSeparator(index: number): void;
  deleteSeparator(index: number): void;
  removeHighlight(id: string): void;
  toggle(): void;
}

export interface OutlineState {
  current: number;
  headings: Heading[];
  highlights: Array<{ h: Highlight; color: string; page: number | undefined }>;
}

/** Right-hand panel: the notebook's contents. Rows can be dragged to reorder; separators can be added. */
export class OutlinePanel {
  readonly el: HTMLElement;
  private title: HTMLElement;
  private sub: HTMLElement;
  private list: HTMLElement;
  private dragFrom = -1;

  constructor(parent: HTMLElement, private h: OutlineHandlers) {
    this.el = parent.createDiv({ cls: "fv-outline fv-glass" });
    const head = this.el.createDiv({ cls: "fv-ol-head" });
    const titles = head.createDiv({ cls: "fv-ol-titles" });
    this.title = titles.createDiv({ cls: "fv-ol-title", text: "Outline" });
    this.sub = titles.createDiv({ cls: "fv-ol-sub" });
    iconButton(head, "bookmark-plus", "Add a separator page", "fv-ol-add").addEventListener("click", () => this.h.addSeparator());
    iconButton(head, "x", "Hide outline").addEventListener("click", () => this.h.toggle());
    this.list = this.el.createDiv({ cls: "fv-ol-list" });
    this.el.createDiv({ cls: "fv-ol-foot", text: "Drag to reorder. Separators are page dividers you can place between notes." });
  }

  render(nb: Notebook | null, st: OutlineState): void {
    const scroll = this.list.scrollTop;
    this.list.empty();
    this.title.setText(nb ? nb.name : "Outline");
    if (!nb) {
      this.sub.setText("");
      return;
    }
    const notes = realNoteCount(nb);
    this.sub.setText(`${notes} ${notes === 1 ? "note" : "notes"}${nb.notes.length > notes ? ` · ${nb.notes.length - notes} separator${nb.notes.length - notes === 1 ? "" : "s"}` : ""}`);

    nb.notes.forEach((n, i) => {
      const sep = isSeparator(n);
      const row = this.list.createDiv({ cls: "fv-ol-row", attr: { draggable: "true" } });
      row.toggleClass("is-sep", sep);
      row.toggleClass("is-current", i === st.current);
      setIcon(row.createSpan({ cls: "fv-ol-grip" }), "grip-vertical");
      setIcon(row.createSpan({ cls: "fv-ol-icon" }), sep ? "bookmark" : "file-text");
      const label = row.createEl("button", { cls: "fv-ol-label", text: n.title, attr: { type: "button", title: n.title } });
      label.addEventListener("click", () => this.h.open(i));
      const actions = row.createDiv({ cls: "fv-ol-actions" });
      if (sep) {
        iconButton(actions, "pencil", "Rename separator").addEventListener("click", () => this.h.renameSeparator(i));
        iconButton(actions, "trash-2", "Delete separator").addEventListener("click", () => this.h.deleteSeparator(i));
      }
      const up = iconButton(actions, "chevron-up", "Move up");
      up.disabled = i === 0;
      up.addEventListener("click", () => this.h.reorder(i, i - 1));
      const down = iconButton(actions, "chevron-down", "Move down");
      down.disabled = i === nb.notes.length - 1;
      down.addEventListener("click", () => this.h.reorder(i, i + 1));

      row.addEventListener("dragstart", (e) => {
        this.dragFrom = i;
        e.dataTransfer?.setData("text/plain", String(i));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        row.addClass("is-dragging");
      });
      row.addEventListener("dragend", () => {
        this.dragFrom = -1;
        this.clearDrop();
        row.removeClass("is-dragging");
      });
      row.addEventListener("dragover", (e) => {
        if (this.dragFrom < 0) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        this.clearDrop();
        row.addClass(after ? "drop-after" : "drop-before");
      });
      row.addEventListener("drop", (e) => {
        if (this.dragFrom < 0) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const insertAt = e.clientY > r.top + r.height / 2 ? i + 1 : i;
        const from = this.dragFrom;
        this.dragFrom = -1;
        this.clearDrop();
        const to = insertAt > from ? insertAt - 1 : insertAt;
        if (to !== from) this.h.reorder(from, to);
      });

      if (i === st.current && !sep) this.renderDetails(st, i);
    });

    if (nb.notes.length === 0) this.list.createDiv({ cls: "fv-ol-empty", text: "Nothing here yet." });
    this.list.scrollTop = scroll;
  }

  private renderDetails(st: OutlineState, index: number): void {
    if (st.headings.length) {
      const box = this.list.createDiv({ cls: "fv-ol-details" });
      const minLevel = Math.min(...st.headings.map((x) => x.level));
      for (const hd of st.headings) {
        const b = box.createEl("button", { cls: "fv-ol-heading", text: hd.text, attr: { type: "button", title: hd.text } });
        b.style.paddingLeft = `${(hd.level - minLevel) * 12 + 4}px`;
        b.addEventListener("click", () => this.h.page(index, hd.page));
      }
    }
    if (st.highlights.length) {
      const box = this.list.createDiv({ cls: "fv-ol-details" });
      box.createDiv({ cls: "fv-ol-subhead", text: "Highlights" });
      for (const x of st.highlights) {
        const row = box.createDiv({ cls: "fv-ol-hl" });
        row.createSpan({ cls: "fv-legend-swatch" }).style.setProperty("--pen", x.color);
        const b = row.createEl("button", { cls: "fv-ol-heading", text: x.h.quote, attr: { type: "button", title: x.h.quote } });
        b.addEventListener("click", () => x.page !== undefined && this.h.page(index, x.page));
        iconButton(row, "x", "Remove highlight").addEventListener("click", () => this.h.removeHighlight(x.h.id));
      }
    }
  }

  private clearDrop(): void {
    this.list.querySelectorAll(".drop-before, .drop-after").forEach((e) => e.classList.remove("drop-before", "drop-after"));
  }
}
