import * as opentype from 'opentype.js';
import {
  type ComponentProps,
  type CSSProperties,
  type FC,
  type ReactNode,
  type SVGProps,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';
import { twJoin } from 'tailwind-merge';
import fontUrl from '#.cache/fonts/caveat.ttf' with { type: 'url' };
import { glyphs } from './glyphs.ts';

export function Handwriter({ text, ...props }: { text: string } & ComponentProps<'div'>) {
  const characters = text.split('');
  const [_font, setFont] = useState<opentype.Font | null>(null);
  const [isBrowserFontReady, setIsBrowserFontReady] = useState(false);
  const [kernings, setKernings] = useState<number[]>([]);
  const [charWidths, setCharWidths] = useState<number[]>([]);

  const [count, setCount] = useState(1);
  const increment = useCallback(() => setCount((c) => c + 1), []);

  const textLength = text.length;
  useEffect(() => {
    setCount((c) => Math.min(c, textLength + 1));
  }, [textLength]);

  useEffect(() => {
    opentype.load(fontUrl, (err, font) => {
      if (err) console.error(`Font could not be loaded`, err);
      else if (font) setFont(font);
    });

    if (typeof document !== 'undefined' && 'FontFace' in window) {
      const fontFace = new FontFace('KalamHandwriter', `url(${fontUrl})`);
      fontFace
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
          setIsBrowserFontReady(true);
        })
        .catch((e) => console.error('Browser font load failed', e));
    }
  }, []);

  useEffect(() => {
    if (!isBrowserFontReady) return;

    const span = document.createElement('span');
    span.style.fontFamily = 'Kalam';
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
      if (char === ' ') char = '\u00A0'; // Non-breaking space to measure spaces correctly
      if (!char) continue;

      span.textContent = char;
      const w1 = span.getBoundingClientRect().width;
      newWidths.push(w1 / 100);

      if (i < chars.length - 1) {
        let nextChar = chars[i + 1];
        if (nextChar === ' ') nextChar = '\u00A0'; // Non-breaking space to measure spaces correctly
        if (!nextChar) continue;

        span.textContent = nextChar;
        const w2 = span.getBoundingClientRect().width;

        span.textContent = char + nextChar;
        const wPair = span.getBoundingClientRect().width;

        let k = (wPair - (w1 + w2)) / 100;

        // Filter out noise but allow small valid kerning
        if (Math.abs(k) < 0.0001) k = 0;

        newKernings.push(k);
      }
    }

    document.body.removeChild(span);
    setKernings(newKernings);
    setCharWidths(newWidths);
  }, [text, isBrowserFontReady]);

  const glyphElements = characters.map((char, index) => {
    const GlyphSvg = glyphs[char as keyof typeof glyphs] as any;

    let style: CSSProperties = {};
    if (isBrowserFontReady && charWidths[index] !== undefined) {
      const width = charWidths[index];
      const marginRight = kernings[index];

      style = {
        width: `${width}em`,
        marginRight: marginRight ? `${marginRight}em` : undefined,
      };
    } else {
      style = { width: '1em' };
    }

    let content: ReactNode = null;

    if (index >= count) {
      content = (
        <span className="size-[1em]" key={index}>
          &nbsp;
        </span>
      );
    } else if (GlyphSvg) {
      content = (
        <WithEndEvent
          key={index}
          Cmp={GlyphSvg}
          onEnd={() => {
            setCount((c) => Math.max(c, index + 2));
          }}
          className="text-inherit! size-[1.4222em] shrink-0"
        />
      );
    } else {
      content = (
        <span key={index} className="size-[1em]" ref={increment}>
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

function WithEndEvent({ Cmp, onEnd, ...props }: { Cmp: FC<SVGProps<SVGSVGElement>>; onEnd: () => void } & SVGProps<SVGSVGElement>) {
  onEnd = useEffectEvent(onEnd);

  const svgRef = useCallback(
    (node: SVGSVGElement | null) => {
      if (!node) return;

      const animateElements = Array.from(node.getElementsByTagName('animate'));

      const lastAnimate = animateElements.findLast((x) => x.getAttribute('dur') !== '0.00s')!;

      if (!lastAnimate) {
        onEnd();
        return;
      }

      lastAnimate.addEventListener(
        'endEvent',
        () => {
          onEnd();
        },
        false,
      );
    },
    [onEnd],
  );

  return <Cmp ref={svgRef} {...props} />;
}
