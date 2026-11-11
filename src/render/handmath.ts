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
        .replace(/\$\$([\s\S]+?)\$\$/g, (_, tex: string) => push(tex, true))
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
  | { t: "br" };

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
};
const BLACKBOARD: Record<string, string> = { R: "ℝ", N: "ℕ", Z: "ℤ", Q: "ℚ", C: "ℂ", P: "ℙ", H: "ℍ" };
const ACCENTS: Record<string, string> = { vec: "⃗", hat: "̂", bar: "̄", overline: "̄", tilde: "̃", dot: "̇", ddot: "̈" };
const SPACES = new Set([",", ";", ":", " ", "!", "quad", "qquad"]);
const WRAP: Record<string, [string, string]> = { pmatrix: ["(", ")"], bmatrix: ["[", "]"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""] };
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
      return { t: "text", v: "  " };
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
    if (name === "\\") return { t: "br" };
    if (SPACES.has(name)) return { t: "text", v: name === "quad" || name === "qquad" ? "  " : THIN };
    if (name === "frac" || name === "dfrac" || name === "tfrac") return { t: "frac", a: this.arg(), b: this.arg() };
    if (name === "sqrt") {
      if (this.s[this.i] === "[") this.i = this.s.indexOf("]", this.i) + 1; // ignore the root index
      return { t: "sqrt", a: this.arg() };
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
    if (["text", "textbf", "textit", "mathrm", "mathbf", "mathit", "operatorname", "mathcal", "mathsf", "boldsymbol"].includes(name)) {
      return { t: "group", a: this.arg() };
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
      const env = this.arg().map((n) => (n.t === "text" ? n.v : "")).join("");
      const inner = this.seq("end");
      if (this.s.startsWith("\\end", this.i)) {
        this.i += 4;
        this.arg();
      }
      const wrap = WRAP[env] ?? ["", ""];
      return { t: "group", a: [{ t: "text", v: wrap[0] }, ...inner, { t: "text", v: wrap[1] }] };
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
