import {
  CSS_DURATION,
  CSS_PROGRESS,
  CSS_TIME,
  MIN_LINE_HEIGHT_EM,
  MIN_PADDING_V_EM,
  PADDING_H_EM,
  registerCssProperties,
} from '../lib/css-properties.ts';
import { drawFallbackGlyph } from '../lib/drawFallbackGlyph.ts';
import { drawGlyph } from '../lib/drawGlyph.ts';
import { type ResolvedEffect, resolveEffects } from '../lib/effects.ts';
import { ensureFont } from '../lib/font.ts';
import type { TextLayout } from '../lib/textLayout.ts';
import { computeTextLayout } from '../lib/textLayout.ts';
import type { Timeline, TimelineConfig, TimelineEntry } from '../lib/timeline.ts';
import { computeTimeline } from '../lib/timeline.ts';
import { graphemes } from '../lib/utils.ts';
import type { TegakiBundle, TegakiEffects } from '../types.ts';

// ---------------------------------------------------------------------------
// Time control types (shared with adapters)
// ---------------------------------------------------------------------------

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
     * Delay before the animation starts (seconds). Applied once on
     * initialization and again on {@link TegakiEngine.restart}. Default: `0`
     */
    delay?: number;
    /**
     * Pause between loop iterations (seconds). Only effective when
     * `loop` is `true`. Default: `0`
     */
    loopGap?: number;
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

// ---------------------------------------------------------------------------
// Engine options
// ---------------------------------------------------------------------------

