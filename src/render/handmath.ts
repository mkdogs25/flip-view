/**
 * Handwritten maths. In handwritten view we don't want MathJax's typeset glyphs: we pull `$…$` / `$$…$$`
 * out of the markdown before Obsidian renders it (leaving a token), then put back a small TeX→markup
 * conversion that is plain text in the handwriting font (fractions, roots, super/subscripts, Greek, …).
 */

export interface MathItem {
  tex: string;
  display: boolean;
}

const TOKEN = /FVMATH(\d+)END/g;

export function extractMath(md: string): { md: string; items: MathItem[] } {
  const items: MathItem[] = [];
  const push = (tex: string, display: boolean): string => {
    items.push({ tex: tex.trim(), display });
    return `FVMATH${items.length - 1}END`;
  };
  // never touch code
  const parts = md.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
  const out = parts
    .map((seg, i) => {
      if (i % 2 === 1) return seg;
      return seg
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => push(tex.replace(/^[ \t]*(?:>[ \t]?)+/gm, ""), true))
        .replace(/(?<![\\$\w])\$(?!\s)([^$\n]+?)(?<!\s)\$(?![\d$])/g, (_, tex: string) => push(tex, false));
    })
    .join("");
  return { md: out, items };
}

export function restoreMath(root: HTMLElement, items: MathItem[]): void {
  if (items.length === 0) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/FVMATH\d+END/.test(n.nodeValue ?? "")) nodes.push(n as Text);
  for (const node of nodes) {
    const text = node.nodeValue ?? "";
    const frag = document.createDocumentFragment();
    let last = 0;
    let onlyDisplay: HTMLElement | null = null;
    let count = 0;
    for (const m of text.matchAll(TOKEN)) {
      const item = items[Number(m[1])];
      if (!item) continue;
      count++;
      frag.append(text.slice(last, m.index));
      const el = texToElement(item.tex, item.display);
      if (item.display) onlyDisplay = el;
      frag.append(el);
      last = (m.index ?? 0) + m[0].length;
    }
    frag.append(text.slice(last));
    const parent = node.parentElement;
    if (parent && parent.tagName === "P" && parent.childNodes.length === 1 && count === 1 && onlyDisplay) parent.replaceWith(onlyDisplay);
    else node.replaceWith(frag);
  }
}

/* ------------------------------------------------------------------ parser */

type N =
  | { t: "text"; v: string }
  | { t: "frac"; a: N[]; b: N[] }
  | { t: "sqrt"; a: N[] }
  | { t: "sup" | "sub"; a: N[] }
  | { t: "group"; a: N[] }
  | { t: "br" }
  | { t: "amp" }
  | { t: "matrix"; rows: N[][][]; br: string };

