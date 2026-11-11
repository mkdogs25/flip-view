import { HandFont } from "../types";
import caveat from "../../assets/fonts/caveat.woff2";
import kalam from "../../assets/fonts/kalam.woff2";
import patrickHand from "../../assets/fonts/patrick-hand.woff2";
import reenieBeanie from "../../assets/fonts/reenie-beanie.woff2";
import indieFlower from "../../assets/fonts/indie-flower.woff2";
import shadows from "../../assets/fonts/shadows-into-light.woff2";
import playfair from "../../assets/fonts/playfair.woff2";
import dancing from "../../assets/fonts/dancing-script.woff2";
import alexBrush from "../../assets/fonts/alex-brush.woff2";
import greatVibes from "../../assets/fonts/great-vibes.woff2";
import allura from "../../assets/fonts/allura.woff2";
import architects from "../../assets/fonts/architects-daughter.woff2";
import gochi from "../../assets/fonts/gochi-hand.woff2";
import covered from "../../assets/fonts/covered-by-your-grace.woff2";
import handlee from "../../assets/fonts/handlee.woff2";
import schoolbell from "../../assets/fonts/schoolbell.woff2";
import justAnother from "../../assets/fonts/just-another-hand.woff2";
import zeyada from "../../assets/fonts/zeyada.woff2";
import nothing from "../../assets/fonts/nothing-you-could-do.woff2";
import marker from "../../assets/fonts/permanent-marker.woff2";
import belle from "../../assets/fonts/la-belle-aurore.woff2";

export interface HandFontInfo {
  id: HandFont;
  label: string;
  family: string;
  /** Multiplier so every font reads at a similar size. */
  size: number;
  /** Multiplier of the ruled line height. */
  line: number;
  /** Joined-up script. */
  cursive?: boolean;
  /** Extra pen weight in px (text-stroke), for hairline scripts. */
  stroke?: number;
}

export const HAND_FONTS: HandFontInfo[] = [
  { id: "caveat", label: "Caveat – flowing", family: "FV Caveat", size: 1.12, line: 1 },
  { id: "kalam", label: "Kalam – relaxed", family: "FV Kalam", size: 0.92, line: 1 },
  { id: "patrick-hand", label: "Patrick Hand – tidy print", family: "FV Patrick Hand", size: 1, line: 1 },
  { id: "reenie-beanie", label: "Reenie Beanie – scrawl", family: "FV Reenie Beanie", size: 1.34, line: 1 },
  { id: "indie-flower", label: "Indie Flower – round", family: "FV Indie Flower", size: 0.95, line: 1 },
  { id: "shadows-into-light", label: "Shadows Into Light – slim", family: "FV Shadows Into Light", size: 1.02, line: 1 },
  { id: "dancing-script", label: "Dancing Script – cursive", family: "FV Dancing Script", size: 1.02, line: 1, cursive: true },
  { id: "alex-brush", label: "Alex Brush – loopy brush cursive", family: "FV Alex Brush", size: 1.32, line: 1, cursive: true, stroke: 0.4 },
  { id: "la-belle-aurore", label: "La Belle Aurore – slanted cursive", family: "FV La Belle Aurore", size: 1.15, line: 1, cursive: true },
  { id: "great-vibes", label: "Great Vibes – formal cursive", family: "FV Great Vibes", size: 1.3, line: 1, cursive: true, stroke: 0.3 },
  { id: "allura", label: "Allura – elegant cursive", family: "FV Allura", size: 1.32, line: 1, cursive: true, stroke: 0.35 },
  { id: "architects-daughter", label: "Architect's Daughter – drafting print", family: "FV Architects Daughter", size: 0.84, line: 1 },
  { id: "gochi-hand", label: "Gochi Hand – bubbly", family: "FV Gochi Hand", size: 0.96, line: 1 },
  { id: "covered-by-your-grace", label: "Covered By Your Grace – quick scrawl", family: "FV Covered By Your Grace", size: 1.05, line: 1 },
  { id: "handlee", label: "Handlee – friendly", family: "FV Handlee", size: 0.96, line: 1 },
  { id: "schoolbell", label: "Schoolbell – schoolroom", family: "FV Schoolbell", size: 1.0, line: 1 },
  { id: "just-another-hand", label: "Just Another Hand – tall and narrow", family: "FV Just Another Hand", size: 1.25, line: 1 },
  { id: "zeyada", label: "Zeyada – loose and light", family: "FV Zeyada", size: 1.2, line: 1 },
  { id: "nothing-you-could-do", label: "Nothing You Could Do – wide casual", family: "FV Nothing You Could Do", size: 0.95, line: 1 },
  { id: "permanent-marker", label: "Permanent Marker – bold felt tip", family: "FV Permanent Marker", size: 0.8, line: 1 },
];

export function handFontInfo(id: HandFont): HandFontInfo {
  return HAND_FONTS.find((f) => f.id === id) ?? HAND_FONTS[0];
}

const STYLE_ID = "flip-view-fonts";

export function injectFonts(): void {
  if (document.getElementById(STYLE_ID)) return;
  const face = (family: string, url: string, weight = "400") =>
    `@font-face{font-family:"${family}";src:url(${url}) format("woff2");font-weight:${weight};font-style:normal;font-display:swap;}`;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = [
    face("FV Caveat", caveat, "400 700"),
    face("FV Kalam", kalam),
    face("FV Patrick Hand", patrickHand),
    face("FV Reenie Beanie", reenieBeanie),
    face("FV Indie Flower", indieFlower),
    face("FV Shadows Into Light", shadows),
    face("FV Dancing Script", dancing, "400 700"),
    face("FV Alex Brush", alexBrush),
    face("FV Great Vibes", greatVibes),
    face("FV Allura", allura),
    face("FV Architects Daughter", architects),
    face("FV Gochi Hand", gochi),
    face("FV Covered By Your Grace", covered),
    face("FV Handlee", handlee),
    face("FV Schoolbell", schoolbell),
    face("FV Just Another Hand", justAnother),
    face("FV Zeyada", zeyada),
    face("FV Nothing You Could Do", nothing),
    face("FV Permanent Marker", marker),
    face("FV La Belle Aurore", belle),
    face("FV Playfair", playfair, "400 900"),
  ].join("\n");
  document.head.appendChild(el);
}

export function removeFonts(): void {
  document.getElementById(STYLE_ID)?.remove();
}
