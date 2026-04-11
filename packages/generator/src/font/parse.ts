import opentype from 'opentype.js';
import type { BBox, LineCap, PathCommand } from 'tegaki';

export interface ParsedFont {
  family: string;
  style: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineCap: LineCap;
  font: opentype.Font;
  /** Additional subset fonts (e.g. CJK subsets from Google Fonts) */
  extraFonts?: opentype.Font[];
}

export interface RawGlyphData {
  char: string;
  unicode: number;
  advanceWidth: number;
  boundingBox: BBox;
  commands: PathCommand[];
  pathString: string;
}

/**
 * Infer stroke line cap from font properties.
 *
 * Handwritten and script fonts get round caps (pen-like feel).
 * Geometric, serif, and sans-serif fonts get butt caps (clean edges).
 *
 * Detection order:
 * 1. PANOSE familyKind = 3 (Latin Hand Written) → round
 * 2. OS/2 sFamilyClass high byte = 10 (Script) → round
 * 3. PANOSE familyKind = 2 with populated data (Latin Text) → butt
 * 4. Font name keywords (hand, script, cursive, brush, marker, chalk, crayon) → round
 * 5. Default → round (handwriting tool bias)
 */
export function inferLineCap(font: opentype.Font): LineCap {
  const os2 = font.tables.os2 as { sFamilyClass?: number; panose?: number[] } | undefined;

  if (os2?.panose) {
    const familyKind = os2.panose[0] ?? 0;
    // PANOSE familyKind 3 = Latin Hand Written
    if (familyKind === 3) return 'round';
    // PANOSE familyKind 2 = Latin Text — check if data is actually populated (not all zeros)
    if (familyKind === 2 && os2.panose.some((v, i) => i > 0 && v !== 0)) return 'butt';
  }

  // OS/2 sFamilyClass: high byte 10 = Script
  if (os2?.sFamilyClass && os2.sFamilyClass >> 8 === 10) return 'round';

  // Font name heuristic
  const name = (font.names.fontFamily?.en ?? '').toLowerCase();
  if (/\b(hand|script|cursive|brush|marker|chalk|crayon|writing|handwrit)/i.test(name)) return 'round';

  return 'round';
}

export async function loadFont(fontPath: string): Promise<ParsedFont>;
export async function loadFont(fontPaths: string[]): Promise<ParsedFont>;
export async function loadFont(fontPathOrPaths: string | string[]): Promise<ParsedFont> {
  const paths = Array.isArray(fontPathOrPaths) ? fontPathOrPaths : [fontPathOrPaths];
  const fonts = await Promise.all(
    paths.map(async (p) => {
      const buffer = await Bun.file(p).arrayBuffer();
      return opentype.parse(buffer);
    }),
  );
  const font = fonts[0]!;

  return {
    family: font.names.fontFamily?.en ?? 'Unknown',
    style: font.names.fontSubfamily?.en ?? 'Regular',
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    lineCap: inferLineCap(font),
    font,
    extraFonts: fonts.length > 1 ? fonts.slice(1) : undefined,
  };
}

export function extractGlyph(font: opentype.Font, char: string, extraFonts?: opentype.Font[]): RawGlyphData | null {
  let glyph = font.charToGlyph(char);
  let activeFont = font;

  // If the primary font doesn't have the glyph, try extra subset fonts.
  // This handles CJK fonts where Google Fonts serves separate TTF files per Unicode range.
  if ((!glyph || glyph.index === 0) && extraFonts) {
    for (const f of extraFonts) {
      const g = f.charToGlyph(char);
      if (g && g.index !== 0) {
        glyph = g;
        activeFont = f;
        break;
      }
    }
  }

  if (!glyph || glyph.index === 0) return null;

  const path = glyph.getPath(0, 0, activeFont.unitsPerEm);
  const bb = glyph.getBoundingBox();

  const commands: PathCommand[] = path.commands.map((cmd) => {
    const base: PathCommand = { type: cmd.type as PathCommand['type'], x: 0, y: 0 };
    if ('x' in cmd) base.x = cmd.x;
    if ('y' in cmd) base.y = cmd.y;
    if ('x1' in cmd) base.x1 = cmd.x1;
    if ('y1' in cmd) base.y1 = cmd.y1;
    if ('x2' in cmd) base.x2 = cmd.x2;
    if ('y2' in cmd) base.y2 = cmd.y2;
    return base;
  });

  return {
    char,
    unicode: char.codePointAt(0)!,
    advanceWidth: glyph.advanceWidth ?? 0,
    boundingBox: { x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2 },
    commands,
    pathString: path.toPathData(2),
  };
}
