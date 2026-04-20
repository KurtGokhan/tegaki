import type { TegakiBundle } from '../types.ts';
import type { BundleShaper, ShapedGlyph } from './shaper.ts';
import { graphemes } from './utils.ts';

// Strong-RTL codepoints: Hebrew, Arabic, Syriac, Thaana, NKo, Samaritan,
// Mandaic, plus Arabic Presentation Forms A/B. Sufficient to decide per-line
// shaping direction for `applyShaperPositions`.
const RTL_CHAR_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

export interface TextLayout {
  /** Character indices per line */
  lines: number[][];
  /** X offset within line in em per character index */
  charOffsets: number[];
  /** Width in em per character index */
  charWidths: number[];
}

/**
 * Measure text layout using the Range API on an existing DOM element.
 * The element must already be in the document with correct text content,
 * font, line-height, white-space, and width styles applied.
 */
export function computeTextLayout(el: HTMLElement, fontSize: number): TextLayout;
/**
 * Measure text layout by creating a temporary off-screen DOM element.
 */
export function computeTextLayout(text: string, fontSize: number, fontFamily: string, lineHeight: number, maxWidth: number): TextLayout;
export function computeTextLayout(
  elOrText: HTMLElement | string,
  fontSize: number,
  fontFamily?: string,
  lineHeight?: number,
  maxWidth?: number,
): TextLayout {
  if (typeof elOrText === 'string') {
    return measureWithTempElement(elOrText, fontFamily!, fontSize, lineHeight!, maxWidth!);
  }
  return measureElement(elOrText, fontSize);
}

function measureElement(el: HTMLElement, fontSize: number): TextLayout {
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return { lines: [], charOffsets: [], charWidths: [] };
  }

  const text = textNode.textContent ?? '';
  const chars = graphemes(text);
  if (!chars.length) return { lines: [], charOffsets: [], charWidths: [] };

  // Use element's left edge as reference so offsets are direction-agnostic.
  // For LTR the first char is near the left edge; for RTL it's near the right —
  // either way, subtracting elLeft produces correct visual x-positions.
  const elRect = el.getBoundingClientRect();
  const elLeft = elRect.left;
  // Ancestor CSS transforms (e.g. Remotion Studio's preview-fit scale) make
  // getClientRects() return pre-scale pixel values while getComputedStyle()
  // returns unscaled fontSize. Divide measured widths by the scale so the em
  // conversion matches fontSize. offsetWidth is layout-box width (unscaled).
  const scale = el.offsetWidth > 0 ? elRect.width / el.offsetWidth : 1;
  const range = document.createRange();

  const charOffsets: number[] = [];
  const charWidths: number[] = [];
  const lines: number[][] = [];
  let currentLine: number[] = [];
  let prevTop = -Infinity;
  let utf16Offset = 0;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]!;

    if (char === '\n') {
      charOffsets.push(0);
      charWidths.push(0);
      currentLine.push(i);
      lines.push(currentLine);
      currentLine = [];
      prevTop = -Infinity;
      utf16Offset += char.length;
      continue;
    }

    range.setStart(textNode, utf16Offset);
    range.setEnd(textNode, utf16Offset + char.length);
    const rects = range.getClientRects();
    utf16Offset += char.length;

    if (rects.length === 0) {
      charOffsets.push(0);
      charWidths.push(0);
      currentLine.push(i);
      continue;
    }

    const rect = rects[rects.length - 1]!;

    // A significant vertical shift signals a new line. Both rect.top and
    // prevTop are in scaled pixels, so compare against a scaled threshold.
    if (currentLine.length > 0 && rect.top - prevTop > fontSize * 0.25 * scale) {
      lines.push(currentLine);
      currentLine = [];
    }

    if (currentLine.length === 0) {
      prevTop = rect.top;
    }

    charOffsets.push((rect.left - elLeft) / scale / fontSize);
    charWidths.push(rect.width / scale / fontSize);
    currentLine.push(i);
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return { lines, charOffsets, charWidths };
}

/**
 * Replace `layout.charOffsets` and `charWidths` with values computed from the
 * shaper's advances, while preserving the DOM's line-break decisions.
 *
 * The DOM's Range API returns imprecise per-grapheme rects inside a complex-
 * shaped cluster (Arabic joining, Indic conjuncts, ligatures with kern/mark
 * GPOS), so strokes positioned from `rect.left` drift relative to the actual
 * glyph origins the shaper produced. Using the shaper's own `ax` walk keeps
 * the stroke positions aligned with the glyph ids the shaper chose.
 *
 * Line anchor (the leftmost visual pixel of each line) is measured from the
 * DOM using a full-line Range — per-grapheme rects inside shaped clusters are
 * not reliable enough to anchor against.
 */
