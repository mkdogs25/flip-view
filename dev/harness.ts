import { marked } from "marked";
import { injectFonts } from "../src/render/fonts";
import { finishNotebook } from "../src/grouping";
import { extractMath, restoreMath } from "../src/render/handmath";
import { FlipViewSettings, Notebook, NotebookHost, NoteRef, freshSettings } from "../src/types";
import { NotebookApp } from "../src/ui/notebookApp";

const q = new URLSearchParams(location.search);
const settings: FlipViewSettings = freshSettings();
if (q.get("mode")) settings.viewMode = q.get("mode") as FlipViewSettings["viewMode"];
if (q.get("theme")) settings.theme = q.get("theme") as FlipViewSettings["theme"];
if (q.get("paper")) settings.paperStyle = q.get("paper") as FlipViewSettings["paperStyle"];
if (q.get("cover")) settings.coverStyle = q.get("cover") as FlipViewSettings["coverStyle"];
if (q.get("font")) settings.handFont = q.get("font") as FlipViewSettings["handFont"];
if (q.get("mess")) settings.messiness = Number(q.get("mess"));
if (q.get("hcase")) settings.headingCase = q.get("hcase") as FlipViewSettings["headingCase"];
if (q.get("hfont")) settings.headingFont = q.get("hfont") as FlipViewSettings["headingFont"];
if (q.get("color")) settings.coverColor = "#" + q.get("color");
if (q.get("label")) settings.coverLabel = q.get("label") as FlipViewSettings["coverLabel"];
if (q.get("sound") === "0") settings.soundEnabled = false;
if (q.get("flip")) settings.flipMode = q.get("flip") as FlipViewSettings["flipMode"];
if (q.get("shelf")) settings.shelfMode = true;
if (q.get("pcolor")) settings.paperColor = q.get("pcolor") as FlipViewSettings["paperColor"];
if (q.get("tex")) settings.pageTexture = q.get("tex") as FlipViewSettings["pageTexture"];
if (q.get("layout")) settings.pageLayout = q.get("layout") as FlipViewSettings["pageLayout"];
if (q.get("spine")) settings.spineStyle = q.get("spine") as FlipViewSettings["spineStyle"];
if (q.get("band")) settings.bandStyle = q.get("band") as FlipViewSettings["bandStyle"];
if (q.get("margins") === "0") settings.marginNotes = false;
settings.layoutStyle = q.get("scene") ? "scene" : "classic";
if (q.get("anim")) settings.animation = q.get("anim") as FlipViewSettings["animation"];

const galaxy = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='220'><defs><radialGradient id='g'><stop offset='0' stop-color='#ffe9b8'/><stop offset='.3' stop-color='#a66fd8'/><stop offset='1' stop-color='#120a26'/></radialGradient></defs><rect width='400' height='220' fill='#120a26'/><ellipse cx='200' cy='110' rx='170' ry='60' fill='url(#g)' transform='rotate(-20 200 110)'/></svg>`,
)}`;

const LONG = Array.from({ length: 14 }, (_, i) => `Paragraph ${i + 1}. The quick brown fox jumps over the lazy dog while quantum particles tunnel through a potential barrier and nobody notices the superposition of cats in the corner of the laboratory.`).join("\n\n");

const SOURCES: Record<string, string> = {
  "Physics/Quantum Mechanics": `# Quantum Mechanics

- Wave-particle duality
- Schrödinger equation:

<div class="math math-block"><span>iħ ∂ψ/∂t = −(ħ²/2m) ∇²ψ</span></div>

## Key Ideas:

- Superposition
- Entanglement
- Quantum tunnelling

## Applications:

- Semiconductors
- Quantum computing
- Atomic clocks

Einstein showed that $E = mc^2$ and that the energy of a free particle is $\\sqrt{p^2c^2 + m^2c^4}$.

$$\\frac{\\partial \\psi}{\\partial t} = -\\frac{\\hbar^2}{2m}\\nabla^2 \\psi + V\\psi$$

\`\`\`python
def energy(m, c=3e8):
    return m * c ** 2  # joules
\`\`\`

> Probability is not certain!

> [!margin] This is the key idea of the whole chapter!

See also [Thermodynamics](Thermodynamics), the [Garden Plan](<Garden Plan>) in another notebook, [time dilation](<Relativity#Time Dilation>) and an [external page](https://example.com/lesson).

---

${LONG}

- [x] Read chapter one
- [ ] Solve the problem set
`,
  "Physics/Thermodynamics": `# Thermodynamics\n\nEntropy never decreases in an isolated system. See [[Relativity]] for something else entirely.\n\n| Law | Idea |\n|---|---|\n| First | Energy is conserved |\n| Second | Entropy increases |\n\n\`\`\`python\ndef carnot(t_hot, t_cold):\n    return 1 - t_cold / t_hot\n\`\`\`\n\nSome **bold**, *italic*, ==highlighted== and ~~struck~~ text.`,
  "Physics/Relativity": `# Relativity\n\nTime is relative.\n\n${LONG.split("\n\n").slice(0, 7).join("\n\n")}\n\n## Time Dilation\n\nMoving clocks run slow.\n\n![galaxy](${galaxy})\n\n${LONG.split("\n\n").slice(0, 4).join("\n\n")}`,
  "Physics/Optics": "Light bends when it changes medium.\n\n1. Reflection\n2. Refraction\n3. Diffraction",
  "Physics/Fluid Dynamics": "# Fluid Dynamics\n\nWater finds a way.",
  "Projects/The Energy Paradox": `# The Energy Paradox

## Introduction

As we advance in our understanding of physics, one question remains:

> "Can energy be both finite and infinite?"

![galaxy](${galaxy})

## Key Concepts

- Kardashev Scale
- Dark Energy
- The Future of Energy

## My Thoughts

Perhaps the answer lies not in more energy, but in a deeper understanding of it.`,
  "Projects/Garden Plan": "# Garden Plan\n\nTomatoes, basil and far too many courgettes.",
};

