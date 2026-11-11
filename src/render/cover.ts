import { CoverStyle } from "../types";
import { Rng, clamp, makeNoise, mulberry32, smoothstep } from "../util/rng";

type RGB = [number, number, number];
type ConcreteStyle = Exclude<CoverStyle, "random">;

export const COVER_STYLES: ConcreteStyle[] = ["cosmic", "leather", "linen", "marble", "geometric"];

export interface CoverResult {
  url: string;
  style: ConcreteStyle;
  /** Mid-tone of the cover, used to tint the elastic band and end-papers. */
  base: string;
  dark: string;
  light: string;
}

const W = 720;
const H = 960;

function hsl(h: number, s: number, l: number): RGB {
  h = ((h % 360) + 360) % 360;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
const rgba = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

type Ctx = CanvasRenderingContext2D;

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sparkle(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

/** Per-pixel painter: fills the canvas by evaluating `shade` for every pixel and adds film grain. */
function paintPixels(ctx: Ctx, seed: number, grain: number, shade: (x: number, y: number, out: RGB) => void): void {
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const g = mulberry32(seed ^ 0xa5a5a5a5);
  const out: RGB = [0, 0, 0];
  let i = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      shade(x, y, out);
      const n = (g() - 0.5) * grain;
      d[i++] = clamp(out[0] + n, 0, 255);
      d[i++] = clamp(out[1] + n, 0, 255);
      d[i++] = clamp(out[2] + n, 0, 255);
      d[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

function addGrain(ctx: Ctx, seed: number, amount: number): void {
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const g = mulberry32(seed ^ 0x5bd1e995);
  for (let i = 0; i < d.length; i += 4) {
    const n = (g() - 0.5) * amount;
    d[i] = clamp(d[i] + n, 0, 255);
    d[i + 1] = clamp(d[i + 1] + n, 0, 255);
    d[i + 2] = clamp(d[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
}

interface Theme {
  base: RGB;
  dark: RGB;
  light: RGB;
}

/* ------------------------------------------------------------------ cosmic */

function paintCosmic(ctx: Ctx, rng: Rng, seed: number): Theme {
  const noise = makeNoise(seed);
  const hue = rng.pick([262, 275, 250, 285, 232, 300, 210]) + rng.range(-8, 8);
  const c0 = hsl(hue, 0.55, 0.045);
  const c1 = hsl(hue, 0.5, 0.17);
  const c2 = hsl(hue + rng.range(25, 70), 0.6, 0.4);
  paintPixels(ctx, seed, 20, (x, y, o) => {
    const n = noise.fbm(x / 200, y / 200, 5);
    const m = noise.fbm(x / 120 + 30, y / 120 + 11, 4);
    const t = smoothstep(0.36, 0.78, n);
    const t2 = smoothstep(0.5, 0.86, m) * 0.5 * t;
    o[0] = c0[0] + (c1[0] - c0[0]) * t + c2[0] * t2;
    o[1] = c0[1] + (c1[1] - c0[1]) * t + c2[1] * t2;
    o[2] = c0[2] + (c1[2] - c0[2]) * t + c2[2] * t2;
  });

  const gold: RGB = [226, 184, 112];
  ctx.save();

  // star field
  const stars: Array<[number, number]> = [];
  for (let i = 0; i < 280; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    const r = Math.pow(rng.float(), 3) * 1.8 + 0.4;
    ctx.fillStyle = rgba(rng.chance(0.3) ? gold : [235, 230, 255], rng.range(0.25, 0.95));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 1.6) stars.push([x, y]);
  }
  for (let i = 0; i < 9; i++) {
    const x = rng.range(30, W - 30);
    const y = rng.range(30, H - 30);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, 20);
    gr.addColorStop(0, "rgba(255,240,210,.55)");
    gr.addColorStop(1, "rgba(255,240,210,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(x - 20, y - 20, 40, 40);
    ctx.fillStyle = rgba(gold, 0.9);
    sparkle(ctx, x, y, rng.range(7, 15));
    stars.push([x, y]);
  }

  // constellation
  if (stars.length > 5) {
    const pts = [...stars].sort(() => rng.float() - 0.5).slice(0, rng.int(4, 6)).sort((a, b) => a[0] - b[0]);
    ctx.strokeStyle = rgba(gold, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  }

  // orbits
  const orbits = rng.int(1, 3);
  const ocx = rng.range(W * 0.3, W * 0.7);
  const ocy = rng.range(H * 0.2, H * 0.34);
  for (let i = 0; i < orbits; i++) {
    const rx = rng.range(170, 360);
    const rot = rng.range(-0.7, 0.7);
    ctx.strokeStyle = rgba(gold, rng.range(0.3, 0.6));
    ctx.lineWidth = rng.range(1, 1.8);
    ctx.setLineDash(rng.chance(0.35) ? [2, 7] : []);
    ctx.beginPath();
    ctx.ellipse(ocx, ocy, rx, rx * rng.range(0.22, 0.5), rot, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = rng.range(0, Math.PI * 2);
    const ry = rx * 0.35;
    const px = ocx + Math.cos(a) * rx * Math.cos(rot) - Math.sin(a) * ry * Math.sin(rot);
    const py = ocy + Math.cos(a) * rx * Math.sin(rot) + Math.sin(a) * ry * Math.cos(rot);
    ctx.fillStyle = rgba(gold, 0.95);
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // hero object
  const hero = rng.pick(["ringed", "planet", "moon"] as const);
  if (hero === "ringed") {
    const r = rng.range(52, 78);
    const rot = rng.range(-0.5, 0.5);
    ctx.save();
    ctx.translate(ocx, ocy);
    ctx.rotate(rot);
    const ring = (front: boolean) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 2.1, r * 0.55, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.strokeStyle = rgba(gold, 0.85);
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.7, r * 0.42, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      ctx.strokeStyle = rgba(gold, 0.45);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };
    ring(false);
    const gr = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gr.addColorStop(0, rgba(mix(c1, gold, 0.25), 1));
    gr.addColorStop(1, rgba(c0, 1));
    ctx.fillStyle = gr;
    ctx.strokeStyle = rgba(gold, 0.9);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, (i - 1) * r * 0.38, r * 0.92, r * 0.1, 0, 0.1, Math.PI - 0.1);
      ctx.strokeStyle = rgba(gold, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ring(true);
    ctx.restore();
  } else if (hero === "planet") {
    const r = W * rng.range(0.72, 0.95);
    const cx = rng.range(W * 0.3, W * 0.7);
    const cy = H + r * rng.range(0.55, 0.7);
    const gr = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.95, r * 0.02, cx, cy, r);
    gr.addColorStop(0, rgba(mix(c2, [255, 255, 255], 0.3), 1));
    gr.addColorStop(0.08, rgba(c2, 1));
    gr.addColorStop(0.4, rgba(mix(c1, c0, 0.4), 1));
    gr.addColorStop(1, rgba(c0, 1));
    ctx.shadowColor = rgba(c2, 0.8);
    ctx.shadowBlur = 40;
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    for (let i = 0; i < 18; i++) {
      const a = rng.range(-2.4, -0.7);
      const d = r * rng.range(0.2, 0.9);
      const px = cx + Math.cos(a) * d;
      const py = cy + Math.sin(a) * d;
      const cr = rng.range(6, 38);
      ctx.fillStyle = rgba(c0, 0.28);
      ctx.beginPath();
      ctx.arc(px, py, cr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(c2, 0.16);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px - 1, py - 1, cr, 0.9 * Math.PI, 1.8 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    const r = rng.range(46, 70);
    const mx = rng.range(W * 0.25, W * 0.75);
    const my = rng.range(H * 0.14, H * 0.28);
    ctx.shadowColor = rgba(gold, 0.7);
    ctx.shadowBlur = 28;
    ctx.fillStyle = rgba(gold, 0.95);
    ctx.beginPath();
    ctx.arc(mx, my, r, Math.PI * 0.5, Math.PI * 1.5, false);
    ctx.arc(mx - r * 0.38, my, r * 0.86, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  return { base: mix(c1, c2, 0.15), dark: c0, light: mix(c2, [255, 255, 255], 0.2) };
}

/* ----------------------------------------------------------------- leather */

function paintLeather(ctx: Ctx, rng: Rng, seed: number): Theme {
  const noise = makeNoise(seed);
  const p = rng.pick([
    { h: 24, s: 0.5, l: 0.24 },
    { h: 352, s: 0.5, l: 0.2 },
    { h: 150, s: 0.34, l: 0.18 },
    { h: 218, s: 0.4, l: 0.2 },
    { h: 28, s: 0.22, l: 0.1 },
    { h: 33, s: 0.58, l: 0.34 },
    { h: 285, s: 0.28, l: 0.2 },
  ]);
  const base = hsl(p.h, p.s, p.l);
  paintPixels(ctx, seed, 12, (x, y, o) => {
    const g1 = noise.noise(x / 2.4, y / 2.4);
    const g2 = noise.noise((x + 1.6) / 2.4, (y + 1.6) / 2.4);
    const mott = noise.fbm(x / 22, y / 22, 3);
    const t = 0.72 + mott * 0.5 + (g1 - g2) * 1.3 + (g1 - 0.5) * 0.1;
    o[0] = base[0] * t;
    o[1] = base[1] * t;
    o[2] = base[2] * t;
  });
  const thread = mix(base, [244, 230, 200], 0.72);
  const frame = (inset: number, dash: number[], width: number, col: string, off = 0) => {
    ctx.save();
    ctx.setLineDash(dash);
    ctx.lineWidth = width;
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    roundedRect(ctx, inset + off, inset + off, W - inset * 2, H - inset * 2, 22);
    ctx.stroke();
    ctx.restore();
  };
  frame(36, [10, 8], 3.2, "rgba(0,0,0,.4)", 1.6);
  frame(36, [10, 8], 3.2, rgba(thread, 0.9));
  frame(24, [], 2, "rgba(0,0,0,.35)", 1);
  frame(24, [], 1.4, "rgba(255,255,255,.14)");
  return { base, dark: mix(base, [0, 0, 0], 0.5), light: thread };
}

/* ------------------------------------------------------------------- linen */

function paintLinen(ctx: Ctx, rng: Rng, seed: number): Theme {
  const noise = makeNoise(seed);
  const p = rng.pick([
    { h: 160, s: 0.2, l: 0.38 },
    { h: 215, s: 0.35, l: 0.3 },
    { h: 40, s: 0.55, l: 0.5 },
    { h: 14, s: 0.5, l: 0.42 },
    { h: 270, s: 0.22, l: 0.36 },
    { h: 195, s: 0.3, l: 0.34 },
    { h: 340, s: 0.3, l: 0.4 },
  ]);
  const base = hsl(p.h, p.s, p.l);
  const twist = rng.range(1.6, 2.2);
  paintPixels(ctx, seed, 10, (x, y, o) => {
    const wx = Math.sin(x * twist) * 0.5 + 0.5;
    const wy = Math.sin(y * twist) * 0.5 + 0.5;
    const over = ((x >> 1) + (y >> 1)) & 1;
    const weave = over ? wx : wy;
    const slubH = noise.fbm(x / 3, y / 90, 2);
    const slubV = noise.fbm(x / 90, y / 3, 2);
    const cloud = noise.fbm(x / 160, y / 160, 3);
    const t = 0.8 + weave * 0.2 + (over ? slubH : slubV) * 0.28 + (cloud - 0.5) * 0.18;
    o[0] = base[0] * t;
    o[1] = base[1] * t;
    o[2] = base[2] * t;
  });
  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 30, 30, W - 60, H - 60, 6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,.18)";
  roundedRect(ctx, 34, 34, W - 68, H - 68, 4);
  ctx.stroke();
  return { base, dark: mix(base, [0, 0, 0], 0.5), light: mix(base, [255, 255, 255], 0.55) };
}

/* ------------------------------------------------------------------ marble */

function paintMarble(ctx: Ctx, rng: Rng, seed: number): Theme {
  const noise = makeNoise(seed);
  const hue = rng.range(0, 360);
  const dark = rng.chance(0.6);
  const bg = dark ? hsl(hue, 0.35, 0.1) : hsl(hue, 0.12, 0.9);
  const fg = dark ? hsl(hue, 0.4, 0.28) : hsl(hue, 0.18, 0.7);
  const vein = dark ? ([232, 196, 130] as RGB) : hsl(hue, 0.3, 0.3);
  const scale = rng.range(190, 280);
  const ox = rng.range(0, 40);
  paintPixels(ctx, seed, 8, (x, y, o) => {
    const q = noise.fbm(x / scale + ox, y / scale, 4);
    const r = noise.fbm(x / scale + 3.4 * q, y / scale + 3.4 * q + 7, 4);
    const body = smoothstep(0.25, 0.75, noise.fbm(x / 90 + 8, y / 90, 3));
    const v1 = 1 - smoothstep(0, 0.035, Math.abs(r - 0.5));
    const v2 = (1 - smoothstep(0, 0.02, Math.abs(r - 0.37))) * 0.6;
    const t = clamp(v1 + v2, 0, 1);
    for (let k = 0; k < 3; k++) {
      const field = bg[k] + (fg[k] - bg[k]) * body * 0.7;
      o[k] = field + (vein[k] - field) * t * 0.85;
    }
  });
  return { base: dark ? fg : mix(fg, [0, 0, 0], 0.35), dark: bg, light: vein };
}

/* --------------------------------------------------------------- geometric */

function paintGeometric(ctx: Ctx, rng: Rng, seed: number): Theme {
  const hue = rng.range(0, 360);
  const bg = hsl(hue, rng.range(0.25, 0.5), rng.range(0.12, 0.2));
  const pal: RGB[] = [
    hsl(hue + 30, 0.6, 0.55),
    hsl(hue + 180, 0.5, 0.6),
    hsl(hue + 330, 0.55, 0.7),
    [236, 224, 196],
  ];
  ctx.fillStyle = rgba(bg);
  ctx.fillRect(0, 0, W, H);
  const cols = 3;
  const rows = 4;
  const cw = W / cols;
  const ch = H / rows;
  const kinds = ["quarter", "half", "circle", "tri", "ring", "stripes"] as const;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng.chance(0.14)) continue;
      const x = c * cw;
      const y = r * ch;
      const col = rng.pick(pal);
      const col2 = rng.pick(pal);
      const kind = rng.pick(kinds);
      const rot = rng.int(0, 3) * (Math.PI / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cw, ch);
      ctx.clip();
      ctx.translate(x + cw / 2, y + ch / 2);
      ctx.rotate(rot);
      ctx.translate(-cw / 2, -ch / 2);
      ctx.fillStyle = rgba(col);
      switch (kind) {
        case "quarter":
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, cw, 0, Math.PI / 2);
          ctx.fill();
          break;
        case "half":
          ctx.beginPath();
          ctx.arc(cw / 2, 0, cw / 2, 0, Math.PI);
          ctx.fill();
          break;
        case "circle":
          ctx.beginPath();
          ctx.arc(cw / 2, ch / 2, cw * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = rgba(col2);
          ctx.beginPath();
          ctx.arc(cw / 2, ch / 2, cw * 0.15, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "tri":
          ctx.beginPath();
          ctx.moveTo(0, ch);
          ctx.lineTo(cw, ch);
          ctx.lineTo(0, ch - cw);
          ctx.fill();
          break;
        case "ring":
          ctx.lineWidth = cw * 0.16;
          ctx.strokeStyle = rgba(col);
          ctx.beginPath();
          ctx.arc(cw / 2, ch / 2, cw * 0.3, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "stripes":
          for (let i = 0; i < 5; i++) ctx.fillRect(0, i * (ch / 5), cw, ch / 10);
          break;
      }
      ctx.restore();
    }
  }
  addGrain(ctx, seed, 26);
  return { base: mix(bg, pal[0], 0.2), dark: bg, light: pal[3] };
}

/* ------------------------------------------------------------------ finish */

function finish(ctx: Ctx, rng: Rng): void {
  // sheen
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0, "rgba(255,255,255,.12)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,.2)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.38)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // wear
  ctx.lineCap = "round";
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, W);
    const y = rng.range(0, H);
    const a = rng.range(0, Math.PI);
    const l = rng.range(8, 46);
    ctx.strokeStyle = rng.chance(0.5) ? `rgba(255,255,255,${rng.range(0.03, 0.1)})` : `rgba(0,0,0,${rng.range(0.05, 0.14)})`;
    ctx.lineWidth = rng.range(0.5, 1.1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // spine hinge
  const hinge = ctx.createLinearGradient(0, 0, 46, 0);
  hinge.addColorStop(0, "rgba(0,0,0,.6)");
  hinge.addColorStop(0.55, "rgba(0,0,0,.1)");
  hinge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hinge;
  ctx.fillRect(0, 0, 46, H);
  ctx.fillStyle = "rgba(0,0,0,.4)";
  ctx.fillRect(34, 0, 2, H);
  ctx.fillStyle = "rgba(255,255,255,.1)";
  ctx.fillRect(36, 0, 2, H);
}

const cache = new Map<string, CoverResult>();

/** Generates (and memoises) a cover image. Fully deterministic for a given seed and style. */
export function generateCover(seed: number, requested: CoverStyle): CoverResult {
  const key = `${seed}|${requested}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = new Rng(seed ^ 0x1234567);
  const style: ConcreteStyle = requested === "random" ? rng.pick(COVER_STYLES) : requested;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  let theme: Theme;
  switch (style) {
    case "cosmic":
      theme = paintCosmic(ctx, rng, seed);
      break;
    case "leather":
      theme = paintLeather(ctx, rng, seed);
      break;
    case "linen":
      theme = paintLinen(ctx, rng, seed);
      break;
    case "marble":
      theme = paintMarble(ctx, rng, seed);
      break;
    default:
      theme = paintGeometric(ctx, rng, seed);
  }
  finish(ctx, rng);
  const result: CoverResult = {
    url: canvas.toDataURL("image/jpeg", 0.88),
    style,
    base: rgba(theme.base),
    dark: rgba(theme.dark),
    light: rgba(theme.light),
  };
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
