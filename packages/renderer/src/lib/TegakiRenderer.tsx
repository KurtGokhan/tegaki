import { type ComponentProps, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TegakiBundle, TegakiEffects } from '../types.ts';
import { drawFallbackGlyph } from './drawFallbackGlyph.ts';
import { drawGlyph } from './drawGlyph.ts';
import { resolveEffects } from './effects.ts';
import { computeTextLayout } from './textLayout.ts';
import type { TimelineConfig, TimelineEntry } from './timeline.ts';
import { computeTimeline } from './timeline.ts';
import type { Coercible } from './utils.ts';
import { coerceToString, graphemes } from './utils.ts';

const PADDING_H_EM = 0.2;
const MIN_LINE_HEIGHT_EM = 1.8;
const MIN_PADDING_V_EM = 0.2;

// --- CSS custom property names ---

const CSS_TIME = '--tegaki-time';
const CSS_PROGRESS = '--tegaki-progress';
const CSS_DURATION = '--tegaki-duration';

// Register custom properties so they are animatable (typed as <number>).
// Calling registerProperty twice with the same name throws, so guard with try/catch.
if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
  for (const prop of [CSS_TIME, CSS_PROGRESS, CSS_DURATION]) {
    try {
      CSS.registerProperty({ name: prop, syntax: '<number>', inherits: true, initialValue: '0' });
    } catch {
      // Already registered — ignore.
    }
  }
}

export type TimeControlMode = {
  controlled: {
    mode: 'controlled';
    /** Current time in seconds. */
    value: number;
  };
  uncontrolled: {
    mode: 'uncontrolled';
    /** Initial time in seconds. Default: `0` */
    initialTime?: number;
    /** Playback speed multiplier. Default: `1` */
    speed?: number;
    /** Whether animation is playing. Default: `true` */
    playing?: boolean;
    /** Loop animation when it reaches the end. Default: `false` */
    loop?: boolean;
    /**
     * Catch-up strength. When positive, playback speeds up when there is a
     * large amount of remaining animation and decays back to normal gradually.
     * `0` disables catch-up (default). Higher values ramp up more aggressively.
     * Typical range: `0.2` – `2`.
     */
    catchUp?: number;
    /** Called on every frame with the current time. */
    onTimeChange?: (time: number) => void;
  };
  css: {
    mode: 'css';
  };
};

/**
 * A plain number is shorthand for `{ mode: 'controlled', value: number }`.
 * `'css'` is shorthand for `{ mode: 'css' }`.
 * Omit for uncontrolled mode with default settings.
 */
export type TimeControlProp = null | undefined | number | 'css' | TimeControlMode[keyof TimeControlMode];

export interface TegakiRendererProps<E extends TegakiEffects<E> = Record<string, never>> extends Omit<ComponentProps<'div'>, 'children'> {
  /** TegakiBundle with font data and animated glyph SVGs. */
  font?: TegakiBundle;

  /** Text to animate. Takes precedence over children. */
  text?: string;

  /** Children coerced to string. Strings and numbers are kept; everything else is ignored. */
  children?: Coercible;

  /**
   * Time control. Accepts a number (controlled shorthand), or an object
   * specifying the mode (`'controlled'`, `'uncontrolled'`, or `'css'`).
   * Omit for uncontrolled playback with default settings.
   */
  time?: TimeControlProp;

  /** Called once when the animation reaches the end of the timeline. */
  onComplete?: () => void;

  /** Rendering mode. `'canvas'` draws strokes on a `<canvas>` (requires
   * `font.glyphData`), `'svg'` uses animated SVG elements. Default: `'canvas'` */
  mode?: 'canvas' | 'svg';

  /** Visual effects applied during canvas rendering. */
  effects?: E;

  /** Maximum segment size in pixels for effect subdivision. Lower values produce
   * smoother effects but cost more to render. Default: `2` */
  segmentSize?: number;

  /** Timeline timing configuration (gap between glyphs, words, lines, etc.). */
  timing?: TimelineConfig;

  /** Show debug text overlay. */
  showOverlay?: boolean;
}

// --- Component ---

