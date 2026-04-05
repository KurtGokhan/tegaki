'use client';

import { type ComponentProps, type Ref, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TegakiBundle, TegakiEffects } from '../types.ts';
import { drawFallbackGlyph } from './drawFallbackGlyph.ts';
import { drawGlyph } from './drawGlyph.ts';
import { resolveEffects } from './effects.ts';
import { computeTextLayout } from './textLayout.ts';
import type { TimelineConfig, TimelineEntry } from './timeline.ts';
import { computeTimeline } from './timeline.ts';
import type { Coercible } from './utils.ts';
import { coerceToString, graphemes } from './utils.ts';

const fontFaceCache = new Map<string, Promise<void>>();

/**
 * Returns a promise that resolves when the font is ready for text measurement.
 * - Already loaded (by us or externally): resolves immediately.
 * - Currently loading externally: waits for `document.fonts.ready`.
 * - Not registered at all: loads it via the FontFace API.
 * Returns `null` if the font is already loaded synchronously.
 */
/**
 * Ensures the bundle's font face is loaded and available for rendering.
 * Resolves immediately if the font is already loaded.
 */
export async function ensureFontFace(bundle: TegakiBundle): Promise<void> {
  await ensureFont(bundle.family, bundle.fontUrl);
}

function ensureFont(family: string, url: string): Promise<void> | null {
  if (typeof document === 'undefined') return Promise.resolve();
  for (const face of document.fonts) {
    if (face.family === family) {
      if (face.status === 'loaded') return null;
      if (face.status === 'loading') return face.loaded.then(() => {});
    }
  }
  let cached = fontFaceCache.get(url);
  if (!cached) {
    cached = new FontFace(family, `url(${url})`, { featureSettings: "'calt' 0, 'liga' 0" }).load().then((loaded) => {
      document.fonts.add(loaded);
    });
    fontFaceCache.set(url, cached);
  }
  return cached;
}

const PADDING_H_EM = 0.2;
const MIN_LINE_HEIGHT_EM = 1.8;
const MIN_PADDING_V_EM = 0.2;

// --- CSS custom property names ---

const CSS_TIME = '--tegaki-time';
const CSS_PROGRESS = '--tegaki-progress';
const CSS_DURATION = '--tegaki-duration';

