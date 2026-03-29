import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';
import { type ComponentProps, type CSSProperties, type ReactElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { twJoin } from 'tailwind-merge';
import type { FontBundle } from '../types.ts';

const GLYPH_GAP = 0.1;

interface TimelineEntry {
  char: string;
  offset: number;
  duration: number;
  hasSvg: boolean;
}

export interface Timeline {
  entries: TimelineEntry[];
  totalDuration: number;
}

export function computeTimeline(text: string, font: FontBundle): Timeline {
  const chars = text.split('');
  const entries: TimelineEntry[] = [];
  let offset = 0;
  for (const char of chars) {
    const hasSvg = char in font.glyphs;
    const duration = hasSvg ? (font.glyphTimings[char] ?? 1) : 0;
    entries.push({ char, offset, duration, hasSvg });
    offset += duration;
    if (hasSvg) offset += GLYPH_GAP;
  }
  // Remove trailing gap
  if (entries.length > 0 && entries[entries.length - 1]!.hasSvg) {
    offset -= GLYPH_GAP;
  }
  return { entries, totalDuration: Math.max(0, offset) };
}

interface TextLayout {
  /** Character indices per line */
  lines: number[][];
  /** Width in em per character index */
  charWidths: number[];
  /** Kerning adjustment in em between character at index i and i+1 */
  kernings: number[];
  /** Intrinsic (single-line) width in em */
  intrinsicWidth: number;
}

function computeTextLayout(text: string, fontFamily: string, fontSize: number, maxWidth: number): TextLayout {
  const fontStr = `${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.4;

  // Measure unique character widths
  const widthCache = new Map<string, number>();
  const charWidths: number[] = [];
  for (const char of text) {
    let w = widthCache.get(char);
    if (w === undefined) {
      if (char === '\n') {
        w = 0;
      } else {
        const p = prepareWithSegments(char, fontStr, { whiteSpace: 'pre-wrap' });
        const r = layoutWithLines(p, Infinity, lineHeight);
        w = r.lines.length > 0 ? r.lines[0]!.width / fontSize : 0;
      }
      widthCache.set(char, w);
    }
    charWidths.push(w);
  }

  // Compute intrinsic width (single-line, no wrapping)
  const prepared = prepareWithSegments(text, fontStr, { whiteSpace: 'pre-wrap' });
  const singleLineResult = layoutWithLines(prepared, Infinity, lineHeight);
  const intrinsicWidth = Math.max(0, ...singleLineResult.lines.map((l) => l.width)) / fontSize;

  // Line breaking at actual available width
  const result = layoutWithLines(prepared, maxWidth, lineHeight);

  // Map line texts back to character indices
  const lines: number[][] = [];
  let charOffset = 0;
  for (const line of result.lines) {
    const indices: number[] = [];
    for (let i = 0; i < line.text.length; i++) {
      indices.push(charOffset + i);
    }
    charOffset += line.text.length;
    // Consume the newline that caused this line break
    if (charOffset < text.length && text[charOffset] === '\n') {
      indices.push(charOffset);
      charOffset++;
    }
    lines.push(indices);
  }

  // Any remaining characters (shouldn't happen, but safety)
  if (charOffset < text.length) {
    const indices: number[] = [];
    for (let i = charOffset; i < text.length; i++) {
      indices.push(i);
    }
    lines.push(indices);
  }

  // Measure kerning between adjacent character pairs
  const kernings: number[] = [];
  const pairCache = new Map<string, number>();
  for (let i = 0; i < text.length - 1; i++) {
    const a = text[i]!;
    const b = text[i + 1]!;
    if (a === '\n' || b === '\n') {
      kernings.push(0);
      continue;
    }
    const pair = `${a}${b}`;
    let k = pairCache.get(pair);
    if (k === undefined) {
      const p = prepareWithSegments(pair, fontStr, { whiteSpace: 'pre-wrap' });
      const r = layoutWithLines(p, Infinity, lineHeight);
      const pairWidth = r.lines.length > 0 ? r.lines[0]!.width / fontSize : 0;
      k = pairWidth - (widthCache.get(a) ?? 0) - (widthCache.get(b) ?? 0);
      if (Math.abs(k) < 0.001) k = 0;
      pairCache.set(pair, k);
    }
    kernings.push(k);
  }

  return { lines, charWidths, kernings, intrinsicWidth };
}

export function Tegaki({ text, time, font, ...props }: { text: string; time: number; font: FontBundle } & ComponentProps<'div'>) {
  const fontFamily = font.family;
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fontSize, setFontSize] = useState(0);

  const timeline = useMemo(() => computeTimeline(text, font), [text, font]);
  const svgRefs = useRef(new Map<number, SVGSVGElement>());

  // Observe container size for line wrapping
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        setFontSize(Number.parseFloat(getComputedStyle(el).fontSize));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Compute text layout with pretext
  const layout = useMemo(() => {
    if (!fontFamily || !fontSize || !containerWidth || !text) return null;
    return computeTextLayout(text, fontFamily, fontSize, containerWidth);
  }, [text, fontFamily, fontSize, containerWidth]);

  // Update all SVG elements' current time before paint
  useLayoutEffect(() => {
    for (let i = 0; i < timeline.entries.length; i++) {
      const entry = timeline.entries[i]!;
      const svg = svgRefs.current.get(i);
      if (!svg || !entry.hasSvg) continue;
      const localTime = Math.max(0, Math.min(time - entry.offset, entry.duration));
      svg.setCurrentTime(localTime);
    }
  }, [time, timeline]);

  const characters = text.split('');

  const renderGlyph = (charIdx: number) => {
    const char = characters[charIdx]!;
    const entry = timeline.entries[charIdx]!;
    const GlyphSvg = font.glyphs[char] as any;
    const width = layout?.charWidths[charIdx] ?? 1;
    const kerning = layout?.kernings[charIdx];

    const style: CSSProperties = {
      width: `${width}em`,
      marginRight: kerning ? `${kerning}em` : undefined,
    };

    let content: ReactElement;

    if (char === '\n') {
      return null; // newlines handled by line structure
    }

    if (GlyphSvg) {
      content = (
        <GlyphSvg
          ref={(node: SVGSVGElement | null) => {
            if (node) {
              node.pauseAnimations();
              svgRefs.current.set(charIdx, node);
            } else {
              svgRefs.current.delete(charIdx);
            }
          }}
          style={{ height: '1lh', overflow: 'visible', marginInline: '-100%' }}
        />
      );
    } else {
      const isVisible = time >= entry.offset;
      content = <span style={{ fontFamily, visibility: isVisible ? 'visible' : 'hidden' }}>{char}</span>;
    }

    return (
      <span className="inline-flex items-baseline justify-center" style={style} key={charIdx}>
        {content}
      </span>
    );
  };

  const lineElements = layout
    ? layout.lines.map((lineIndices, lineIdx) => {
        const isEmpty = lineIndices.every((i) => characters[i] === '\n');
        return (
          <div className="flex flex-row" style={isEmpty ? { height: '1lh' } : undefined} key={lineIdx}>
            {lineIndices.map(renderGlyph)}
          </div>
        );
      })
    : // Fallback before layout is ready: single line
      characters.length > 0 && <div className="flex flex-row">{characters.map((_, i) => renderGlyph(i))}</div>;

  return (
    <div
      ref={rootRef}
      {...props}
      className={twJoin('relative grid', props.className)}
      style={{
        ...props.style,
        maxWidth: '100%',
        width: 'auto',
        height: 'auto',
      }}
    >
      <div className="[grid-area:1/1] absolute inset-0 pointer-events-none">{lineElements}</div>

      <div
        className="[grid-area:1/1] select-auto [-webkit-text-fill-color:transparent] whitespace-pre-wrap wrap-break-word pr-[1px]"
        style={{ fontFamily }}
      >
        {text}
      </div>
    </div>
  );
}
