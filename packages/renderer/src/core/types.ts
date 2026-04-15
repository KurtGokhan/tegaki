import type { TimelineConfig } from '../lib/timeline.ts';
import type { TegakiBundle, TegakiEffects } from '../types.ts';

// ---------------------------------------------------------------------------
// Time control types (shared with adapters)
// ---------------------------------------------------------------------------

/** Fields shared by both speed- and duration-paced uncontrolled modes. */
interface UncontrolledShared {
  mode: 'uncontrolled';
  /** Initial time in seconds. Default: `0` */
  initialTime?: number;
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
   * Easing function mapping linear progress `(0–1)` to displayed progress `(0–1)`.
   * Applied at read-time so `currentTime`, `onTimeChange`, and the CSS custom
   * properties all reflect the eased value. Completion is evaluated against
   * linear progress so curves that overshoot or undershoot the endpoints do
   * not trip completion early or late.
   */
  easing?: (t: number) => number;
  /** Called on every frame with the current (eased) time. */
  onTimeChange?: (time: number) => void;
}

export type TimeControlMode = {
  controlled: {
    mode: 'controlled';
    /** Current time in seconds (default), or progress 0–1 when `unit` is `'progress'`. */
    value: number;
    /** Interpret `value` as seconds (default) or as a 0–1 progress ratio. */
    unit?: 'seconds' | 'progress';
  };
  uncontrolled:
    | (UncontrolledShared & {
        /** Playback speed multiplier. Default: `1` */
        speed?: number;
        /**
         * Catch-up strength. When positive, playback speeds up when there is a
         * large amount of remaining animation and decays back to normal gradually.
         * `0` disables catch-up (default). Higher values ramp up more aggressively.
         * Typical range: `0.2` – `2`.
         */
        catchUp?: number;
        duration?: never;
      })
    | (UncontrolledShared & {
        /**
         * Stretch or compress playback so one iteration takes exactly this many
         * seconds. Mutually exclusive with `speed` / `catchUp`.
         */
        duration?: number;
        speed?: never;
        catchUp?: never;
      });
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
// Quality
// ---------------------------------------------------------------------------

/**
 * Render-quality knobs. These trade CPU/GPU cost for visual fidelity.
 * They do not change the style of the rendered text — see `effects` for that.
 */
export interface TegakiQuality {
  /**
   * Internal supersampling factor applied on top of `window.devicePixelRatio`.
   * Values > 1 draw into a larger backing canvas and let the browser downsample
   * to the displayed size, producing higher-quality antialiasing at a quadratic
   * cost in pixels filled. Values < 1 save cost at the expense of sharpness.
   * Default: `1`.
   */
  pixelRatio?: number;
  /**
   * Maximum drawn segment length (in font units) when stroke-varying effects
   * (`pressureWidth`, `taper`, `wobble`, `gradient`) are active. Smaller values
   * produce smoother transitions at the cost of more draw calls per stroke.
   * Defaults to `2` when such effects are on, otherwise segments are not subdivided.
   */
  segmentSize?: number;
}

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
  /** Render-quality knobs (supersampling, segment subdivision). */
  quality?: TegakiQuality;
  showOverlay?: boolean;
  onComplete?: () => void;
  /** Text direction. When set, applies the CSS `direction` property to the container. */
  direction?: 'ltr' | 'rtl';
}

// ---------------------------------------------------------------------------
// Render elements
// ---------------------------------------------------------------------------

export type CreateElementFn<T> = (tag: string, props: Record<string, any>, ...children: (T | string)[]) => T;
