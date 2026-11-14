import { Rng, clamp, makeNoise, mulberry32, smoothstep } from "../util/rng";

type RGB = [number, number, number];

export interface WoodPalette {
  dark: RGB;
  mid: RGB;
  light: RGB;
  /** Ring contrast, 0..1. */
  ring: number;
  /** Plank tone variation, 0..1. */
  variance: number;
}

export const WOODS: Record<string, WoodPalette> = {
  walnut: { dark: [38, 22, 14], mid: [92, 56, 34], light: [138, 90, 56], ring: 0.42, variance: 0.22 },
  oak: { dark: [150, 112, 70], mid: [200, 160, 108], light: [232, 200, 150], ring: 0.34, variance: 0.18 },
  cherry: { dark: [88, 36, 22], mid: [150, 70, 40], light: [196, 112, 70], ring: 0.38, variance: 0.2 },
  ebony: { dark: [10, 8, 8], mid: [34, 28, 26], light: [62, 52, 46], ring: 0.3, variance: 0.14 },
  birch: { dark: [178, 148, 104], mid: [224, 198, 152], light: [246, 228, 190], ring: 0.22, variance: 0.14 },
  teak: { dark: [78, 46, 18], mid: [140, 92, 42], light: [188, 138, 76], ring: 0.4, variance: 0.2 },
};

const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

const cache = new Map<string, string>();

function toUrl(c: HTMLCanvasElement, q = 0.88): string {
  return c.toDataURL("image/jpeg", q);
}

/**
 * Wood boards: per-board tone, stretched fractal grain, growth rings, knots, bevelled seams and fine pores.
 * Boards run horizontally unless `vertical` is set.
 */
