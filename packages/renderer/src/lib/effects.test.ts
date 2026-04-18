import { describe, expect, test } from 'bun:test';
import { findEffect, getEffectDefinition, hasRenderHooks, resolveEffects } from './effects.ts';
import { computeLayoutBbox, type TextLayout } from './textLayout.ts';

describe('resolveEffects', () => {
  test('returns empty array when nothing is passed', () => {
    const resolved = resolveEffects({});
    // `pressureWidth` is in defaultEffects and auto-enabled.
    expect(resolved.map((e) => e.effect)).toEqual(['pressureWidth']);
  });

  test('known keys infer effect name', () => {
    const resolved = resolveEffects({ glow: { radius: 4 }, strokeGradient: { colors: ['#000'] } });
    expect(findEffect(resolved, 'glow')?.config).toEqual({ radius: 4 });
    expect(findEffect(resolved, 'strokeGradient')?.config).toEqual({ colors: ['#000'] });
  });

  test('custom keys require explicit effect field', () => {
    const resolved = resolveEffects({ outerGlow: { effect: 'glow', radius: 20 } });
    expect(resolved.find((e) => e.effect === 'glow')?.config).toEqual({ radius: 20 });
  });

  test('false / enabled:false entries are skipped', () => {
    const resolved = resolveEffects({ pressureWidth: false, glow: { enabled: false, radius: 5 } });
    expect(resolved).toEqual([]);
  });

  test('respects `order` for sort', () => {
    const resolved = resolveEffects({
      glow: { radius: 5, order: 2 },
      wobble: { amplitude: 1, order: 0 },
      pressureWidth: false,
    });
    expect(resolved.map((e) => e.effect)).toEqual(['wobble', 'glow']);
  });
});

describe('getEffectDefinition', () => {
  test('returns a definition object for every built-in effect', () => {
    for (const name of ['glow', 'wobble', 'pressureWidth', 'taper', 'strokeGradient']) {
      expect(getEffectDefinition(name)).toBeDefined();
    }
  });

  test('returns undefined for unknown names', () => {
    expect(getEffectDefinition('sparkle')).toBeUndefined();
    // Prototype-pollution guard: inherited properties do not count as known effects.
    expect(getEffectDefinition('toString')).toBeUndefined();
    expect(getEffectDefinition('__proto__')).toBeUndefined();
  });

  test('built-in effects currently declare no hooks (foundation placeholder)', () => {
    // Sanity check: the foundation ships without changing existing effect
    // behavior. If/when a built-in starts using hooks, update this test.
    for (const name of ['glow', 'wobble', 'pressureWidth', 'taper', 'strokeGradient']) {
      const def = getEffectDefinition(name);
      expect(def?.beforeRender).toBeUndefined();
      expect(def?.afterRender).toBeUndefined();
    }
  });
});

describe('hasRenderHooks', () => {
  test('false when no resolved effect declares a hook', () => {
    const resolved = resolveEffects({ glow: true, wobble: true });
    expect(hasRenderHooks(resolved)).toBe(false);
  });

  test('false when effects list is empty', () => {
    expect(hasRenderHooks([])).toBe(false);
  });
});

describe('computeLayoutBbox', () => {
  test('width is max (charOffset + charWidth) * fontSize; height is lines * lineHeight', () => {
    const layout: TextLayout = {
      lines: [
        [0, 1],
        [2, 3],
      ],
      charOffsets: [0, 0.5, 0, 0.8],
      charWidths: [0.5, 0.7, 0.5, 1.0],
    };
    const bbox = computeLayoutBbox(layout, 100, 120);
    expect(bbox).toEqual({ x: 0, y: 0, width: 180, height: 240 });
  });

  test('empty layout yields zero-size bbox', () => {
    expect(computeLayoutBbox({ lines: [], charOffsets: [], charWidths: [] }, 100, 120)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});
