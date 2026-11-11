import { setIcon } from "obsidian";

export function iconButton(parent: HTMLElement, icon: string, label: string, cls = ""): HTMLButtonElement {
  const b = parent.createEl("button", { cls: `fv-iconbtn ${cls}`.trim(), attr: { "aria-label": label, type: "button" } });
  setIcon(b, icon);
  return b;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
