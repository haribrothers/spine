import path from "node:path";
import { Font } from "@react-pdf/renderer";

/**
 * US-SET-20 (D-151) — the fonts every PDF prints in: Noto Sans (Latin,
 * Greek, Cyrillic, currency symbols such as ₹) falling back to Noto Sans
 * Devanagari for Hindi and other Devanagari names. Both ship in
 * `apps/api/assets/fonts` under the SIL Open Font Licence (OFL.txt there).
 * Other Indian scripts aren't covered yet (v1.1); they print as missing
 * glyphs.
 */
export const PDF_FONT_FAMILY = ["Noto Sans", "Noto Sans Devanagari"] as unknown as string;

/** The scripts the PDF fonts cover, documented by the US-SET-20 test. */
export const PDF_COVERED_SCRIPTS = ["Latin", "Greek", "Cyrillic", "Devanagari"] as const;

// `src/modules/pdf` in development and tests, `dist/modules/pdf` when built: both sit three levels below `apps/api`.
const FONTS_DIR = path.resolve(__dirname, "../../../assets/fonts");

let registered = false;

/** Registers the fonts once per process; react-pdf keeps them globally. */
export function registerPdfFonts(): void {
  if (registered) return;
  const file = (name: string) => path.join(FONTS_DIR, name);
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: file("NotoSans-Regular.ttf") },
      { src: file("NotoSans-Bold.ttf"), fontWeight: 700 },
      { src: file("NotoSans-Italic.ttf"), fontStyle: "italic" },
      { src: file("NotoSans-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  // Devanagari has no italic; the upright faces stand in so italic notes still print.
  Font.register({
    family: "Noto Sans Devanagari",
    fonts: [
      { src: file("NotoSansDevanagari-Regular.ttf") },
      { src: file("NotoSansDevanagari-Bold.ttf"), fontWeight: 700 },
      { src: file("NotoSansDevanagari-Regular.ttf"), fontStyle: "italic" },
      { src: file("NotoSansDevanagari-Bold.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  });
  // Names and numbers break between words, never mid-word with a hyphen.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}

// Importing the family registers the fonts, so no template can render before them.
registerPdfFonts();
