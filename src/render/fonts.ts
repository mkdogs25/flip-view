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
    face("FV La Belle Aurore", belle),
    face("FV Playfair", playfair, "400 900"),
  ].join("\n");
  document.head.appendChild(el);
}

export function removeFonts(): void {
  document.getElementById(STYLE_ID)?.remove();
}