export function applyShaperPositions(
  layout: TextLayout,
  el: HTMLElement,
  text: string,
  fontSize: number,
  font: TegakiBundle,
  shaper: BundleShaper,
): TextLayout {
  const chars = graphemes(text);
  if (!chars.length) return layout;

  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return layout;
  const elRect = el.getBoundingClientRect();
  const elLeft = elRect.left;
  const scale = el.offsetWidth > 0 ? elRect.width / el.offsetWidth : 1;
  const range = document.createRange();

  // utf16 start offset of each grapheme.
  const graphemeStartU: number[] = [];
  {
    let u = 0;
    for (let i = 0; i < chars.length; i++) {
      graphemeStartU.push(u);
      u += chars[i]!.length;
    }
  }
  const utf16ToGrapheme = new Int32Array(text.length + 1).fill(-1);
  for (let i = 0; i < chars.length; i++) utf16ToGrapheme[graphemeStartU[i]!] = i;
  utf16ToGrapheme[text.length] = chars.length;

  const charOffsets = layout.charOffsets.slice();
  const charWidths = layout.charWidths.slice();
  const emPerUnit = 1 / font.unitsPerEm;

  for (const lineIndices of layout.lines) {
    const realIndices = lineIndices.filter((idx) => chars[idx] !== '\n');
    if (realIndices.length === 0) continue;

    const lineStartU = graphemeStartU[realIndices[0]!]!;
    const lastReal = realIndices[realIndices.length - 1]!;
    const lineEndU = graphemeStartU[lastReal]! + chars[lastReal]!.length;

    // Measure the whole line's visual-left edge via a single Range. The
    // line's own aggregate rect is reliable even when per-grapheme rects
    // inside a shaped cluster are not.
    range.setStart(textNode, lineStartU);
    range.setEnd(textNode, lineEndU);
    const lineRects = range.getClientRects();
    if (lineRects.length === 0) continue;
    let lineLeftPx = Infinity;
    for (const r of lineRects) if (r.left < lineLeftPx) lineLeftPx = r.left;
    const lineLeftEm = (lineLeftPx - elLeft) / scale / fontSize;

    // Harfbuzz emits glyphs in a per-run visual order: within each bidi/word
    // run (contiguous stretch where cluster indices walk monotonically) the
    // glyphs are already in visual left-to-right order, but the *runs* are
    // emitted in logical order. For RTL lines that means each word is
    // shaped correctly internally yet the words themselves appear in the
    // wrong order — pen-walking the raw buffer would put the logical-first
    // word at the visual left edge. Detect run boundaries (cl jumps up for
    // RTL, where within a word cl walks downward) and reverse the list of
    // runs so pen-walking forward produces the true visual-LTR layout.
    const lineText = text.slice(lineStartU, lineEndU);
    const lineRTL = RTL_CHAR_RE.test(lineText);
    const shaped = shaper.shape(lineText);
    if (shaped.length === 0) continue;
    const visualGlyphs = lineRTL ? reverseRTLRuns(shaped) : shaped;

    // Walk glyphs in visual order. Glyph draw position is pen + dx, and the
    // pen advances by ax after each glyph. Record each cluster's visual
    // left (using the first glyph in visual order that belongs to it) and
    // its summed advance. Marks have ax=0 and share their base's pen
    // position but may have their own dx/dy — those only matter for mark
    // drawing, which the renderer doesn't emit as separate strokes.
    const clusterLeft = new Map<number, number>();
    const clusterAdvance = new Map<number, number>();
    let penEm = 0;
    for (const g of visualGlyphs) {
      const axEm = g.ax * emPerUnit;
      const dxEm = g.dx * emPerUnit;
      if (!clusterLeft.has(g.cl)) clusterLeft.set(g.cl, penEm + dxEm);
      clusterAdvance.set(g.cl, (clusterAdvance.get(g.cl) ?? 0) + axEm);
      penEm += axEm;
    }

    // Assign offsets to the grapheme at each cluster start.
    const assigned = new Set<number>();
    for (const [cl, leftEm] of clusterLeft) {
      const gIdx = utf16ToGrapheme[lineStartU + cl];
      if (gIdx === undefined || gIdx < 0) continue;
      charOffsets[gIdx] = lineLeftEm + leftEm;
      charWidths[gIdx] = clusterAdvance.get(cl) ?? 0;
      assigned.add(gIdx);
    }

    // Mid-cluster graphemes (ligature interior) share their host cluster's
    // left edge and have zero advance — timeline.ts skips them for drawing,
    // but keep the offset sane for any consumer that indexes by grapheme.
    const sortedCls = [...clusterLeft.keys()].sort((a, b) => a - b);
    for (const idx of realIndices) {
      if (assigned.has(idx)) continue;
      const u = graphemeStartU[idx]! - lineStartU;
      let hostCl = -1;
      for (const cl of sortedCls) {
        if (cl <= u) hostCl = cl;
        else break;
      }
      if (hostCl < 0) continue;
      charOffsets[idx] = lineLeftEm + (clusterLeft.get(hostCl) ?? 0);
      charWidths[idx] = 0;
    }
  }

  return { lines: layout.lines, charOffsets, charWidths };
}

/**
 * Reorder a harfbuzz-shaped RTL line so that pen-walking forward produces
 * visual left-to-right positions. HB emits each word's glyphs in within-word
 * visual order (cl descending for RTL) but keeps the words themselves in
 * logical order — so we split on cl-jumps and reverse the list of runs while
 * preserving each run's internal order.
 */
function reverseRTLRuns(shaped: ShapedGlyph[]): ShapedGlyph[] {
  const runs: ShapedGlyph[][] = [];
  let cur: ShapedGlyph[] = [];
  for (const g of shaped) {
    if (cur.length && g.cl > cur[cur.length - 1]!.cl) {
      runs.push(cur);
      cur = [];
    }
    cur.push(g);
  }
  if (cur.length) runs.push(cur);
  const out: ShapedGlyph[] = [];
  for (let i = runs.length - 1; i >= 0; i--) out.push(...runs[i]!);
  return out;
}

function measureWithTempElement(text: string, fontFamily: string, fontSize: number, lineHeight: number, maxWidth: number): TextLayout {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.left = '-9999px';
  el.style.top = '-9999px';
  el.style.visibility = 'hidden';
  el.style.fontFamily = fontFamily;
  el.style.fontSize = `${fontSize}px`;
  el.style.lineHeight = `${lineHeight}px`;
  el.style.whiteSpace = 'pre-wrap';
  el.style.overflowWrap = 'break-word';
  el.style.width = `${maxWidth}px`;
  el.textContent = text;
  document.body.appendChild(el);

  const result = measureElement(el, fontSize);

  document.body.removeChild(el);
  return result;
}
