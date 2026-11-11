/* Minimal stand-in for the `obsidian` module, just enough for the UI layer to run in a plain browser. */

type Info = string | { cls?: string | string[]; text?: string; attr?: Record<string, string | number | boolean | null>; type?: string; placeholder?: string };

function apply(el: HTMLElement, o?: Info): void {
  if (!o) return;
  if (typeof o === "string") {
    el.className = o;
    return;
  }
  if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
  if (o.text !== undefined) el.textContent = o.text;
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v !== null && v !== false) el.setAttribute(k, String(v));
}

const P = HTMLElement.prototype as any;
P.createEl = function (tag: string, o?: Info) {
  const el = document.createElement(tag);
  apply(el, o);
  this.appendChild(el);
  return el;
};
P.createDiv = function (o?: Info) {
  return this.createEl("div", o);
};
P.createSpan = function (o?: Info) {
  return this.createEl("span", o);
};
P.empty = function () {
  this.replaceChildren();
};
P.addClass = function (...c: string[]) {
  this.classList.add(...c);
};
P.removeClass = function (...c: string[]) {
  this.classList.remove(...c);
};
P.hasClass = function (c: string) {
  return this.classList.contains(c);
};
P.toggleClass = function (c: string, on: boolean) {
  this.classList.toggle(c, on);
};
P.setText = function (t: string) {
  this.textContent = t;
};
P.setAttr = function (k: string, v: string) {
  this.setAttribute(k, v);
};
(window as any).createDiv = (o?: Info) => {
  const d = document.createElement("div");
  apply(d, o);
  return d;
};

(window as any).createSpan = (o?: Info) => {
  const d = document.createElement("span");
  apply(d, o);
  return d;
};

const ICON_PATHS: Record<string, string> = {
  library: "M4 3v18M9 3v18M14 5l5 15",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  book: "M5 3h13v18H5zM5 17h13",
  plus: "M12 5v14M5 12h14",
  settings: "M12 8a4 4 0 100 8 4 4 0 000-8z",
  "circle-help": "M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9a2.5 2.5 0 115 0c0 2-2.5 2-2.5 4M12 17v.5",
  "panel-left": "M4 4h16v16H4zM9 4v16",
  pencil: "M4 20l1-4L17 4l3 3L8 19z",
  type: "M5 6V4h14v2M12 4v16M9 20h6",
  dices: "M4 4h10v10H4zM14 14h6v6h-6z",
  maximize: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  x: "M5 5l14 14M19 5L5 19",
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-right": "M9 5l7 7-7 7",
  "file-text": "M6 3h8l4 4v14H6zM9 12h6M9 16h6",
  palette: "M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-5-4-11-8-11z",
  "panel-right": "M4 4h16v16H4zM15 4v16",
  "grip-vertical": "M9 5v.1M9 12v.1M9 19v.1M15 5v.1M15 12v.1M15 19v.1",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  "bookmark-plus": "M6 3h12v18l-6-4-6 4zM12 7v6M9 10h6",
  "trash-2": "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
  "chevron-up": "M5 15l7-7 7 7",
  "chevron-down": "M5 9l7 7 7-7",
  "refresh-cw": "M20 11a8 8 0 10-2.3 6M20 4v7h-7",
  "external-link": "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  "library-big": "M5 3h4v18H5zM11 3h4v18h-4zM17 5l3 1-4 15-3-1z",
  "notebook-text": "M6 3h12v18H6zM9 8h6M9 12h6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
};

export const Platform = { isDesktopApp: false };

export function setIcon(el: HTMLElement, name: string): void {
  const d = ICON_PATHS[name] ?? "M4 4h16v16H4z";
  el.innerHTML = `<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}
