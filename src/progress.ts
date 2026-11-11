import { FlipViewSettings, Notebook, NoteRef, isNote } from "./types";

export interface Progress {
  done: number;
  total: number;
  frac: number;
}

/** Records that `path` is showing spread `spread` of `spreads`. Returns true if anything changed. */
export function recordVisit(s: FlipViewSettings, path: string, spread: number, spreads: number, now = Date.now()): boolean {
  const e = s.readState[path];
  const finished = spread >= spreads - 1;
  if (!e) {
    s.readState[path] = { opened: now, last: now, visits: 1, maxSpread: spread, spreads, finished };
    return true;
  }
  // count a new visit if it has been a while since the last one
  if (now - e.last > 30 * 60 * 1000) e.visits++;
  e.last = now;
  e.spreads = spreads;
  e.maxSpread = Math.max(e.maxSpread, spread);
  e.finished = e.finished || finished;
  return true;
}

export type NoteStatus = "unread" | "opened" | "finished";

export function noteStatus(s: FlipViewSettings, path: string): NoteStatus {
  const e = s.readState[path];
  return !e ? "unread" : e.finished ? "finished" : "opened";
}

export function notebookProgress(nb: Notebook, s: FlipViewSettings): Progress {
  const notes = nb.notes.filter(isNote);
  let done = 0;
  let total = 0;
  for (const n of notes) {
    const e = s.readState[n.path];
    if (s.progressMode === "pages") {
      total += e ? e.spreads : 1;
      done += e ? Math.min(e.maxSpread + 1, e.spreads) : 0;
    } else {
      total += 1;
      if (e && (s.progressMode === "opened" || e.finished)) done += 1;
    }
  }
  return { done, total, frac: total ? done / total : 0 };
}

export interface RecentItem {
  note: NoteRef;
  notebook: Notebook;
  last: number;
}

/** The most recently read notes across all notebooks. */
export function recentNotes(s: FlipViewSettings, notebooks: Notebook[], count: number): RecentItem[] {
  const out: RecentItem[] = [];
  for (const nb of notebooks) {
    for (const n of nb.notes) {
      const e = isNote(n) ? s.readState[n.path] : undefined;
      if (e) out.push({ note: n, notebook: nb, last: e.last });
    }
  }
  out.sort((a, b) => b.last - a.last);
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.note.path) ? false : (seen.add(r.note.path), true))).slice(0, count);
}

export function relativeTime(ms: number, now = Date.now()): string {
  const m = Math.round((now - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} mo ago` : `${Math.round(mo / 12)} y ago`;
}

export function formatDateAs(ms: number, mode: "short" | "long" | "relative"): string {
  if (mode === "relative") return relativeTime(ms);
  return new Date(ms).toLocaleDateString(undefined, mode === "long" ? { weekday: "short", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short", year: "numeric" });
}
