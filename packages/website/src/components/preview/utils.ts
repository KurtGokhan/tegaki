import type { TegakiEffects } from 'tegaki';
import type { CustomEffect, EffectsState } from '../url-state.ts';

/** Scale (w, h) to fit within maxSize while preserving aspect ratio */
export function fitSize(w: number, h: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(maxSize / w, maxSize / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Compose the sparse effects object expected by TegakiRenderer from the URL-serialized state. */
export function buildEffects(effectsState: EffectsState, customEffects: CustomEffect[]): TegakiEffects<Record<string, any>> | undefined {
  const result: Record<string, any> = {};
  if (effectsState.glow.enabled) {
    const g: Record<string, any> = { radius: effectsState.glow.radius, color: effectsState.glow.color };
    if (effectsState.glow.offsetX) g.offsetX = effectsState.glow.offsetX;
    if (effectsState.glow.offsetY) g.offsetY = effectsState.glow.offsetY;
    result.glow = g;
  }
  if (effectsState.wobble.enabled) {
    result.wobble = {
      amplitude: effectsState.wobble.amplitude,
      frequency: effectsState.wobble.frequency,
      mode: effectsState.wobble.mode,
    };
  }
  if (effectsState.pressureWidth.enabled) result.pressureWidth = { strength: effectsState.pressureWidth.strength };
  if (effectsState.taper.enabled) result.taper = { startLength: effectsState.taper.startLength, endLength: effectsState.taper.endLength };
  if (effectsState.gradient.enabled) {
    const g: Record<string, any> = { colors: effectsState.gradient.colors };
    if (effectsState.gradient.colors === 'rainbow') {
      g.saturation = effectsState.gradient.saturation;
      g.lightness = effectsState.gradient.lightness;
    }
    result.gradient = g;
  }
  for (const custom of customEffects) {
    if (custom.enabled) result[custom.key] = { effect: custom.effect, ...custom.config };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
