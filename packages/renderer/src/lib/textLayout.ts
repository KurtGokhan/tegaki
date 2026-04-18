import { graphemes } from './utils.ts';

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
  const elLeft = el.getBoundingClientRect().left;
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

    // A significant vertical shift signals a new line
    if (currentLine.length > 0 && rect.top - prevTop > fontSize * 0.25) {
      lines.push(currentLine);
      currentLine = [];
    }

    if (currentLine.length === 0) {
      prevTop = rect.top;
    }

    charOffsets.push((rect.left - elLeft) / fontSize);
    charWidths.push(rect.width / fontSize);
    currentLine.push(i);
  }
  if (currentLine.length > 0) lines.push(currentLine);

  return { lines, charOffsets, charWidths };
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