const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", hbar: "ħ", ell: "ℓ", partial: "∂", nabla: "∇", infty: "∞", sum: "∑", prod: "∏",
  int: "∫", oint: "∮", pm: "±", mp: "∓", times: "×", cdot: "·", div: "÷", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", sim: "∼", simeq: "≃", equiv: "≡", propto: "∝", to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", mapsto: "↦", in: "∈", notin: "∉", subset: "⊂",
  subseteq: "⊆", supset: "⊃", cup: "∪", cap: "∩", emptyset: "∅", varnothing: "∅", forall: "∀", exists: "∃", neg: "¬", land: "∧",
  lor: "∨", cdots: "⋯", ldots: "…", dots: "…", vdots: "⋮", ddots: "⋱", langle: "⟨", rangle: "⟩", angle: "∠", degree: "°",
  circ: "∘", star: "⋆", dagger: "†", prime: "′", lbrace: "{", rbrace: "}", lvert: "|", rvert: "|", Vert: "‖", ll: "≪", gg: "≫",
  therefore: "∴", because: "∵", sin: "sin", cos: "cos", tan: "tan", log: "log", ln: "ln", exp: "exp", lim: "lim", max: "max",
  min: "min", det: "det", dim: "dim", ker: "ker", arg: "arg", sup: "sup", inf: "inf", Re: "ℜ", Im: "ℑ", aleph: "ℵ",
  perp: "⊥", parallel: "∥", otimes: "⊗", oplus: "⊕", ominus: "⊖", odot: "⊙", wedge: "∧", vee: "∨", setminus: "∖", mid: "∣", nmid: "∤",
  lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", ast: "∗", bullet: "•", nexists: "∄", varpi: "ϖ", varrho: "ϱ", varsigma: "ς",
  Upsilon: "Υ", hslash: "ħ", wp: "℘", top: "⊤", bot: "⊥", checkmark: "✓", models: "⊨", vdash: "⊢", dashv: "⊣", lnot: "¬",
  longrightarrow: "⟶", longleftarrow: "⟵", Longrightarrow: "⟹", Longleftarrow: "⟸", longleftrightarrow: "⟷", Longleftrightarrow: "⟺",
  hookrightarrow: "↪", uparrow: "↑", downarrow: "↓", updownarrow: "↕", nearrow: "↗", searrow: "↘", leadsto: "↝", cong: "≅", doteq: "≐",
  triangleq: "≜", prec: "≺", succ: "≻", preceq: "⪯", succeq: "⪰", sqsubset: "⊏", sqcup: "⊔", sqcap: "⊓", uplus: "⊎", bigcup: "⋃", bigcap: "⋂",
  bigoplus: "⨁", bigotimes: "⨂", coprod: "∐", iint: "∬", iiint: "∭", surd: "√", square: "□", triangle: "△", diamond: "⋄", imath: "ı", jmath: "ȷ",
  coloneqq: "≔", colon: ":", lbrack: "[", rbrack: "]", backslash: "\\", vert: "|", Arrowvert: "‖", lVert: "‖", rVert: "‖", dag: "†", ddag: "‡",
  S: "§", P: "¶", copyright: "©", pounds: "£", euro: "€", ohm: "Ω", micro: "µ", angstrom: "Å", celsius: "°C",
  sinh: "sinh", cosh: "cosh", tanh: "tanh", sec: "sec", csc: "csc", cot: "cot", arcsin: "arcsin", arccos: "arccos", arctan: "arctan",
  gcd: "gcd", deg: "deg", hom: "hom", Pr: "Pr", liminf: "liminf", limsup: "limsup",
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", H: "ℍ" };
const ACCENTS: Record<string, string> = { vec: "⃗", hat: "̂", bar: "̄", overline: "̄", tilde: "̃", dot: "̇", ddot: "̈" };
const SPACES = new Set([",", ";", ":", " ", "!", "quad", "qquad"]);
const WRAP: Record<string, [string, string]> = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""], matrix: ["", ""], smallmatrix: ["", ""] };
/** Commands that take one argument and just show it as ordinary text (spaces kept). */
const TEXTLIKE = new Set(["text", "textbf", "textit", "textrm", "textsf", "texttt", "mathrm", "mathbf", "mathit", "mathsf", "mathtt", "operatorname", "mbox", "hbox", "mathcal", "mathscr", "mathfrak", "boldsymbol", "bm", "emph"]);
/** Commands that take one argument and just show it. */
const PASS1 = new Set(["underline", "boxed", "displaystyle", "textstyle", "scriptstyle", "overbrace", "underbrace", "cancel", "bcancel", "xcancel", "not", "phantom", "mathop", "mathbin", "mathrel", "mathord", "mathpunct"]);
/** Commands that take one argument and drop it. */
const DROP1 = new Set(["tag", "label", "nonumber", "notag", "hphantom", "vphantom", "color", "pagecolor"]);
/** Sizing and spacing commands with no visible result. */
const NOOP = new Set(["displaystyle", "textstyle", "scriptstyle", "limits", "nolimits", "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr", "middle", "hline", "toprule", "midrule", "bottomrule", "centering", "protect", "strut"]);
const THIN = " ";

class Parser {
  private i = 0;
  constructor(private s: string) {}

  seq(stop?: string): N[] {
    const out: N[] = [];
    while (this.i < this.s.length) {
      const c = this.s[this.i];
      if (stop === "}" && c === "}") break;
      if (stop === "end" && this.s.startsWith("\\end", this.i)) break;
      const atom = this.atom();
      if (atom) out.push(atom);
      // scripts attach to whatever came before
      for (;;) {
        this.skipWs();
        const k = this.s[this.i];
        if (k !== "^" && k !== "_") break;
        this.i++;
        out.push({ t: k === "^" ? "sup" : "sub", a: this.arg() });
      }
    }
    return out;
  }

