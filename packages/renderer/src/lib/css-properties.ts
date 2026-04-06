export const CSS_TIME = '--tegaki-time';
export const CSS_PROGRESS = '--tegaki-progress';
export const CSS_DURATION = '--tegaki-duration';

export const PADDING_H_EM = 0.2;
export const MIN_LINE_HEIGHT_EM = 1.8;
export const MIN_PADDING_V_EM = 0.2;

// Register custom properties so they are animatable (typed as <number>).
// Deferred to first use to avoid running at import time during SSR.
let cssPropertiesRegistered = false;
export function registerCssProperties() {
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
