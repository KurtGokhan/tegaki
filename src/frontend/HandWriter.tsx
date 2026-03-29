import * as opentype from 'opentype.js';
import { type ComponentProps, type CSSProperties, type ReactElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { twJoin } from 'tailwind-merge';
import fontUrl from '#.cache/fonts/caveat.ttf' with { type: 'url' };
import { glyphs, glyphTimings } from './glyphs.ts';

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

export function computeTimeline(text: string): Timeline {
  const chars = text.split('');
  const entries: TimelineEntry[] = [];
  let offset = 0;
  for (const char of chars) {
    const hasSvg = char in glyphs;
    const duration = hasSvg ? (glyphTimings[char] ?? 1) : 0;
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

export function Handwriter({ text, time, ...props }: { text: string; time: number } & ComponentProps<'div'>) {
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [kernings, setKernings] = useState<number[]>([]);
  const [charWidths, setCharWidths] = useState<number[]>([]);

  const timeline = useMemo(() => computeTimeline(text), [text]);

  // SVG refs for setCurrentTime control
  const svgRefs = useRef(new Map<number, SVGSVGElement>());

  useEffect(() => {
    opentype.load(fontUrl, (err, font) => {
      if (err) {
        console.error('Font could not be loaded', err);
        return;
      }
      if (!font) return;

      const family = font.names.fontFamily?.en ?? 'HandwriterFont';

      if (typeof document !== 'undefined' && 'FontFace' in window) {
        const fontFace = new FontFace(family, `url(${fontUrl})`);
        fontFace
          .load()
          .then((loaded) => {
            document.fonts.add(loaded);
            setFontFamily(family);
          })
          .catch((e) => console.error('Browser font load failed', e));
      }
    });
  }, []);

  useEffect(() => {
    if (!fontFamily) return;

    const span = document.createElement('span');
    span.style.fontFamily = fontFamily;
    span.style.fontSize = '100px';
    span.style.opacity = '0';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'nowrap';
    span.style.fontKerning = 'normal';
    span.style.textRendering = 'optimizeLegibility';
    span.style.contain = 'layout';
    document.body.appendChild(span);

    const newKernings: number[] = [];
    const newWidths: number[] = [];
    const chars = text.split('');

    for (let i = 0; i < chars.length; i++) {
      let char = chars[i];
      if (char === ' ') char = '\u00A0';
      if (!char) continue;

      span.textContent = char;
      const w1 = span.getBoundingClientRect().width;
      newWidths.push(w1 / 100);

      if (i < chars.length - 1) {
        let nextChar = chars[i + 1];
        if (nextChar === ' ') nextChar = '\u00A0';
        if (!nextChar) continue;

        span.textContent = nextChar;
        const w2 = span.getBoundingClientRect().width;

        span.textContent = char + nextChar;
        const wPair = span.getBoundingClientRect().width;

        let k = (wPair - (w1 + w2)) / 100;
        if (Math.abs(k) < 0.0001) k = 0;

        newKernings.push(k);
      }
    }

    document.body.removeChild(span);
    setKernings(newKernings);
    setCharWidths(newWidths);
  }, [text, fontFamily]);

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

  const glyphElements = characters.map((char, index) => {
    const entry = timeline.entries[index]!;
    const GlyphSvg = glyphs[char as keyof typeof glyphs] as any;

    let style: CSSProperties = {};
    if (fontFamily && charWidths[index] !== undefined) {
      const width = charWidths[index];
      const marginRight = kernings[index];
      style = {
        width: `${width}em`,
        marginRight: marginRight ? `${marginRight}em` : undefined,
      };
    } else {
      style = { width: '1em' };
    }

    let content: ReactElement;

    if (GlyphSvg) {
      content = (
        <GlyphSvg
          ref={(node: SVGSVGElement | null) => {
            if (node) {
              node.pauseAnimations();
              svgRefs.current.set(index, node);
            } else {
              svgRefs.current.delete(index);
            }
          }}
          className="text-inherit! size-[1.4222em] shrink-0"
        />
      );
    } else {
      const isVisible = time >= entry.offset;
      content = (
        <span className="size-[1em]" style={{ visibility: isVisible ? 'visible' : 'hidden' }}>
          {char}
        </span>
      );
    }

    return (
      <span className="h-lh flex flex-row items-center justify-center" style={style} key={index}>
        {content}
      </span>
    );
  });

  return (
    <div {...props} className={twJoin('flex flex-row relative', props.className)}>
      {glyphElements}

      <div className="select-auto text-transparent absolute inset-0 selectable whitespace-nowrap">{text}</div>
    </div>
  );
}
