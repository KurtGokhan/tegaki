import type { TegakiBundle } from '../types.ts';
import type { BundleShaper } from './hb-shaper.ts';
import { graphemes } from './utils.ts';

export interface TimelineConfig {
  /** Pause between glyphs (seconds). Default: `0.1` */
  glyphGap?: number;
  /** Pause after a space character (seconds). Default: `0.15` */
  wordGap?: number;
  /** Pause after a newline / line break (seconds). Default: `0.3` */
  lineGap?: number;
  /** Duration for characters without glyph data (seconds). Default: `0.2` */
  unknownDuration?: number;
  /**
   * Easing function for each stroke's animation progress `(0–1) → (0–1)`.
   * Applied per-stroke to map linear draw progress to eased progress.
   * Default: ease-out exponential (`1 - 2^(-10t)`).
   */
  strokeEasing?: (t: number) => number;
  /**
   * Easing function for each glyph's local time progress `(0–1) → (0–1)`.
   * Applied per-glyph to map linear time within the glyph to eased time.
   * Default: linear (no easing).
   */
  glyphEasing?: (t: number) => number;
}

const DEFAULTS = {
  glyphGap: 0.1,
  wordGap: 0.15,
  lineGap: 0.3,
  unknownDuration: 0.2,
};

export interface TimelineEntry {
  /** First grapheme of the cluster this entry represents. Used for fallback glyph lookup. */
  char: string;
  /** Grapheme index of `char` in the full text — matches `layout.charOffsets`. */
  graphemeIndex: number;
  /** Shaped glyph id (when a shaper produced this entry). */
  glyphId?: number;
  offset: number;
  duration: number;
  hasGlyph: boolean;
}

export interface Timeline {
  entries: TimelineEntry[];
  totalDuration: number;
}

export function computeTimeline(text: string, font: TegakiBundle, config?: TimelineConfig, shaper?: BundleShaper | null): Timeline {
  if (shaper && font.glyphDataById) {
    return computeShapedTimeline(text, font, config, shaper);
  }
  return computeGraphemeTimeline(text, font, config);
}

function computeGraphemeTimeline(text: string, font: TegakiBundle, config?: TimelineConfig): Timeline {
  const glyphGap = config?.glyphGap ?? DEFAULTS.glyphGap;
  const wordGap = config?.wordGap ?? DEFAULTS.wordGap;
  const lineGap = config?.lineGap ?? DEFAULTS.lineGap;
  const unknownDuration = config?.unknownDuration ?? DEFAULTS.unknownDuration;

  const chars = graphemes(text);
  const entries: TimelineEntry[] = [];
  let offset = 0;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;
    const glyph = font.glyphData[char];
    const hasGlyph = !!glyph;
    const isLineBreak = char === '\n';
    const isWhitespace = isLineBreak || /^\s+$/.test(char);
    const duration = isWhitespace ? 0 : hasGlyph ? (glyph.t ?? unknownDuration) : unknownDuration;
    entries.push({ char, graphemeIndex: i, offset, duration, hasGlyph });
    offset += duration;

    if (isLineBreak) {
      offset += lineGap;
    } else if (isWhitespace) {
      offset += wordGap;
    } else {
      offset += glyphGap;
    }
  }
  if (entries.length > 0) {
    const lastChar = chars[chars.length - 1]!;
    const trailingGap = lastChar === '\n' ? lineGap : /^\s+$/.test(lastChar) ? wordGap : glyphGap;
    offset -= trailingGap;
  }
  return { entries, totalDuration: Math.max(0, offset) };
}

function computeShapedTimeline(text: string, font: TegakiBundle, config: TimelineConfig | undefined, shaper: BundleShaper): Timeline {
  const glyphGap = config?.glyphGap ?? DEFAULTS.glyphGap;
  const wordGap = config?.wordGap ?? DEFAULTS.wordGap;
  const lineGap = config?.lineGap ?? DEFAULTS.lineGap;
  const unknownDuration = config?.unknownDuration ?? DEFAULTS.unknownDuration;

  // UTF-16 offset → grapheme index map. Shaper clusters come back in UTF-16
  // units; the renderer's layout indexes by grapheme. Map once per text.
  const chars = graphemes(text);
  const utf16ToGrapheme = new Int32Array(text.length + 1).fill(-1);
  {
    let u = 0;
    for (let i = 0; i < chars.length; i++) {
      utf16ToGrapheme[u] = i;
      u += chars[i]!.length;
    }
    utf16ToGrapheme[text.length] = chars.length;
  }

  const entries: TimelineEntry[] = [];
  let offset = 0;
  let trailingGap = 0;

  // Shape each newline-delimited line separately so shaping never crosses a
  // break. This matches the DOM layout, which also breaks at `\n`.
  let lineStart = 0;
  for (let i = 0; i <= text.length; i++) {
    const atEnd = i === text.length;
    if (!atEnd && text[i] !== '\n') continue;

    const lineText = text.slice(lineStart, i);
    if (lineText.length > 0) {
      const shaped = shaper.shape(lineText);
      for (let g = 0; g < shaped.length; g++) {
        const glyph = shaped[g]!;
        const clusterStart = lineStart + glyph.cl;
        const clusterEnd = g + 1 < shaped.length ? lineStart + shaped[g + 1]!.cl : i;
        const graphemeIdx = utf16ToGrapheme[clusterStart] ?? -1;
        if (graphemeIdx < 0) continue; // cluster starts mid-grapheme — skip
        const clusterText = text.slice(clusterStart, clusterEnd);
        const firstChar = chars[graphemeIdx]!;
        const isWhitespace = /^\s+$/.test(clusterText);
        const data = font.glyphDataById?.[String(glyph.g)] ?? font.glyphData[firstChar];
        const hasGlyph = !!data;
        const duration = isWhitespace ? 0 : hasGlyph ? (data.t ?? unknownDuration) : unknownDuration;
        entries.push({
          char: firstChar,
          graphemeIndex: graphemeIdx,
          glyphId: glyph.g,
          offset,
          duration,
          hasGlyph,
        });
        offset += duration;
        trailingGap = isWhitespace ? wordGap : glyphGap;
        offset += trailingGap;
      }
    }

    if (!atEnd) {
      // Newline character contributes a `lineGap` (no entry, no duration).
      offset += lineGap;
      trailingGap = lineGap;
      lineStart = i + 1;
    }
  }

  if (offset > 0) offset -= trailingGap;
  return { entries, totalDuration: Math.max(0, offset) };
}