export interface TegakiEngineOptions {
  text?: string;
  /** A font bundle, or a registered bundle name (see {@link TegakiEngine.registerBundle}). */
  font?: TegakiBundle | string;
  time?: TimeControlProp;
  effects?: TegakiEffects<Record<string, any>>;
  timing?: TimelineConfig;
  segmentSize?: number;
  showOverlay?: boolean;
  onComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Render elements
// ---------------------------------------------------------------------------

export type CreateElementFn<T> = (tag: string, props: Record<string, any>, ...children: (T | string)[]) => T;

const PAD_V_CSS = 'max(0.2em, 0.9em - 0.5lh)';

function buildRootProps(options: TegakiEngineOptions): Record<string, any> {
  const text = options.text ?? '';
  const font = resolveBundle(options.font);
  const fontFamily = font?.family;

  const duration = text && font ? computeTimeline(text, font, options.timing).totalDuration : 0;
  const time =
    typeof options.time === 'number'
      ? options.time
      : typeof options.time === 'object' && options.time?.mode === 'controlled'
        ? options.time.value
        : typeof options.time === 'object' && options.time?.mode === 'uncontrolled'
          ? (options.time.initialTime ?? 0)
          : 0;
  const progress = duration > 0 ? time / duration : 0;

  return {
    'data-tegaki': 'root',
    style: {
      position: 'relative',
      maxWidth: '100%',
      width: 'auto',
      height: 'auto',
      fontFamily: fontFamily ?? undefined,
      [CSS_DURATION]: duration,
      [CSS_TIME]: time,
      [CSS_PROGRESS]: progress,
    },
  };
}

function buildChildren<T>(options: TegakiEngineOptions, h: CreateElementFn<T>): T {
  const text = options.text ?? '';
  const isCss = options.time === 'css' || (typeof options.time === 'object' && options.time?.mode === 'css');
  const showOverlay = options.showOverlay;

  return h(
    'span',
    { style: { display: 'block', position: 'relative' } },
    h('span', {
      'data-tegaki': 'sentinel',
      'aria-hidden': 'true',
      style: {
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
      },
    }),
    h(
      'canvas',
      {
        'data-tegaki': 'canvas',
        'aria-hidden': 'true',
        style: {
          position: 'absolute',
          inset: `calc(-1 * ${PAD_V_CSS}) -0.2em`,
          width: 'calc(100% + 0.4em)',
          height: `calc(100% + 2 * ${PAD_V_CSS})`,
          pointerEvents: 'none',
          overflow: 'visible',
        },
      },
      h(
        'span',
        {
          'data-tegaki': 'canvas-fallback',
          style: { display: 'inline-block', padding: `${PAD_V_CSS} 0.2em` },
        },
        text,
      ),
    ),
    h(
      'span',
      {
        'data-tegaki': 'overlay',
        style: {
          display: 'block',
          userSelect: 'auto',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
          paddingRight: 1,
          WebkitTextFillColor: showOverlay ? undefined : 'transparent',
          color: showOverlay ? 'rgba(255, 0, 0, 0.4)' : undefined,
        },
      },
      text,
    ),
  );
}

// ---------------------------------------------------------------------------
// DOM createElement helper (for vanilla JS constructor)
// ---------------------------------------------------------------------------

function domCreateElement(tag: string, props: Record<string, any>, ...children: (HTMLElement | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'style' && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, any>)) {
        if (v !== undefined && v !== null) {
          if (k.startsWith('--')) {
            el.style.setProperty(k, String(v));
          } else {
            (el.style as any)[k] = typeof v === 'number' && k !== 'opacity' && k !== 'zIndex' ? `${v}px` : v;
          }
        }
      }
    } else if (key === 'aria-hidden') {
      el.setAttribute('aria-hidden', String(value));
    } else if (key.startsWith('data-')) {
      el.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTimeControl(prop: TimeControlProp): TimeControlMode[keyof TimeControlMode] {
  if (prop == null) return { mode: 'uncontrolled' };
  if (typeof prop === 'number') return { mode: 'controlled', value: prop };
  if (prop === 'css') return { mode: 'css' };
  return prop;
}

// ---------------------------------------------------------------------------
// TegakiEngine
// ---------------------------------------------------------------------------

function resolveBundle(font: TegakiBundle | string | undefined): TegakiBundle | undefined {
  if (typeof font === 'string') {
    const bundle = TegakiEngine.getBundle(font);
    if (!bundle) throw new Error(`TegakiEngine: no bundle registered for "${font}". Call TegakiEngine.registerBundle() first.`);
    return bundle;
  }
  return font;
}

export class TegakiEngine {
  // --- Bundle registry ---
  private static _bundles = new Map<string, TegakiBundle>();

  /** Register a font bundle so it can be referenced by family name. */
  static registerBundle(bundle: TegakiBundle): void {
    TegakiEngine._bundles.set(bundle.family, bundle);
  }

  /** Look up a registered bundle by family name. */
  static getBundle(family: string): TegakiBundle | undefined {
    return TegakiEngine._bundles.get(family);
  }

  // --- DOM elements ---
  private _rootEl: HTMLElement;
  private _contentEl: HTMLElement | null = null; // non-null only in non-adopt mode
  private _sentinelEl: HTMLSpanElement;
  private _canvasEl: HTMLCanvasElement;
  private _overlayEl: HTMLElement;
  private _canvasFallbackEl: HTMLSpanElement;

  // --- Options ---
  private _text = '';
  private _font: TegakiBundle | null = null;
  private _timeControl: TimeControlMode[keyof TimeControlMode] = { mode: 'uncontrolled' };
  private _effects: Record<string, any> | undefined;
  private _timing: TimelineConfig | undefined;
  private _segmentSize: number | undefined;
  private _showOverlay = false;
  private _onComplete: (() => void) | undefined;

  // --- Derived / cached ---
  private _resolvedEffects: ResolvedEffect[] = resolveEffects(undefined);
  private _seed: number;
  private _timeline: Timeline = { entries: [] as TimelineEntry[], totalDuration: 0 };
  private _layout: TextLayout | null = null;
  private _fontReady = false;

  // --- Measured from DOM ---
  private _containerWidth = 0;
  private _fontSize = 0;
  private _lineHeight = 0;
  private _currentColor = '';

  // --- Playback state ---
  private _internalTime = 0;
  private _cssTime = 0;
  private _playing = true;
  private _smoothedBoost = 0;
  private _delayRemaining = 0;
  private _loopGapRemaining = 0;
  private _lastTs: number | null = null;
  private _rafId = 0;
  private _prevCompleted = false;
  private _prefersReducedMotion = false;
  private _destroyed = false;

  // --- Observers & listeners ---
  private _resizeObserver: ResizeObserver;
  private _mql: MediaQueryList | null = null;

  /**
   * Returns the props (including style) that should be applied to the container element,
   * plus the inner content tree rendered via a framework `createElement` callback.
   *
   * Each child element receives a `data-tegaki` attribute so the engine can adopt
   * pre-rendered elements later via `new TegakiEngine(container, { adopt: true })`.
   */
  static renderElements<T>(
    options: TegakiEngineOptions,
    createElement: CreateElementFn<T>,
  ): { rootProps: Record<string, any>; content: T } {
    return {
      rootProps: buildRootProps(options),
      content: buildChildren(options, createElement),
    };
  }

  constructor(container: HTMLElement, options?: TegakiEngineOptions & { adopt?: boolean }) {
    registerCssProperties();
    this._seed = Math.random() * 1000;

    // --- Resolve DOM elements ---
    // The container itself is the root element. In adopt mode, the adapter has
    // already rendered children inside it. In non-adopt mode, we create them.
    this._rootEl = container;

    if (options?.adopt) {
      // Adopt pre-rendered children (created by renderElements)
    } else {
      // Create DOM from scratch
      const content = buildChildren(options ?? {}, domCreateElement);
      container.appendChild(content);
      this._contentEl = content;
      // Apply root styles to the container
      const rootProps = buildRootProps(options ?? {});
      for (const [key, value] of Object.entries(rootProps.style as Record<string, any>)) {
        if (value !== undefined && value !== null) {
          if (key.startsWith('--')) {
            container.style.setProperty(key, String(value));
          } else {
            (container.style as any)[key] = typeof value === 'number' && key !== 'opacity' && key !== 'zIndex' ? `${value}px` : value;
          }
        }
      }
      container.dataset.tegaki = 'root';
    }

    this._sentinelEl = container.querySelector('[data-tegaki="sentinel"]') as HTMLSpanElement;
    this._canvasEl = container.querySelector('[data-tegaki="canvas"]') as HTMLCanvasElement;
    this._canvasFallbackEl = container.querySelector('[data-tegaki="canvas-fallback"]') as HTMLSpanElement;
    this._overlayEl = container.querySelector('[data-tegaki="overlay"]') as HTMLElement;

    // --- ResizeObserver ---
    this._resizeObserver = new ResizeObserver(this._onResize);
    this._resizeObserver.observe(this._rootEl);

    // --- Sentinel transitions ---
    this._sentinelEl.addEventListener('transitionend', this._onSentinelTransition);

    // --- Reduced motion ---
    if (typeof window !== 'undefined') {
      this._mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      this._prefersReducedMotion = this._mql.matches;
      this._mql.addEventListener('change', this._onReducedMotionChange);
    }

    // --- Initial measurement (must run before update so layout has valid dimensions) ---
    this._measure();

    // --- Apply initial options ---
    if (options) this.update(options);
  }

  // =========================================================================
  // Public API
  // =========================================================================

  get currentTime(): number {
    const tc = this._timeControl;
    if (tc.mode === 'css') return this._cssTime;
    if (tc.mode === 'controlled') return tc.value;
    return this._internalTime;
  }

  get duration(): number {
    return this._timeline.totalDuration;
  }

  get isPlaying(): boolean {
    return this._playing;
  }

  get isComplete(): boolean {
    return this._timeline.totalDuration > 0 && this.currentTime >= this._timeline.totalDuration;
  }

  get element(): HTMLElement {
    return this._rootEl;
  }

  play(): void {
    if (this._timeControl.mode !== 'uncontrolled') return;
    this._playing = true;
    this._evaluatePlayback();
  }

  pause(): void {
    if (this._timeControl.mode !== 'uncontrolled') return;
    this._playing = false;
    this._evaluatePlayback();
  }

  seek(time: number): void {
    if (this._timeControl.mode !== 'uncontrolled') return;
    this._internalTime = Math.max(0, Math.min(time, this._timeline.totalDuration));
    this._delayRemaining = 0;
    this._loopGapRemaining = 0;
    this._checkCompletion();
    this._notifyTimeChange();
    this._render();
    this._updateCssProperties();
  }

  restart(): void {
    if (this._timeControl.mode !== 'uncontrolled') return;
    this._internalTime = 0;
    this._playing = true;
    this._prevCompleted = false;
    this._delayRemaining = this._timeControl.delay ?? 0;
    this._loopGapRemaining = 0;
    this._notifyTimeChange();
    this._evaluatePlayback();
  }

  update(options: Partial<TegakiEngineOptions>): void {
    if (this._destroyed) return;

    let dirtyTimeline = false;
    let dirtyLayout = false;
    let dirtyRender = false;
    let dirtyPlayback = false;

    if ('text' in options && options.text !== this._text) {
      this._text = options.text ?? '';
      dirtyTimeline = true;
      dirtyLayout = true;
    }

    if ('font' in options) {
      const resolved = resolveBundle(options.font) ?? null;
      if (resolved !== this._font) {
        this._loadFont(resolved);
        dirtyTimeline = true;
        dirtyLayout = true;
        dirtyPlayback = true;
      }
    }

    if ('time' in options) {
      const newTc = resolveTimeControl(options.time);
      const oldTc = this._timeControl;

      // Detect meaningful changes
      const modeChanged = newTc.mode !== oldTc.mode;
      const controlledValueChanged = newTc.mode === 'controlled' && oldTc.mode === 'controlled' && newTc.value !== oldTc.value;
      const uncontrolledChanged =
        newTc.mode === 'uncontrolled' &&
        oldTc.mode === 'uncontrolled' &&
        (newTc.speed !== oldTc.speed ||
          newTc.playing !== oldTc.playing ||
          newTc.loop !== oldTc.loop ||
          newTc.delay !== oldTc.delay ||
          newTc.loopGap !== oldTc.loopGap ||
          newTc.catchUp !== oldTc.catchUp);

      if (modeChanged || controlledValueChanged || uncontrolledChanged) {
        this._timeControl = newTc;

        if (newTc.mode === 'uncontrolled') {
          this._playing = newTc.playing ?? true;
          const oldDelay = oldTc.mode === 'uncontrolled' ? (oldTc.delay ?? 0) : 0;
          const newDelay = newTc.delay ?? 0;
          if (modeChanged || oldDelay !== newDelay) {
            this._delayRemaining = newDelay;
            this._loopGapRemaining = 0;
          }
        }

        dirtyPlayback = true;
        dirtyRender = true;

        // Update sentinel transition for css mode
        this._updateSentinelTransition();
      }
    }

    if ('effects' in options && options.effects !== this._effects) {
      this._effects = options.effects as Record<string, any>;
      this._resolvedEffects = resolveEffects(this._effects);
      dirtyRender = true;
    }

    if ('timing' in options && options.timing !== this._timing) {
      this._timing = options.timing;
      dirtyTimeline = true;
    }

    if ('segmentSize' in options && options.segmentSize !== this._segmentSize) {
      this._segmentSize = options.segmentSize;
      dirtyRender = true;
    }

    if ('showOverlay' in options && options.showOverlay !== this._showOverlay) {
      this._showOverlay = options.showOverlay ?? false;
      this._updateOverlayStyle();
      dirtyRender = true;
    }

    if ('onComplete' in options) {
      this._onComplete = options.onComplete;
    }

    // --- Recompute ---
    if (dirtyTimeline) this._recomputeTimeline();
    if (dirtyLayout) this._recomputeLayout();
    if (dirtyPlayback) this._evaluatePlayback();
    if (dirtyRender || dirtyTimeline || dirtyLayout) {
      this._updateDom();
      this._render();
    }
  }

  destroy(): void {
    this._destroyed = true;
    this._stopLoop();
    this._resizeObserver.disconnect();
    this._sentinelEl.removeEventListener('transitionend', this._onSentinelTransition);
    this._mql?.removeEventListener('change', this._onReducedMotionChange);
    // Only remove content we created (non-adopt mode). The container is owned by the caller.
    this._contentEl?.remove();
  }

  // =========================================================================
  // Internal: DOM updates
  // =========================================================================

  /** Estimate line-height from font metrics when CSS returns "normal". */
  private _fallbackLineHeight(fontSize: number): number {
    if (this._font) {
      return ((this._font.ascender - this._font.descender) / this._font.unitsPerEm) * fontSize;
    }
    return fontSize * 1.2;
  }

  private _measure(): void {
    const styles = getComputedStyle(this._rootEl);
    this._containerWidth = this._rootEl.getBoundingClientRect().width;
    this._fontSize = Number.parseFloat(styles.fontSize);
    const parsedLh = Number.parseFloat(styles.lineHeight);
    this._lineHeight = Number.isNaN(parsedLh) ? this._fallbackLineHeight(this._fontSize) : parsedLh;
    this._currentColor = styles.color;
  }

  private _updateDom(): void {
    // Font family
    this._rootEl.style.fontFamily = this._font?.family ?? '';

    // CSS custom properties
    this._updateCssProperties();

    // Overlay text (guard to preserve cursor position when contentEditable)
    if (this._overlayEl.textContent !== this._text) {
      this._overlayEl.textContent = this._text;
    }
    this._canvasFallbackEl.textContent = this._text;
  }

  private _updateCssProperties(): void {
    const time = this.currentTime;
    const dur = this._timeline.totalDuration;
    this._rootEl.style.setProperty(CSS_DURATION, String(dur));
    this._rootEl.style.setProperty(CSS_TIME, String(time));
    this._rootEl.style.setProperty(CSS_PROGRESS, String(dur > 0 ? time / dur : 0));
  }

  private _updateOverlayStyle(): void {
    if (this._showOverlay) {
      this._overlayEl.style.webkitTextFillColor = '';
      this._overlayEl.style.color = 'rgba(255, 0, 0, 0.4)';
    } else {
      this._overlayEl.style.webkitTextFillColor = 'transparent';
      this._overlayEl.style.color = '';
    }
  }

  private _updateSentinelTransition(): void {
    const isCss = this._timeControl.mode === 'css';
    this._sentinelEl.style.transition = isCss
      ? `font-size 0.001s, line-height 0.001s, color 0.001s, ${CSS_PROGRESS} 0.001s`
      : 'font-size 0.001s, line-height 0.001s, color 0.001s';
  }

  // =========================================================================
  // Internal: Resize & sentinel observers
  // =========================================================================

  private _onResize = (entries: ResizeObserverEntry[]): void => {
    const entry = entries[0];
    if (!entry) return;
    const newWidth = entry.contentRect.width;
    const styles = getComputedStyle(this._rootEl);
    const newFontSize = Number.parseFloat(styles.fontSize);
    const parsedLh = Number.parseFloat(styles.lineHeight);
    const newLineHeight = Number.isNaN(parsedLh) ? this._fallbackLineHeight(newFontSize) : parsedLh;
    const newColor = styles.color;

    let changed = false;
    let layoutChanged = false;

    if (newWidth !== this._containerWidth) {
      this._containerWidth = newWidth;
      layoutChanged = true;
      changed = true;
    }
    if (newFontSize !== this._fontSize) {
      this._fontSize = newFontSize;
      layoutChanged = true;
      changed = true;
    }
    if (newLineHeight !== this._lineHeight) {
      this._lineHeight = newLineHeight;
      layoutChanged = true;
      changed = true;
    }
    if (newColor !== this._currentColor) {
      this._currentColor = newColor;
      changed = true;
    }

    if (layoutChanged) this._recomputeLayout();
    if (changed) this._render();
  };

  private _onSentinelTransition = (e: TransitionEvent): void => {
    const styles = getComputedStyle(this._sentinelEl);
    let changed = false;

    if (e.propertyName === 'font-size' || e.propertyName === 'line-height') {
      const newFontSize = Number.parseFloat(styles.fontSize);
      const parsedLh = Number.parseFloat(styles.lineHeight);
      const newLineHeight = Number.isNaN(parsedLh) ? this._fallbackLineHeight(newFontSize) : parsedLh;
      if (newFontSize !== this._fontSize || newLineHeight !== this._lineHeight) {
        this._fontSize = newFontSize;
        this._lineHeight = newLineHeight;
        this._recomputeLayout();
        changed = true;
      }
    }

    if (e.propertyName === 'color') {
      const newColor = styles.color;
      if (newColor !== this._currentColor) {
        this._currentColor = newColor;
        changed = true;
      }
    }

    if (e.propertyName === CSS_PROGRESS) {
      const rawProgress = Number(styles.getPropertyValue(CSS_PROGRESS));
      this._cssTime = rawProgress * this._timeline.totalDuration;
      changed = true;
    }

    if (changed) this._render();
  };

  // =========================================================================
  // Internal: Reduced motion
  // =========================================================================

  private _onReducedMotionChange = (e: MediaQueryListEvent): void => {
    this._prefersReducedMotion = e.matches;
    if (this._prefersReducedMotion && this._timeControl.mode === 'uncontrolled' && this._timeline.totalDuration > 0) {
      this._internalTime = this._timeline.totalDuration;
    }
    this._evaluatePlayback();
    this._render();
  };

  // =========================================================================
  // Internal: Font loading
  // =========================================================================

  private _loadFont(font: TegakiBundle | null): void {
    this._font = font;
    this._fontReady = false;

    if (!font) return;

    const pending = ensureFont(font.family, font.fontUrl);
    if (pending === null) {
      this._fontReady = true;
      return;
    }

    const currentFont = font;
    pending.then(() => {
      if (this._font === currentFont && !this._destroyed) {
        this._fontReady = true;
        this._recomputeTimeline();
        this._recomputeLayout();
        this._evaluatePlayback();
        this._updateDom();
        this._render();
      }
    });
  }

  // =========================================================================
  // Internal: Recomputation
  // =========================================================================

  private _recomputeTimeline(): void {
    if (this._font && this._text) {
      this._timeline = computeTimeline(this._text, this._font, this._timing);
    } else {
      this._timeline = { entries: [] as TimelineEntry[], totalDuration: 0 };
    }
  }

  private _recomputeLayout(): void {
    const fontFamily = this._font?.family;
    if (this._fontReady && fontFamily && this._fontSize && this._containerWidth && this._text) {
      this._layout = computeTextLayout(this._text, fontFamily, this._fontSize, this._lineHeight, this._containerWidth);
    } else {
      this._layout = null;
    }
  }

  // =========================================================================
  // Internal: Playback loop
  // =========================================================================

  private _evaluatePlayback(): void {
    const tc = this._timeControl;
    const shouldRun = tc.mode === 'uncontrolled' && this._playing && !!this._font && this._fontReady && !this._prefersReducedMotion;

    if (shouldRun) {
      this._startLoop();
    } else {
      this._stopLoop();
    }
  }

  private _startLoop(): void {
    if (this._rafId) return;
    this._lastTs = null;
    this._smoothedBoost = 0;
    this._rafId = requestAnimationFrame(this._tick);
  }

  private _stopLoop(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  private _tick = (ts: number): void => {
    if (this._destroyed) return;

    if (this._lastTs === null) this._lastTs = ts;
    const dtSec = (ts - this._lastTs) / 1000;
    this._lastTs = ts;

    const tc = this._timeControl;
    if (tc.mode !== 'uncontrolled') return;

    const speed = tc.speed ?? 1;
    const loop = tc.loop ?? false;
    const catchUp = tc.catchUp ?? 0;
    const totalDur = this._timeline.totalDuration;

    if (totalDur === 0 || (!loop && this._internalTime >= totalDur)) {
      this._internalTime = totalDur;
      this._rafId = requestAnimationFrame(this._tick);
      return;
    }

    // --- Initial delay ---
    if (this._delayRemaining > 0) {
      this._delayRemaining = Math.max(0, this._delayRemaining - dtSec);
      this._rafId = requestAnimationFrame(this._tick);
      return;
    }

    // --- Loop gap (waiting between iterations) ---
    if (this._loopGapRemaining > 0) {
      this._loopGapRemaining = Math.max(0, this._loopGapRemaining - dtSec);
      if (this._loopGapRemaining <= 0) {
        this._internalTime = 0;
        this._prevCompleted = false;
        this._smoothedBoost = 0;
      }
      this._notifyTimeChange();
      this._render();
      this._updateCssProperties();
      this._rafId = requestAnimationFrame(this._tick);
      return;
    }

    // Compute effective speed with catch-up
    let effectiveSpeed = speed;
    if (catchUp > 0) {
      const remaining = Math.max(0, totalDur - this._internalTime);
      const excess = Math.max(0, remaining - 2);
      const targetBoost = catchUp * excess;
      const attackRate = 4;
      const releaseRate = loop ? 30 : 2;
      const rate = targetBoost > this._smoothedBoost ? attackRate : releaseRate;
      this._smoothedBoost += (targetBoost - this._smoothedBoost) * (1 - Math.exp(-rate * dtSec));
      effectiveSpeed = speed + this._smoothedBoost;
    }

    let next = this._internalTime + dtSec * effectiveSpeed;
    if (next >= totalDur) {
      if (loop) {
        const loopGap = tc.loopGap ?? 0;
        if (loopGap > 0) {
          // Hold at the end and start the loop gap countdown
          next = totalDur;
          this._loopGapRemaining = loopGap;
        } else {
          next = next % totalDur;
        }
      } else {
        next = totalDur;
      }
      this._smoothedBoost = 0;
    }
    this._internalTime = next;

    this._notifyTimeChange();
    this._checkCompletion();
    this._render();
    this._updateCssProperties();

    this._rafId = requestAnimationFrame(this._tick);
  };

  private _notifyTimeChange(): void {
    const tc = this._timeControl;
    if (tc.mode === 'uncontrolled' && tc.onTimeChange) {
      tc.onTimeChange(this._internalTime);
    }
  }

  private _checkCompletion(): void {
    const complete = this._timeline.totalDuration > 0 && this.currentTime >= this._timeline.totalDuration;
    if (complete && !this._prevCompleted) {
      this._prevCompleted = true;
      this._onComplete?.();
    } else if (!complete) {
      this._prevCompleted = false;
    }
  }

  // =========================================================================
  // Internal: Canvas rendering
  // =========================================================================

  private _render(): void {
    const canvas = this._canvasEl;
    const font = this._font;
    const layout = this._layout;
    const fontSize = this._fontSize;

    if (!font?.glyphData || !layout || !fontSize) return;

    const dpr = window.devicePixelRatio || 1;
    const canvasRect = canvas.getBoundingClientRect();
    const w = canvasRect.width;
    const h = canvasRect.height;

    const needsResize = canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr);
    if (needsResize) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const padH = PADDING_H_EM * fontSize;
    const lineHeight = this._lineHeight;
    const padV = Math.max(MIN_PADDING_V_EM * fontSize, (MIN_LINE_HEIGHT_EM * fontSize - lineHeight) / 2);
    ctx.translate(padH, padV);

    const color = this._currentColor || 'black';
    const emHeight = (font.ascender - font.descender) / font.unitsPerEm;
    const emHeightPx = emHeight * fontSize;
    const halfLeading = (lineHeight - emHeightPx) / 2;
    const characters = graphemes(this._text);
    const currentTime = this.currentTime;

    let y = 0;
    for (const lineIndices of layout.lines) {
      let x = 0;
      for (const charIdx of lineIndices) {
        const char = characters[charIdx]!;
        if (char === '\n') continue;
        const entry = this._timeline.entries[charIdx]!;
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
            this._resolvedEffects,
            this._seed + charIdx,
            this._segmentSize,
          );
        } else if (!entry.hasGlyph && currentTime >= entry.offset + entry.duration) {
          const baseline = y + halfLeading + (font.ascender / font.unitsPerEm) * fontSize;
          drawFallbackGlyph(ctx, char, x, baseline, fontSize, font.family, color, this._resolvedEffects, this._seed + charIdx);
        }

        x += (charWidth + kerning) * fontSize;
      }
      y += lineHeight;
    }
  }
}
