import { colord, extend } from "colord";
import labPlugin from "colord/plugins/lab";
import namesPlugin from "colord/plugins/names";

extend([labPlugin, namesPlugin]);

/**
 * Everyday colour names, the way people describe clothes, shoes and bags.
 * Codes like "#111827" are matched to the nearest of these using perceptual
 * distance (CIE Lab, via colord), so a dark navy reads as "Navy" and not as a
 * number. A full colour-name dataset was tried and rejected: it answers with
 * names like "Black Stallion" and "Homoeopathic Lavender", which mean nothing
 * to a shopper. Add a name here if a real product shows a gap.
 */
export const COLOR_NAMES: ReadonlyArray<{ name: string; hex: string }> = [
  { name: "Black", hex: "#111111" },
  { name: "Charcoal", hex: "#36454F" },
  { name: "Grey", hex: "#808080" },
  { name: "Light Grey", hex: "#D3D3D3" },
  { name: "Silver", hex: "#C0C0C0" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Off White", hex: "#F5F5F0" },
  { name: "Cream", hex: "#F5EBD0" },
  { name: "Ivory", hex: "#FFFFF0" },
  { name: "Beige", hex: "#D8C3A5" },
  { name: "Nude", hex: "#E3BC9A" },
  { name: "Tan", hex: "#C19A6B" },
  { name: "Camel", hex: "#B8834E" },
  { name: "Khaki", hex: "#B5A26A" },
  { name: "Brown", hex: "#7C4A21" },
  { name: "Chocolate", hex: "#4B2E1E" },
  { name: "Maroon", hex: "#6D1B24" },
  { name: "Burgundy", hex: "#800020" },
  { name: "Wine", hex: "#7B1E3A" },
  { name: "Red", hex: "#DC2626" },
  { name: "Coral", hex: "#FF7F6E" },
  { name: "Rust", hex: "#B7410E" },
  { name: "Orange", hex: "#F97316" },
  { name: "Peach", hex: "#FFCBA4" },
  { name: "Mustard", hex: "#D4A017" },
  { name: "Yellow", hex: "#FFC809" },
  { name: "Gold", hex: "#C8A24A" },
  { name: "Lime", hex: "#A3D921" },
  { name: "Olive", hex: "#6B7A2F" },
  { name: "Green", hex: "#16A34A" },
  { name: "Forest Green", hex: "#1F5F3A" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Mint", hex: "#A8E6CF" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Turquoise", hex: "#30D5C8" },
  { name: "Sky Blue", hex: "#61B7E8" },
  { name: "Baby Blue", hex: "#B7D7F0" },
  { name: "Blue", hex: "#2563EB" },
  { name: "Royal Blue", hex: "#1E40AF" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Denim", hex: "#4F6D8F" },
  { name: "Indigo", hex: "#4B3B9E" },
  { name: "Purple", hex: "#7C3AED" },
  { name: "Violet", hex: "#8F5FE8" },
  { name: "Lavender", hex: "#C9B8E8" },
  { name: "Lilac", hex: "#D8B4E2" },
  { name: "Plum", hex: "#6A1B4D" },
  { name: "Magenta", hex: "#C2185B" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Hot Pink", hex: "#FF2E93" },
  { name: "Blush", hex: "#F4C2C2" },
  { name: "Rose", hex: "#E08CA0" },
];

/** True for values that are a colour CODE (what the picker stores) rather than a name a person typed. */
export function isColorCode(value: string) {
  return /^\s*(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value);
}

const cache = new Map<string, string>();

function nearestName(hex: string) {
  const target = colord(hex);
  let best: { name: string; distance: number } | undefined;
  for (const entry of COLOR_NAMES) {
    // delta() is CIEDE2000 scaled 0 to 1: perceptual, unlike raw RGB distance.
    const distance = target.delta(entry.hex);
    if (!best || distance < best.distance) best = { name: entry.name, distance };
  }
  return best?.name;
}

const titleCase = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

/**
 * A human colour name for anything a product might hold. A code such as
 * "#111827" becomes its nearest everyday name ("Navy"); a name someone typed
 * ("light blue") is kept and tidied ("Light Blue"). Returns undefined for
 * empty input.
 */
export function colorName(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const cached = cache.get(raw);
  if (cached) return cached;
  let result = raw;
  if (isColorCode(raw)) {
    const parsed = colord(raw);
    if (parsed.isValid()) {
      // A fully transparent colour has no name worth showing.
      result = parsed.alpha() === 0 ? raw : nearestName(parsed.toHex()) || raw;
    }
  } else {
    result = titleCase(raw);
  }
  cache.set(raw, result);
  return result;
}

/** A CSS colour to paint a swatch for this value, or undefined when it cannot be resolved. */
export function colorSwatch(value?: string | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (isColorCode(raw)) return colord(raw).isValid() ? raw : undefined;
  const named = COLOR_NAMES.find((entry) => entry.name.toLowerCase() === raw.toLowerCase());
  if (named) return named.hex;
  // Plain CSS names such as "tomato" or "rebeccapurple".
  const css = colord(raw.replace(/\s+/g, "").toLowerCase());
  if (css.isValid()) return css.toHex();
  // A typed phrase that contains one of our names ("navy blue", "dark olive"):
  // use the longest name it contains so "Royal Blue" beats "Blue".
  const lower = raw.toLowerCase();
  const contained = COLOR_NAMES.filter((entry) => lower.includes(entry.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0];
  return contained?.hex;
}

/** A variant value ready to show: colours become names, everything else is unchanged. */
export function friendlyVariantValue(key: string, value: unknown) {
  const text = String(value ?? "");
  return /colou?r/i.test(key) ? colorName(text) || text : text;
}

/** Whether two colour values mean the same colour, whether stored as a name or a code. */
export function sameColor(a?: string | null, b?: string | null) {
  const left = colorName(a);
  const right = colorName(b);
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}
