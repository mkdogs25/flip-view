import { App, TFile } from "obsidian";
import { FlipViewSettings, NoteRef, Notebook } from "./types";
import { hashString } from "./util/rng";

const naturalCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function normaliseFolder(p: string): string {
  return p.trim().replace(/^\/+|\/+$/g, "");
}

function parseList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map(normaliseFolder)
    .filter((s) => s.length > 0);
}

function toRef(file: TFile): NoteRef {
  return { path: file.path, title: file.basename, mtime: file.stat.mtime, ctime: file.stat.ctime };
}

/** Turns a raw frontmatter value (string, list, wikilink, number…) into clean group names. */
export function propertyValues(raw: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach(push);
      return;
    }
    if (typeof v === "object") return;
    let s = String(v).trim();
    const link = /^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(s);
    if (link) s = link[1].split("/").pop() ?? link[1];
    s = s.replace(/^#/, "").trim();
    if (s) out.push(s);
  };
  push(raw);
  return out;
}

function sortNotes(notes: NoteRef[], mode: FlipViewSettings["noteSort"]): void {
  switch (mode) {
    case "name-asc":
      notes.sort((a, b) => naturalCompare(a.title, b.title));
      break;
    case "name-desc":
      notes.sort((a, b) => naturalCompare(b.title, a.title));
      break;
    case "modified-desc":
      notes.sort((a, b) => b.mtime - a.mtime);
      break;
    case "modified-asc":
      notes.sort((a, b) => a.mtime - b.mtime);
      break;
    case "created-asc":
      notes.sort((a, b) => a.ctime - b.ctime);
      break;
    case "created-desc":
      notes.sort((a, b) => b.ctime - a.ctime);
      break;
  }
}

/** Applies the user's rename, manual order and separator pages. New notes land at the end. */
export function finishNotebook(nb: Notebook, s: FlipViewSettings): void {
  const custom = s.notebookNames[nb.id]?.trim();
  nb.name = custom || nb.originalName;
  const seps = s.separators[nb.id] ?? {};
  const byKey = new Map<string, NoteRef>();
  for (const n of nb.notes) byKey.set(n.path, n);
  for (const [id, title] of Object.entries(seps)) {
    byKey.set("sep:" + id, { path: "sep:" + id, title, mtime: hashString(title), ctime: 0, kind: "separator", sepId: id });
  }
  const out: NoteRef[] = [];
  const used = new Set<string>();
  const take = (key: string) => {
    const n = byKey.get(key);
    if (n && !used.has(key)) {
      used.add(key);
      out.push(n);
    }
  };
  (s.noteOrder[nb.id] ?? []).forEach(take);
  nb.notes.forEach((n) => take(n.path));
  Object.keys(seps).forEach((id) => take("sep:" + id));
  nb.notes = out;
}

function sortNotebooks(list: Notebook[], mode: FlipViewSettings["notebookSort"]): void {
  const latest = (nb: Notebook) => nb.notes.reduce((m, n) => Math.max(m, n.mtime), 0);
  if (mode === "recent") list.sort((a, b) => latest(b) - latest(a));
  else if (mode === "count") list.sort((a, b) => b.notes.length - a.notes.length || naturalCompare(a.name, b.name));
  else list.sort((a, b) => naturalCompare(a.name, b.name));
}

export function buildNotebooks(app: App, s: FlipViewSettings): Notebook[] {
  const files = app.vault.getMarkdownFiles();
  const groups = new Map<string, Notebook>();
  const add = (id: string, name: string, file: TFile) => {
    let nb = groups.get(id);
    if (!nb) {
      nb = { id, name, originalName: name, notes: [] };
      groups.set(id, nb);
    }
    nb.notes.push(toRef(file));
  };

  if (s.groupBy === "folder") {
    const root = normaliseFolder(s.rootFolder);
    const excluded = parseList(s.excludedFolders);
    const prefix = root ? root + "/" : "";
    for (const file of files) {
      if (prefix && !file.path.startsWith(prefix)) continue;
      if (excluded.some((e) => file.path === e || file.path.startsWith(e + "/"))) continue;
      const rel = file.path.slice(prefix.length);
      const parts = rel.split("/");
      const folders = parts.slice(0, -1);
      if (folders.length === 0) {
        if (s.includeUnfiled) add("folder:" + (root || "/"), root ? root.split("/").pop() ?? root : "Vault root", file);
        continue;
      }
      if (s.folderScope === "top") {
        add("folder:" + prefix + folders[0], folders[0], file);
      } else {
        add("folder:" + prefix + folders.join("/"), folders.join(" / "), file);
      }
    }
  } else {
    const wanted = s.propertyName.trim().toLowerCase();
    for (const file of files) {
      const fm = app.metadataCache.getFileCache(file)?.frontmatter;
      let values: string[] = [];
      if (fm && wanted) {
        const key = Object.keys(fm).find((k) => k.toLowerCase() === wanted);
        if (key) values = propertyValues(fm[key]);
      }
      if (values.length === 0) {
        if (s.includeUnfiled) add("prop:", "Unfiled", file);
        continue;
      }
      for (const v of values) add("prop:" + v.toLowerCase(), v, file);
    }
  }

  const list = [...groups.values()];
  for (const nb of list) {
    sortNotes(nb.notes, s.noteSort);
    finishNotebook(nb, s);
  }
  sortNotebooks(list, s.notebookSort);
  return list;
}
