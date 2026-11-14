import { generateCover } from "../render/cover";
import { BandStyle, FlipViewSettings, Notebook, PaperColor, SpineStyle } from "../types";
import { hashString } from "../util/rng";

export interface ResolvedLook {
  seed: number;
  style: FlipViewSettings["coverStyle"];
  color: string;
  spine: SpineStyle;
  band: BandStyle;
  bandColor: string;
  ribbonColor: string;
  paper: PaperColor;
}

/** The physical look of a notebook: its own overrides on top of the plugin-wide settings. */
export function resolveLook(s: FlipViewSettings, nb: Notebook): ResolvedLook {
  const ov = s.coverOverrides[nb.id];
  return {
    seed: s.coverSeeds[nb.id] ?? hashString(s.coverSalt ? `${nb.id}#${s.coverSalt}` : nb.id),
    style: ov?.style ?? s.coverStyle,
    color: ov?.color ?? s.coverColor,
    spine: ov?.spine ?? s.spineStyle,
    band: ov?.band ?? s.bandStyle,
    bandColor: ov?.bandColor ?? s.bandColor,
    ribbonColor: ov?.ribbonColor ?? s.ribbonColor,
    paper: ov?.paper ?? s.paperColor,
  };
}

export function coverFor(s: FlipViewSettings, nb: Notebook, low = false) {
  const custom = s.coverOverrides[nb.id]?.image;
  if (custom) return { ...custom, style: "plain" as const };
  const l = resolveLook(s, nb);
  return generateCover(l.seed, l.style, l.color, low);
}
