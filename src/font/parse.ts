import opentype from 'opentype.js';
import type { BBox, PathCommand } from '../types.ts';

export interface ParsedFont {
  family: string;
  style: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  font: opentype.Font;
}

export interface RawGlyphData {
  char: string;
  unicode: number;
  advanceWidth: number;
  boundingBox: BBox;
  commands: PathCommand[];
  pathString: string;
}

export async function loadFont(fontPath: string): Promise<ParsedFont> {
  const buffer = await Bun.file(fontPath).arrayBuffer();
  const font = opentype.parse(buffer);

  return {
    family: font.names.fontFamily?.en ?? 'Unknown',
    style: font.names.fontSubfamily?.en ?? 'Regular',
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    font,
  };
}

export function extractGlyph(font: opentype.Font, char: string): RawGlyphData | null {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) return null;

  const path = glyph.getPath(0, 0, font.unitsPerEm);
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
    pathString: path.toSVG(2),
  };
}
