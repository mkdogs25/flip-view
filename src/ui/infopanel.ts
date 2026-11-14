import { setIcon } from "obsidian";
import { formatDateAs, notebookProgress } from "../progress";
import { HAND_FONTS } from "../render/fonts";
import { HandFont, Notebook, NotebookHost, PaperColor, PaperStyle, isNote, realNoteCount } from "../types";
import { coverFor, resolveLook } from "./coverStyle";

const INK_SWATCHES = ["", "#5b3fb0", "#1d5fa8", "#2c7a5b", "#7a3b2e", "#26262b"];

/** Bottom-left card: the selected notebook at a glance, plus quick appearance controls. */
export class InfoPanel {
  readonly el: HTMLElement;
  private nb: Notebook | null = null;

  constructor(parent: HTMLElement, private host: NotebookHost, private cb: { changed(): void; regenerate(nb: Notebook): void; openSettings(): void }) {
    this.el = parent.createDiv({ cls: "fv-info fv-glass" });
  }

  render(nb: Notebook | null): void {
    this.nb = nb;
    const s = this.host.settings;
    this.el.empty();
    this.el.toggleClass("is-collapsed", s.infoCollapsed);
    this.el.toggleClass("is-hidden", !nb);
    if (!nb) return;

    const head = this.el.createEl("button", { cls: "fv-info-head", attr: { type: "button", "aria-expanded": String(!s.infoCollapsed) } });
    setIcon(head.createSpan({ cls: "fv-info-headicon" }), "book-open");
    head.createSpan({ cls: "fv-info-headtitle", text: "Notebook Info" });
    setIcon(head.createSpan({ cls: "fv-info-chev" }), "chevron-down");
    head.addEventListener("click", () => {
      s.infoCollapsed = !s.infoCollapsed;
      this.host.saveSettings();
      this.render(this.nb);
    });
    if (s.infoCollapsed) return;

    const notes = nb.notes.filter(isNote);
    const created = Math.min(...notes.map((n) => n.ctime).filter((t) => t > 0), Infinity);
    const edited = Math.max(0, ...notes.map((n) => n.mtime));
    const prog = notebookProgress(nb, s);

    const top = this.el.createDiv({ cls: "fv-info-top" });
    const thumb = top.createDiv({ cls: "fv-info-thumb" });
    try {
      thumb.style.backgroundImage = `url(${coverFor(s, nb, true).url})`;
    } catch {
      /* no thumbnail */
    }
    const who = top.createDiv({ cls: "fv-info-who" });
    who.createDiv({ cls: "fv-info-name", text: nb.name });
    const n = realNoteCount(nb);
    const chars = nb.notes.reduce((t, x) => t + (x.size ?? 0), 0);
    const mins = Math.round(chars / 6 / 220); // ~6 characters a word, ~220 words a minute
    const time = mins >= 1 ? ` • ~${mins >= 90 ? `${(mins / 60).toFixed(1)} h` : `${mins} min`} to read` : "";
    who.createDiv({ cls: "fv-info-sub", text: `${n} ${n === 1 ? "note" : "notes"}${s.trackProgress && prog.total ? ` • ${Math.round(prog.frac * 100)}% read` : ""}${time}` });

    const meta = this.el.createDiv({ cls: "fv-info-meta" });
    const row = (icon: string, label: string, value: string) => {
      const r = meta.createDiv({ cls: "fv-info-row" });
      setIcon(r.createSpan({ cls: "fv-info-icon" }), icon);
      const t = r.createDiv();
      t.createDiv({ cls: "fv-info-label", text: label });
      t.createDiv({ cls: "fv-info-value", text: value });
    };
    if (Number.isFinite(created)) row("calendar", "Created", formatDateAs(created, "long").replace(/^\w+,\s*/, ""));
    if (edited) row("clock", "Last Edited", formatDateAs(edited, "long").replace(/^\w+,\s*/, ""));

    this.el.createDiv({ cls: "fv-info-section", text: "Appearance" });
    const look = resolveLook(s, nb);

    this.select("Paper", [
      ["cream", "Cream"],
      ["white", "White"],
      ["ivory", "Ivory"],
      ["yellow", "Yellow"],
      ["grey", "Grey"],
      ["blue", "Blue"],
      ["sepia", "Sepia"],
    ], look.paper === "custom" ? "cream" : look.paper, (v) => {
      (s.coverOverrides[nb.id] ??= {}).paper = v as PaperColor;
      this.changed();
    });
    this.select("Ruling", [
      ["plain", "Plain"],
      ["lined", "Lined"],
      ["grid", "Grid"],
      ["dotted", "Dotted"],
    ], s.paperStyle, (v) => {
      s.paperStyle = v as PaperStyle;
      this.changed();
    });
    this.select("Handwriting", HAND_FONTS.map((f) => [f.id, f.label.split(" – ")[0]] as [string, string]), s.handFont, (v) => {
      s.handFont = v as HandFont;
      this.changed();
    });

    const ink = this.el.createDiv({ cls: "fv-info-row2" });
    ink.createSpan({ cls: "fv-info-key", text: "Ink Colour" });
    const dots = ink.createDiv({ cls: "fv-info-dots" });
    for (const c of INK_SWATCHES) {
      const d = dots.createEl("button", { cls: "fv-info-dot", attr: { type: "button", "aria-label": c ? c : "Default ink" } });
      d.style.setProperty("--c", c || "var(--fv-ink-default, #27254a)");
      d.toggleClass("is-auto", !c);
      d.toggleClass("is-on", s.inkColor === c);
      d.addEventListener("click", () => {
        s.inkColor = c;
        this.changed();
      });
    }

    this.toggle("bar-chart-3", "Show Progress", s.trackProgress, (v) => ((s.trackProgress = v), this.changed()));
    this.toggle("bookmark", "Show Bookmarks", s.ribbon, (v) => ((s.ribbon = v), this.changed()));
    this.toggle("hash", "Show Page Numbers", s.showPageNumbers, (v) => ((s.showPageNumbers = v), this.changed()));

    const regen = this.el.createEl("button", { cls: "fv-info-regen", attr: { type: "button" } });
    setIcon(regen.createSpan(), "refresh-cw");
    regen.createSpan({ text: "Regenerate Cover" });
    regen.addEventListener("click", () => this.cb.regenerate(nb));
    const more = this.el.createEl("button", { cls: "fv-info-more", attr: { type: "button" } });
    more.setText("All settings…");
    more.addEventListener("click", () => this.cb.openSettings());
  }

  private changed(): void {
    this.host.saveSettings();
    this.cb.changed();
    this.render(this.nb);
  }

  private select(label: string, options: Array<[string, string]>, value: string, onChange: (v: string) => void): void {
    const r = this.el.createDiv({ cls: "fv-info-row2" });
    r.createSpan({ cls: "fv-info-key", text: label });
    const sel = r.createEl("select", { cls: "fv-info-select" });
    for (const [v, l] of options) sel.createEl("option", { value: v, text: l });
    sel.value = value;
    sel.addEventListener("change", () => onChange(sel.value));
  }

  private toggle(icon: string, label: string, on: boolean, onChange: (v: boolean) => void): void {
    const r = this.el.createEl("button", { cls: "fv-info-toggle", attr: { type: "button", role: "switch", "aria-checked": String(on) } });
    setIcon(r.createSpan({ cls: "fv-info-icon" }), icon);
    r.createSpan({ cls: "fv-info-tlabel", text: label });
    r.createSpan({ cls: "fv-switch" }).toggleClass("is-on", on);
    r.addEventListener("click", () => onChange(!on));
  }
}
