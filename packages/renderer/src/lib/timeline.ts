import type { TegakiBundle } from '../types.ts';
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
  char: string;
  offset: number;
  duration: number;
  hasGlyph: boolean;
}

export interface Timeline {
  entries: TimelineEntry[];
  totalDuration: number;
}

export function computeTimeline(text: string, font: TegakiBundle, config?: TimelineConfig): Timeline {
  const glyphGap = config?.glyphGap ?? DEFAULTS.glyphGap;
  const wordGap = config?.wordGap ?? DEFAULTS.wordGap;
  const lineGap = config?.lineGap ?? DEFAULTS.lineGap;
  const unknownDuration = config?.unknownDuration ?? DEFAULTS.unknownDuration;

  const chars = graphemes(text);
  const entries: TimelineEntry[] = [];
  let offset = 0;
  for (const char of chars) {
    const glyph = font.glyphData[char];
    const hasGlyph = !!glyph;
    const isLineBreak = char === '\n';
    const isWhitespace = isLineBreak || /^\s+$/.test(char);
    const duration = isWhitespace ? 0 : hasGlyph ? (glyph.t ?? unknownDuration) : unknownDuration;
    entries.push({ char, offset, duration, hasGlyph });
    offset += duration;

    // Gap after this character
    if (isLineBreak) {
      offset += lineGap;
    } else if (isWhitespace) {
      offset += wordGap;
    } else {
      offset += glyphGap;
    }
  }
  // Remove trailing gap
  if (entries.length > 0) {
    const lastChar = chars[chars.length - 1]!;
    const trailingGap = lastChar === '\n' ? lineGap : /^\s+$/.test(lastChar) ? wordGap : glyphGap;
    offset -= trailingGap;
  }
  return { entries, totalDuration: Math.max(0, offset) };
}