export function woodTexture(w: number, h: number, pal: WoodPalette, seed: number, board: number, opts: { vertical?: boolean } = {}): string {
  const key = `wood|${w}|${h}|${seed}|${board}|${pal.mid.join(",")}|${opts.vertical ? "v" : "h"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const noise = makeNoise(seed);
  const rng = new Rng(seed ^ 0x77);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const boards = Math.ceil((opts.vertical ? w : h) / board) + 1;
  const tone: number[] = [];
  const shift: number[] = [];
  const knots: Array<{ x: number; y: number; r: number; b: number }> = [];
  for (let i = 0; i < boards; i++) {
    tone.push((rng.float() - 0.5) * pal.variance * 2);
    shift.push(rng.range(0, 400));
    const n = rng.chance(0.55) ? rng.int(1, 2) : 0;
    for (let k = 0; k < n; k++) {
      const along = rng.range(0, opts.vertical ? h : w);
      const across = (i + rng.range(0.25, 0.75)) * board;
      knots.push({ x: opts.vertical ? across : along, y: opts.vertical ? along : across, r: rng.range(14, 34), b: i });
    }
  }
  const grain = mulberry32(seed ^ 0xabcdef);
  let p = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const along = opts.vertical ? y : x;
      const across = opts.vertical ? x : y;
      const b = Math.floor(across / board);
      const inB = (across % board) / board;
      const sh = shift[b] ?? 0;
      const warp = noise.fbm((along + sh) / 260, across / 38 + b * 9.1, 3);
      let ringsV = Math.sin(((across % board) * 0.55 + warp * 18 + b * 3) * 1.0) * 0.5 + 0.5;
      const streak = noise.noise((along + sh) / 90, across / 1.6 + b * 31);
      const pores = noise.noise((along + sh) / 7, across / 1.1 + b * 7);
      let t = 0.5 + tone[b] + (ringsV - 0.5) * pal.ring * 0.9 + (streak - 0.5) * 0.34 + (warp - 0.5) * 0.3 - (pores > 0.8 ? 0.1 : 0);
      // knots bend the grain into rings
      for (const k of knots) {
        if (k.b !== b) continue;
        const dx = x - k.x;
        const dy = y - k.y;
        const dist = Math.hypot(dx, dy * (opts.vertical ? 1 : 1.9));
        if (dist < k.r * 2.6) {
          const f = 1 - smoothstep(k.r * 0.5, k.r * 2.6, dist);
          t += (Math.sin(dist * 0.9) * 0.5 - 0.15) * f * 0.5;
          if (dist < k.r * 0.5) t -= 0.25 * (1 - dist / (k.r * 0.5));
        }
      }
      // bevelled seam between boards
      const edge = Math.min(inB, 1 - inB) * board;
      if (edge < 1.6) t -= 0.55;
      else if (edge < 3) t += 0.07;
      t = clamp(t, 0, 1);
      const c = t < 0.5 ? mixc(pal.dark, pal.mid, t * 2) : mixc(pal.mid, pal.light, (t - 0.5) * 2);
      const g = (grain() - 0.5) * 7;
      d[p++] = clamp(c[0] + g, 0, 255);
      d[p++] = clamp(c[1] + g, 0, 255);
      d[p++] = clamp(c[2] + g, 0, 255);
      d[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = toUrl(canvas);
  if (cache.size > 12) cache.delete(cache.keys().next().value as string);
  cache.set(key, url);
  return url;
}

export interface BrickPalette {
  bricks: RGB[];
  mortar: RGB;
}

export const BRICKS: Record<"dark" | "light", BrickPalette> = {
  dark: { bricks: [[84, 62, 52], [96, 70, 58], [72, 54, 46], [104, 76, 62], [66, 50, 44]], mortar: [38, 30, 27] },
  light: { bricks: [[226, 208, 178], [234, 218, 188], [216, 196, 164], [240, 226, 198], [208, 188, 156]], mortar: [190, 172, 142] },
};

/** A running-bond brick wall tile: colour jitter per brick, bevelled faces, pitted surface, chipped mortar. */
export function brickTexture(theme: "dark" | "light", seed = 11): string {
  const key = `brick|${theme}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pal = BRICKS[theme];
  const bw = 132;
  const bh = 50;
  const m = 5;
  const cols = 4;
  const rows = 6;
  const W = bw * cols;
  const H = bh * rows;
  const noise = makeNoise(seed);
  const rng = new Rng(seed);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const tones: number[][] = [];
  for (let r = 0; r < rows; r++) {
    tones.push([]);
    for (let c = 0; c <= cols; c++) tones[r].push(rng.int(0, pal.bricks.length - 1));
  }
  const g = mulberry32(seed ^ 0x5151);
  let p = 0;
  for (let y = 0; y < H; y++) {
    const row = Math.floor(y / bh);
    const yy = y % bh;
    for (let x = 0; x < W; x++) {
      const off = row % 2 ? bw / 2 : 0;
      const xx = (x + off) % bw;
      const col = Math.floor((x + off) / bw) % (cols + 1);
      let color: RGB;
      let shade = 0;
      if (yy < m || xx < m) {
        const wob = noise.noise(x / 6, y / 6) * 0.35;
        color = mixc(pal.mortar, [0, 0, 0], wob * 0.5);
      } else {
        const base = pal.bricks[tones[row][col]];
        const pits = noise.noise(x / 2.2, y / 2.2);
        const cloud = noise.fbm(x / 40, y / 40, 3);
        color = base;
        shade = (cloud - 0.5) * 0.35 + (pits - 0.5) * 0.22;
        // bevel: lit top-left, shaded bottom-right
        const dx = Math.min(xx - m, bw - 1 - xx);
        const dy = Math.min(yy - m, bh - 1 - yy);
        if (yy - m < 3) shade += 0.12;
        if (xx - m < 3) shade += 0.08;
        if (bh - 1 - yy < 3) shade -= 0.16;
        if (bw - 1 - xx < 3) shade -= 0.12;
        void dx;
        void dy;
      }
      const gr = (g() - 0.5) * 12;
      d[p++] = clamp(color[0] * (1 + shade) + gr, 0, 255);
      d[p++] = clamp(color[1] * (1 + shade) + gr, 0, 255);
      d[p++] = clamp(color[2] * (1 + shade) + gr, 0, 255);
      d[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = toUrl(canvas, 0.9);
  cache.set(key, url);
  return url;
}

/** Soft cow-hide leather grain for a desk mat. */
export function leatherTexture(base: RGB, seed = 5): string {
  const key = `leather|${base.join(",")}|${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 360;
  const noise = makeNoise(seed);
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const g = mulberry32(seed ^ 0x99);
  let p = 0;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const a = noise.noise(x / 2.6, y / 2.6);
      const b = noise.noise((x + 1.5) / 2.6, (y + 1.5) / 2.6);
      const mott = noise.fbm(x / 50, y / 50, 3);
      const t = 0.82 + mott * 0.3 + (a - b) * 1.1;
      const n = (g() - 0.5) * 8;
      d[p++] = clamp(base[0] * t + n, 0, 255);
      d[p++] = clamp(base[1] * t + n, 0, 255);
      d[p++] = clamp(base[2] * t + n, 0, 255);
      d[p++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = toUrl(canvas, 0.9);
  cache.set(key, url);
  return url;
}