export function TegakiRenderer<const E extends TegakiEffects<E> = Record<string, never>>({
  font,
  text,
  children,
  time: timeProp,
  onComplete,
  mode = 'canvas',
  effects,
  segmentSize,
  timing,
  showOverlay,
  ...props
}: TegakiRendererProps<E>) {
  const resolvedText = text ?? coerceToString(children);

  // --- Resolve effects ---
  const resolvedEffects = useMemo(() => resolveEffects(effects as Record<string, any>), [effects]);
  const [seed] = useState(() => Math.random() * 1000);

  // --- Resolve time control ---
  const timeControl: TimeControlMode[keyof TimeControlMode] =
    timeProp == null
      ? { mode: 'uncontrolled' }
      : typeof timeProp === 'number'
        ? { mode: 'controlled', value: timeProp }
        : timeProp === 'css'
          ? { mode: 'css' }
          : timeProp;

  const isCss = timeControl.mode === 'css';
  const isControlled = timeControl.mode === 'controlled' || isCss;
  const controlledTime = timeControl.mode === 'controlled' ? timeControl.value : undefined;
  const defaultTime = timeControl.mode === 'uncontrolled' ? (timeControl.initialTime ?? 0) : 0;
  const speed = timeControl.mode === 'uncontrolled' ? (timeControl.speed ?? 1) : 1;
  const playing = timeControl.mode === 'uncontrolled' ? (timeControl.playing ?? true) : false;
  const loop = timeControl.mode === 'uncontrolled' ? (timeControl.loop ?? false) : false;
  const catchUp = timeControl.mode === 'uncontrolled' ? (timeControl.catchUp ?? 0) : 0;
  const onTimeChange = timeControl.mode === 'uncontrolled' ? timeControl.onTimeChange : undefined;

  // --- Internal time (uncontrolled mode) ---
  const [internalTime, setInternalTime] = useState(defaultTime);
  // --- CSS-driven time ---
  const [cssTime, setCssTime] = useState(0);
  const currentTime = isCss ? cssTime : isControlled ? controlledTime! : internalTime;

  // Stable callback refs to avoid restarting the rAF loop
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // --- Font-derived constants ---
  const fontFamily = font?.family;
  const emHeight = font ? (font.ascender - font.descender) / font.unitsPerEm : 0;
  const baselineOffset = font ? font.descender / font.unitsPerEm : 0;

  // --- Container measurement ---
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fontSize, setFontSize] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);

  // --- Timeline ---
  const timeline = useMemo(
    () => (font && resolvedText ? computeTimeline(resolvedText, font, timing) : { entries: [] as TimelineEntry[], totalDuration: 0 }),
    [resolvedText, font, timing],
  );

  // Duration ref so the rAF loop always sees the latest value without restarting
  const totalDurationRef = useRef(timeline.totalDuration);
  totalDurationRef.current = timeline.totalDuration;

  // Smoothed catch-up boost (raw bonus on top of base speed; attack/release smoothed)
  const smoothedBoostRef = useRef(0);

  // --- Completion tracking ---
  const prevCompletedRef = useRef(false);
  const isComplete = timeline.totalDuration > 0 && currentTime >= timeline.totalDuration;

  useEffect(() => {
    if (isComplete && !prevCompletedRef.current) {
      prevCompletedRef.current = true;
      onCompleteRef.current?.();
    } else if (!isComplete) {
      prevCompletedRef.current = false;
    }
  });

  // --- Uncontrolled: time change notification ---
  useEffect(() => {
    if (!isControlled) {
      onTimeChangeRef.current?.(internalTime);
    }
  }, [internalTime, isControlled]);

  // --- Uncontrolled: rAF playback loop ---
  useEffect(() => {
    if (isControlled || !playing || !font) return;

    // Reset smoothed boost when the loop restarts
    smoothedBoostRef.current = 0;

    let lastTs: number | null = null;
    let raf: number;

    // Catch-up smoothing rates (per-second exponential factors)
    const attackRate = 4; // fast ramp-up
    const releaseRate = loop ? 30 : 2; // slow decay back to base

    const tick = (ts: number) => {
      if (lastTs === null) lastTs = ts;
      const dtSec = (ts - lastTs) / 1000;
      lastTs = ts;

      setInternalTime((prev: number) => {
        const totalDur = totalDurationRef.current;
        if (totalDur === 0 || (!loop && prev >= totalDur)) return totalDur;

        // Compute effective speed with catch-up
        let effectiveSpeed = speed;
        if (catchUp > 0) {
          const remaining = Math.max(0, totalDur - prev);
          const excess = Math.max(0, remaining - 2);
          const targetBoost = catchUp * excess;
          const rate = targetBoost > smoothedBoostRef.current ? attackRate : releaseRate;
          smoothedBoostRef.current += (targetBoost - smoothedBoostRef.current) * (1 - Math.exp(-rate * dtSec));
          effectiveSpeed = speed + smoothedBoostRef.current;
        }

        let next = prev + dtSec * effectiveSpeed;
        if (next >= totalDur) {
          next = loop ? next % totalDur : totalDur;
          smoothedBoostRef.current = 0; // reset boost on loop
        }
        return next;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isControlled, playing, speed, loop, catchUp, font]);

  // --- SVG refs (only needed in SVG mode) ---
  const svgRefs = useRef(new Map<number, SVGSVGElement>());
  const svgRefCallbacks = useRef(new Map<number, (node: SVGSVGElement | null) => void>());

  const makeSvgRef = useCallback(
    (charIdx: number) => (node: SVGSVGElement | null) => {
      if (node) {
        node.pauseAnimations();
        svgRefs.current.set(charIdx, node);
      } else {
        svgRefs.current.delete(charIdx);
      }
    },
    [],
  );

  const getSvgRef = useCallback(
    (charIdx: number) => {
      let cb = svgRefCallbacks.current.get(charIdx);
      if (!cb) {
        cb = makeSvgRef(charIdx);
        svgRefCallbacks.current.set(charIdx, cb);
      }
      return cb;
    },
    [makeSvgRef],
  );

  // Clear stale SVG refs when font or mode changes
  const prevFontRef = useRef(font);
  const prevModeRef = useRef(mode);
  if (prevFontRef.current !== font || prevModeRef.current !== mode) {
    prevFontRef.current = font;
    prevModeRef.current = mode;
    svgRefs.current.clear();
    svgRefCallbacks.current.clear();
  }

  // --- Container size observation ---
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        setContainerWidth(entry.contentRect.width);
        const styles = getComputedStyle(el);
        setFontSize(Number.parseFloat(styles.fontSize));
        setLineHeight(Number.parseFloat(styles.lineHeight));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sentinel element ref — a hidden child with `font-size: inherit` and a near-zero
  // CSS transition. When any ancestor changes font-size, the transition fires an event
  // so we can read the new value without polling getComputedStyle every render.
  const sentinelRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const onTransition = (e: TransitionEvent) => {
      const styles = getComputedStyle(el);
      if (e.propertyName === 'font-size' || e.propertyName === 'line-height') {
        setFontSize(Number.parseFloat(styles.fontSize));
        setLineHeight(Number.parseFloat(styles.lineHeight));
      }
      if (e.propertyName === CSS_PROGRESS) {
        const rawProgress = Number(styles.getPropertyValue(CSS_PROGRESS));
        setCssTime(rawProgress * totalDurationRef.current);
      }
    };
    el.addEventListener('transitionend', onTransition);
    return () => el.removeEventListener('transitionend', onTransition);
  }, []);

  // --- Text layout ---
  const layout = useMemo(() => {
    if (!fontFamily || !fontSize || !containerWidth || !resolvedText) return null;
    return computeTextLayout(resolvedText, fontFamily, fontSize, lineHeight, containerWidth);
  }, [resolvedText, fontFamily, fontSize, lineHeight, containerWidth]);

  // --- Canvas padding ---
  const padH = PADDING_H_EM * fontSize;
  const padV = fontSize ? Math.max(MIN_PADDING_V_EM * fontSize, (MIN_LINE_HEIGHT_EM * fontSize - lineHeight) / 2) : 0;

  // --- Sync SVG glyph times before paint ---
  // Runs every render so SVGs stay correct even when currentTime hasn't changed
  // (e.g. after pausing, or when ref callbacks re-fire due to re-renders).
  useLayoutEffect(() => {
    if (mode !== 'svg') return;
    const entries = timeline.entries;
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      if (!entry.hasSvg) continue;
      const svg = svgRefs.current.get(i);
      if (!svg) continue;
      const localTime = Math.max(0, Math.min(currentTime - entry.offset, entry.duration));
      svg.setCurrentTime(localTime);
    }
  });

  // --- Canvas rendering ---
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (mode !== 'canvas') return;
    const canvas = canvasRef.current;
    if (!canvas || !font?.glyphData || !layout || !fontSize) return;

    const dpr = window.devicePixelRatio || 1;
    const el = rootRef.current;
    if (!el) return;
    const canvasRect = canvas.getBoundingClientRect();
    const w = canvasRect.width;
    const h = canvasRect.height;

    // Resize canvas backing store if needed
    const needsResize = canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr);
    if (needsResize) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.translate(padH, padV);

    // Read currentColor from the container
    const color = getComputedStyle(el).color;

    const emHeightPx = emHeight * fontSize;
    const halfLeading = (lineHeight - emHeightPx) / 2;
    const characters = graphemes(resolvedText);

    let y = 0;
    for (const lineIndices of layout.lines) {
      let x = 0;
      for (const charIdx of lineIndices) {
        const char = characters[charIdx]!;
        if (char === '\n') continue;
        const entry = timeline.entries[charIdx]!;
        const charWidth = layout.charWidths[charIdx] ?? 0;
        const kerning = layout.kernings[charIdx] ?? 0;
        const glyph = font.glyphData[char];

        if (glyph && entry.hasSvg) {
          const localTime = Math.max(0, Math.min(currentTime - entry.offset, entry.duration));
          const glyphY = y + halfLeading;
          drawGlyph(
            ctx,
            glyph,
            {
              x,
              y: glyphY,
              fontSize,
              unitsPerEm: font.unitsPerEm,
              ascender: font.ascender,
              descender: font.descender,
            },
            localTime,
            font.lineCap,
            color,
            resolvedEffects,
            seed + charIdx,
            segmentSize,
          );
        } else if (!entry.hasSvg && currentTime >= entry.offset + entry.duration) {
          const baseline = y + halfLeading + (font.ascender / font.unitsPerEm) * fontSize;
          drawFallbackGlyph(ctx, char, x, baseline, fontSize, fontFamily!, color, resolvedEffects, seed + charIdx);
        }

        x += (charWidth + kerning) * fontSize;
      }
      y += lineHeight;
    }
  }, [
    mode,
    currentTime,
    timeline,
    layout,
    font,
    fontFamily,
    fontSize,
    lineHeight,
    resolvedText,
    emHeight,
    padH,
    padV,
    resolvedEffects,
    seed,
    segmentSize,
  ]);

  // --- SVG rendering (skipped entirely in canvas mode) ---
  const lineElements = useMemo(() => {
    if (mode !== 'svg' || !font || !resolvedText) return null;

    const characters = graphemes(resolvedText);

    const renderGlyph = (charIdx: number) => {
      const char = characters[charIdx]!;
      const entry = timeline.entries[charIdx]!;
      const GlyphSvg = font.glyphs[char] as any;
      const width = layout?.charWidths[charIdx] ?? 1;
      const kerning = layout?.kernings[charIdx];

      if (char === '\n') return null;

      if (GlyphSvg) {
        return (
          <GlyphSvg
            key={charIdx}
            ref={getSvgRef(charIdx)}
            style={{
              display: 'inline-block',
              verticalAlign: `${baselineOffset}em`,
              width: `${width}em`,
              marginRight: kerning ? `${kerning}em` : undefined,
              height: `${emHeight}em`,
              overflow: 'visible',
            }}
          />
        );
      }

      const isVisible = currentTime >= entry.offset + entry.duration;
      return (
        <span style={{ fontFamily, visibility: isVisible ? 'visible' : 'hidden' }} key={charIdx}>
          {char}
        </span>
      );
    };

    if (layout) {
      return layout.lines.map((lineIndices, lineIdx) => {
        const isEmpty = lineIndices.every((i) => characters[i] === '\n');
        return (
          <div style={{ whiteSpace: 'nowrap', height: isEmpty ? '1lh' : undefined, lineHeight: `${lineHeight}px` }} key={lineIdx}>
            {lineIndices.map(renderGlyph)}
          </div>
        );
      });
    }

    // Fallback before layout is ready: single line
    return characters.length > 0 ? <div style={{ whiteSpace: 'nowrap' }}>{characters.map((_, i) => renderGlyph(i))}</div> : null;
  }, [mode, resolvedText, timeline, font, layout, getSvgRef, baselineOffset, emHeight, currentTime, fontFamily, lineHeight]);

  // --- Rendering ---

  if (!font || !resolvedText) {
    return <div ref={rootRef} {...props} />;
  }

  return (
    <div
      ref={rootRef}
      {...props}
      style={{
        ...props.style,
        position: 'relative',
        maxWidth: '100%',
        width: 'auto',
        height: 'auto',
        ...{
          [CSS_DURATION]: timeline.totalDuration,
          [CSS_TIME]: currentTime,
          [CSS_PROGRESS]: timeline.totalDuration > 0 ? currentTime / timeline.totalDuration : 0,
        },
      }}
    >
      {/* Sentinel: inherits font-size & line-height; its height changes when either changes */}
      <span
        ref={sentinelRef}
        aria-hidden
        style={{
          position: 'absolute',
          width: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          fontSize: 'inherit',
          lineHeight: 'inherit',
          visibility: 'hidden',
          transition: isCss ? `font-size 0.001s, line-height 0.001s, ${CSS_PROGRESS} 0.001s` : 'font-size 0.001s, line-height 0.001s',
        }}
      >
        {'\u00A0'}
      </span>
      {mode === 'canvas' ? (
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: `${-padV}px ${-padH}px`,
            width: `calc(100% + ${padH * 2}px)`,
            height: `calc(100% + ${padV * 2}px)`,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            fontFamily,
          }}
        >
          {lineElements}
        </div>
      )}

      <div
        style={{
          userSelect: 'auto',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          paddingRight: 1,
          WebkitTextFillColor: showOverlay ? undefined : 'transparent',
          fontFamily,
          color: showOverlay ? 'rgba(255, 0, 0, 0.4)' : undefined,
          fontFeatureSettings: "'calt' 0, 'liga' 0",
        }}
      >
        {resolvedText}
      </div>
    </div>
  );
}