  private skipWs(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  private arg(): N[] {
    this.skipWs();
    if (this.s[this.i] === "{") {
      this.i++;
      const inner = this.seq("}");
      this.i++; // closing brace
      return inner;
    }
    if (this.s[this.i] === "\\") {
      const a = this.atom();
      return a ? [a] : [];
    }
    const ch = this.s[this.i++] ?? "";
    return [{ t: "text", v: ch }];
  }

  /** The next argument as raw text (spaces kept), for \\text and friends. */
  private rawArg(): string {
    this.skipWs();
    if (this.s[this.i] !== "{") return this.s[this.i++] ?? "";
    let depth = 0;
    let out = "";
    while (this.i < this.s.length) {
      const c = this.s[this.i++];
      if (c === "{") {
        if (depth++ === 0) continue;
      } else if (c === "}") {
        if (--depth === 0) break;
      }
      out += c;
    }
    return out;
  }

  private name(): string {
    const m = /^[A-Za-z]+/.exec(this.s.slice(this.i));
    if (m) {
      this.i += m[0].length;
      return m[0];
    }
    return this.s[this.i++] ?? "";
  }

  private atom(): N | null {
    const c = this.s[this.i];
    if (c === "{") {
      this.i++;
      const inner = this.seq("}");
      this.i++;
      return { t: "group", a: inner };
    }
    if (c === "&") {
      this.i++;
      return { t: "amp" };
    }
    if (c === "~") {
      this.i++;
      return { t: "text", v: " " };
    }
    if (c === "%") {
      const end = this.s.indexOf("\n", this.i);
      this.i = end < 0 ? this.s.length : end + 1;
      return null;
    }
    if (c === "\\") {
      this.i++;
      const name = this.name();
      return this.command(name);
    }
    if (/\s/.test(c)) {
      this.i++;
      return null;
    }
    this.i++;
    if ("=<>+".includes(c)) return { t: "text", v: THIN + c + THIN };
    if (c === "-") return { t: "text", v: THIN + "−" + THIN };
    if (c === "*") return { t: "text", v: "·" };
    return { t: "text", v: c };
  }

  private command(name: string): N | null {
    if (name === "\\") {
      if (this.s[this.i] === "[") this.i = Math.max(this.i, this.s.indexOf("]", this.i) + 1); // \\[2pt]
      return { t: "br" };
    }
    if (NOOP.has(name)) return null;
    if (DROP1.has(name)) {
      this.arg();
      return null;
    }
    if (TEXTLIKE.has(name)) return { t: "text", v: this.rawArg() };
    if (PASS1.has(name)) return { t: "group", a: this.arg() };
    if (name === "binom" || name === "dbinom" || name === "tbinom") {
      const top = this.arg();
      const bot = this.arg();
      return { t: "group", a: [{ t: "text", v: "(" }, { t: "frac", a: top, b: bot }, { t: "text", v: ")" }] };
    }
    if (name === "overset" || name === "stackrel") {
      const over = this.arg();
      return { t: "group", a: [...this.arg(), { t: "sup", a: over }] };
    }
    if (name === "underset") {
      const under = this.arg();
      return { t: "group", a: [...this.arg(), { t: "sub", a: under }] };
    }
    if (name === "xrightarrow" || name === "xleftarrow" || name === "xlongequal") {
      if (this.s[this.i] === "[") this.i = Math.max(this.i, this.s.indexOf("]", this.i) + 1);
      const over = this.arg();
      return { t: "group", a: [{ t: "text", v: name === "xleftarrow" ? "←" : name === "xlongequal" ? "=" : "→" }, { t: "sup", a: over }] };
    }
    if (name === "ce" || name === "pu") return { t: "text", v: this.rawArg() };
    if (SPACES.has(name)) return { t: "text", v: name === "quad" || name === "qquad" ? "  " : THIN };
    if (name === "frac" || name === "dfrac" || name === "tfrac") return { t: "frac", a: this.arg(), b: this.arg() };
    if (name === "sqrt") {
      let index: N[] = [];
      if (this.s[this.i] === "[") {
        const end = this.s.indexOf("]", this.i);
        if (end > 0) {
          index = new Parser(this.s.slice(this.i + 1, end)).seq();
          this.i = end + 1;
        }
      }
      const root: N = { t: "sqrt", a: this.arg() };
      return index.length ? { t: "group", a: [{ t: "sup", a: index }, root] } : root;
    }
    if (name === "left" || name === "right") {
      const d = this.s[this.i++] ?? "";
      if (d === ".") return null;
      if (d === "\\") {
        const n = this.name();
        return { t: "text", v: SYMBOLS[n] ?? n };
      }
      return { t: "text", v: d };
    }
    if (name === "mathbb") {
      const a = this.arg();
      const txt = a.map((n) => (n.t === "text" ? n.v : "")).join("");
      return { t: "text", v: BLACKBOARD[txt] ?? txt };
    }
    if (name in ACCENTS) {
      const a = this.arg();
      const txt = a.map((n) => (n.t === "text" ? n.v : "")).join("");
      return { t: "text", v: txt.length ? txt[0] + ACCENTS[name] + txt.slice(1) : "" };
    }
    if (name === "begin") {
      const env = this.rawArg();
      if (env === "array" || env === "tabular") this.rawArg(); // column spec
      const inner = this.seq("end");
      if (this.s.startsWith("\\end", this.i)) {
        this.i += 4;
        this.rawArg();
      }
      if (env in WRAP) {
        const rows: N[][][] = [[[]]];
        for (const n of inner) {
          if (n.t === "br") rows.push([[]]);
          else if (n.t === "amp") rows[rows.length - 1].push([]);
          else rows[rows.length - 1][rows[rows.length - 1].length - 1].push(n);
        }
        if (rows.length > 1 && rows[rows.length - 1].every((c) => c.length === 0)) rows.pop(); // trailing \\
        const br = { pmatrix: "paren", bmatrix: "square", Bmatrix: "brace", vmatrix: "vert", Vmatrix: "dvert", cases: "cases" }[env] ?? "none";
        return { t: "matrix", rows, br };
      }
      return { t: "group", a: inner };
    }
    if (name in SYMBOLS) {
      const v = SYMBOLS[name];
      const spaced = ["leq", "le", "geq", "ge", "neq", "ne", "approx", "sim", "equiv", "propto", "to", "rightarrow", "leftarrow", "leftrightarrow", "Rightarrow", "Leftarrow", "Leftrightarrow", "implies", "iff", "mapsto", "in", "notin", "subset", "subseteq", "supset", "pm", "times", "div", "ll", "gg"];
      const fn = ["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min", "det", "dim", "ker", "arg", "sup", "inf"];
      return { t: "text", v: spaced.includes(name) ? THIN + v + THIN : fn.includes(name) ? v + THIN : v };
    }
    if (name.length === 1 && !/[A-Za-z]/.test(name)) return { t: "text", v: name };
    return { t: "text", v: name };
  }
}

function build(nodes: N[], into: HTMLElement): void {
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        into.append(n.v);
        break;
      case "group":
        build(n.a, into);
        break;
      case "br":
        into.append(document.createElement("br"));
        break;
      case "amp":
        into.append("  ");
        break;
      case "matrix": {
        const m = document.createElement("span");
        m.className = "fv-matrix";
        m.dataset.br = n.br;
        const cols = Math.max(...n.rows.map((r) => r.length));
        m.style.setProperty("--cols", String(cols));
        for (const row of n.rows) {
          for (let c = 0; c < cols; c++) {
            const cell = document.createElement("span");
            cell.className = "fv-cell";
            if (row[c]) build(row[c], cell);
            m.append(cell);
          }
        }
        into.append(m);
        break;
      }
      case "sup":
      case "sub": {
        const el = document.createElement(n.t);
        el.className = "fv-script";
        build(n.a, el);
        into.append(el);
        break;
      }
      case "sqrt": {
        const root = document.createElement("span");
        root.className = "fv-sqrt";
        root.append("√");
        const rad = document.createElement("span");
        rad.className = "fv-radicand";
        build(n.a, rad);
        root.append(rad);
        into.append(root);
        break;
      }
      case "frac": {
        const f = document.createElement("span");
        f.className = "fv-frac";
        const top = document.createElement("span");
        top.className = "fv-num";
        const bot = document.createElement("span");
        bot.className = "fv-den";
        build(n.a, top);
        build(n.b, bot);
        f.append(top, bot);
        into.append(f);
        break;
      }
    }
  }
}

export function texToElement(tex: string, display: boolean): HTMLElement {
  const el = document.createElement(display ? "div" : "span");
  el.className = display ? "fv-hmath fv-hmath-block" : "fv-hmath";
  try {
    build(new Parser(tex).seq(), el);
  } catch {
    el.textContent = tex;
  }
  if (!el.textContent) el.textContent = tex;
  return el;
}