function nb(id: string, name: string, folder: string): Notebook {
  const notes: NoteRef[] = Object.keys(SOURCES)
    .filter((k) => k.startsWith(folder + "/"))
    .map((k, i) => ({ path: k + ".md", title: k.split("/")[1], mtime: new Date(2026, 10, 8 - i).getTime(), ctime: new Date(2026, 9, 1 + i).getTime(), size: SOURCES[k].length }));
  return { id, name, originalName: name, notes };
}

const filler = (name: string, n: number): Notebook => ({
  id: "folder:" + name,
  name,
  originalName: name,
  notes: Array.from({ length: n }, (_, i) => ({ path: `${name}/n${i}.md`, title: `${name} note ${i + 1}`, mtime: Date.now(), ctime: 0 })),
});

const notebooks: Notebook[] = [
  nb("folder:Physics", "Physics", "Physics"),
  filler("Mathematics", 3),
  filler("Writing", 4),
  nb("folder:Projects", "Projects", "Projects"),
  filler("Reading", 6),
  filler("School", 3),
];

function markdownFor(note: NoteRef): string {
  const key = note.path.replace(/\.md$/, "");
  return SOURCES[key] ?? `# ${note.title}\n\nPlaceholder content for **${note.title}**.\n\n- one\n- two\n- three`;
}

const host: NotebookHost = {
  settings,
  saveSettings: () => undefined,
  getNotebooks: () =>
    notebooks.map((n) => {
      const copy: Notebook = { ...n, originalName: n.originalName ?? n.name, notes: n.notes.map((x) => ({ ...x })) };
      finishNotebook(copy, settings);
      return copy;
    }),
  async renderNote(note, el, opts) {
    const md = markdownFor(note);
    const x = opts.hand ? extractMath(md) : { md, items: [] };
    el.innerHTML = marked.parse(x.md, { async: false }) as string;
    el.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") ?? "";
      if (!/^https?:/.test(href)) {
        a.classList.add("internal-link");
        a.setAttribute("data-href", decodeURIComponent(href));
      }
    });
    restoreMath(el, x.items);
    // marked doesn't know Obsidian callouts: turn "> [!margin] text" into the structure Obsidian renders
    el.querySelectorAll("blockquote").forEach((bq) => {
      const m = /^\s*\[!(\w+)\]\s*([\s\S]*)$/.exec(bq.textContent ?? "");
      if (!m) return;
      const c = document.createElement("div");
      c.className = "callout";
      c.setAttribute("data-callout", m[1].toLowerCase());
      const body = document.createElement("div");
      body.className = "callout-content";
      body.textContent = m[2].trim();
      c.appendChild(body);
      bq.replaceWith(c);
    });
    return () => undefined;
  },
  promptText: async (o) => (o.value ? o.value + " (renamed)" : "New Chapter"),
  customiseCover: async () => undefined,
  resolveLink: (href) => {
    const [name, heading] = href.split("#");
    const key = Object.keys(SOURCES).find((k) => k.split("/")[1].toLowerCase() === name.toLowerCase());
    return key ? { path: key + ".md", heading } : null;
  },
  openNote: () => undefined,
  readNoteText: async (path) => SOURCES[path.replace(/\.md$/, "")] ?? "",
  writeNoteText: async (path, text) => {
    SOURCES[path.replace(/\.md$/, "")] = text;
  },
  openLink: () => undefined,
  openExternal: () => undefined,
  createNotebook: () => undefined,
  openSettings: () => undefined,
  showHelp: () => undefined,
  isDarkTheme: () => q.get("obsidian") === "dark",
};

if (q.get("progress")) {
  const now = Date.now();
  settings.readState["Physics/Quantum Mechanics.md"] = { opened: now - 86400000, last: now - 3600000, visits: 3, maxSpread: 2, spreads: 3, finished: true };
  settings.readState["Physics/Thermodynamics.md"] = { opened: now - 7200000, last: now - 600000, visits: 1, maxSpread: 0, spreads: 2, finished: false };
  settings.bookmarks["folder:Physics"] = [{ path: "Physics/Thermodynamics.md", spread: 0, at: now }];
}
injectFonts();
const app = new NotebookApp(document.getElementById("host") as HTMLElement, host);
app.setNotebooks(host.getNotebooks());
(window as any).__app = app;
(window as any).__settings = settings;
if (q.get("seps")) {
  settings.separators["folder:Physics"] = { s1: "Part Two: Heat" };
  settings.noteOrder["folder:Physics"] = ["Physics/Quantum Mechanics.md", "sep:s1", "Physics/Thermodynamics.md"];
  app.setNotebooks(host.getNotebooks());
}