// Register custom properties so they are animatable (typed as <number>).
// Deferred to first mount to avoid running at import time during SSR.
let cssPropertiesRegistered = false;
function registerCssProperties() {
  if (cssPropertiesRegistered) return;
  cssPropertiesRegistered = true;
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    for (const prop of [CSS_TIME, CSS_PROGRESS, CSS_DURATION]) {
      try {
        CSS.registerProperty({ name: prop, syntax: '<number>', inherits: true, initialValue: '0' });
      } catch {
        // Already registered — ignore.
      }
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

/** Imperative handle exposed via the `ref` prop. */
export interface TegakiRendererHandle {
  /** The root DOM element. */
  getElement(): HTMLDivElement | null;
  /** Current animation time in seconds. */
  getCurrentTime(): number;
  /** Total timeline duration in seconds. */
  getDuration(): number;
  /** Whether the animation is currently playing (uncontrolled mode only). */
  getIsPlaying(): boolean;
  /** Whether the animation has reached the end. */
  getIsComplete(): boolean;
  /** Resume playback (uncontrolled mode only). No-op in controlled/css mode. */
  play(): void;
  /** Pause playback (uncontrolled mode only). No-op in controlled/css mode. */
  pause(): void;
  /** Jump to a specific time in seconds (uncontrolled mode only). No-op in controlled/css mode. */
  seek(time: number): void;
  /** Seek to 0 and play (uncontrolled mode only). No-op in controlled/css mode. */
  restart(): void;
}

export interface TegakiRendererProps<E extends TegakiEffects<E> = Record<string, never>>
  extends Omit<ComponentProps<'div'>, 'children' | 'ref'> {
  /** Imperative handle ref for playback controls and DOM access. */
  ref?: Ref<TegakiRendererHandle>;

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
  ref,
  font,
  text,
  children,
  time: timeProp,
  onComplete,
  effects,
  segmentSize,
  timing,
  showOverlay,
  ...props
}: TegakiRendererProps<E>) {
  registerCssProperties();

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
  const propPlaying = timeControl.mode === 'uncontrolled' ? (timeControl.playing ?? true) : false;
  const loop = timeControl.mode === 'uncontrolled' ? (timeControl.loop ?? false) : false;
  const catchUp = timeControl.mode === 'uncontrolled' ? (timeControl.catchUp ?? 0) : 0;
  const onTimeChange = timeControl.mode === 'uncontrolled' ? timeControl.onTimeChange : undefined;

  // Imperative playing override (undefined = follow prop)
  const [playingOverride, setPlayingOverride] = useState<boolean | undefined>(undefined);
  const playing = playingOverride ?? propPlaying;

  // Reset override when the prop changes so the prop regains control
  const prevPropPlaying = useRef(propPlaying);
  if (prevPropPlaying.current !== propPlaying) {
    prevPropPlaying.current = propPlaying;
    setPlayingOverride(undefined);
  }

  // --- Internal time (uncontrolled mode) ---
  const [internalTime, setInternalTime] = useState(defaultTime);
  // --- CSS-driven time ---
  const [cssTime, setCssTime] = useState(0);
  const currentTime = isCss ? cssTime : isControlled ? controlledTime! : internalTime;

  // Stable refs so the imperative handle and rAF loop always see latest values
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const onTimeChangeRef = useRef(onTimeChange);
  onTimeChangeRef.current = onTimeChange;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // --- Font loading ---
  // Track which font object has been loaded, so fontReady resets synchronously
  // when the font prop changes (no stale `true` from the previous font).
  const [loadedFont, setLoadedFont] = useState<TegakiBundle | null>(() =>
    font && ensureFont(font.family, font.fontUrl) === null ? font : null,
  );
  const fontReady = !!font && loadedFont === font;

  useEffect(() => {
    if (!font) {
      setLoadedFont(null);
      return;
    }
    const pending = ensureFont(font.family, font.fontUrl);
    if (pending === null) {
      setLoadedFont(font);
      return;
    }
    let cancelled = false;
    pending.then(() => {
      if (!cancelled) setLoadedFont(font);
    });
    return () => {
      cancelled = true;
    };
  }, [font]);

  // --- Font-derived constants ---
  const fontFamily = font?.family;
  const emHeight = font ? (font.ascender - font.descender) / font.unitsPerEm : 0;

  // --- Container measurement ---
  const rootRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [fontSize, setFontSize] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);
  const [currentColor, setCurrentColor] = useState('');

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

  // --- Imperative handle (stable — reads from refs) ---
  useImperativeHandle(
    ref,
    () => ({
      getElement: () => rootRef.current,
      getCurrentTime: () => currentTimeRef.current,
      getDuration: () => totalDurationRef.current,
      getIsPlaying: () => playingRef.current,
      getIsComplete: () => totalDurationRef.current > 0 && currentTimeRef.current >= totalDurationRef.current,
      play: () => {
        if (!isControlledRef.current) setPlayingOverride(true);
      },
      pause: () => {
        if (!isControlledRef.current) setPlayingOverride(false);
      },
      seek: (time: number) => {
        if (!isControlledRef.current) setInternalTime(Math.max(0, Math.min(time, totalDurationRef.current)));
      },
      restart: () => {
        if (!isControlledRef.current) {
          setInternalTime(0);
          setPlayingOverride(true);
        }
      },
    }),
    [],
  );

  // --- Uncontrolled: time change notification ---
  useEffect(() => {
    if (!isControlled) {
      onTimeChangeRef.current?.(internalTime);
    }
  }, [internalTime, isControlled]);

  // --- Reduced motion preference ---
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // When reduced motion is preferred, skip to end of timeline
  useEffect(() => {
    if (prefersReducedMotion && !isControlled && timeline.totalDuration > 0) {
      setInternalTime(timeline.totalDuration);
    }
  }, [prefersReducedMotion, isControlled, timeline.totalDuration]);

  // --- Uncontrolled: rAF playback loop ---
  useEffect(() => {
    if (isControlled || !playing || !font || !fontReady || prefersReducedMotion) return;

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
  }, [isControlled, playing, speed, loop, catchUp, font, fontReady, prefersReducedMotion]);

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
        setCurrentColor(styles.color);
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
      if (e.propertyName === 'color') {
        setCurrentColor(styles.color);
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
    if (!fontReady || !fontFamily || !fontSize || !containerWidth || !resolvedText) return null;
    return computeTextLayout(resolvedText, fontFamily, fontSize, lineHeight, containerWidth);
  }, [fontReady, resolvedText, fontFamily, fontSize, lineHeight, containerWidth]);

  // --- Canvas padding ---
  const padH = PADDING_H_EM * fontSize;
  const padV = fontSize ? Math.max(MIN_PADDING_V_EM * fontSize, (MIN_LINE_HEIGHT_EM * fontSize - lineHeight) / 2) : 0;

  // --- Canvas rendering ---
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
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

    const color = currentColor || getComputedStyle(el).color;

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

        if (glyph && entry.hasGlyph) {
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
        } else if (!entry.hasGlyph && currentTime >= entry.offset + entry.duration) {
          const baseline = y + halfLeading + (font.ascender / font.unitsPerEm) * fontSize;
          drawFallbackGlyph(ctx, char, x, baseline, fontSize, fontFamily!, color, resolvedEffects, seed + charIdx);
        }

        x += (charWidth + kerning) * fontSize;
      }
      y += lineHeight;
    }
  }, [
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
    currentColor,
    resolvedEffects,
    seed,
    segmentSize,
  ]);

  // --- Rendering ---

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
      <div style={{ position: 'relative' }}>
        {/* Sentinel: inherits font-size & line-height; its height changes when either changes */}
        <span
          ref={sentinelRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            visibility: 'hidden',
            transition: isCss
              ? `font-size 0.001s, line-height 0.001s, color 0.001s, ${CSS_PROGRESS} 0.001s`
              : 'font-size 0.001s, line-height 0.001s, color 0.001s',
          }}
        >
          {'\u00A0'}
        </span>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: `${-padV}px ${-padH}px`,
            width: `calc(100% + ${padH * 2}px)`,
            height: `calc(100% + ${padV * 2}px)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            userSelect: 'auto',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            paddingRight: 1,
            WebkitTextFillColor: showOverlay ? undefined : 'transparent',
            fontFamily,
            color: showOverlay ? 'rgba(255, 0, 0, 0.4)' : undefined,
          }}
        >
          {resolvedText}
        </div>
      </div>
    </div>
  );
}
