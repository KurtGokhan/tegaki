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
    for (const name of ['glow', 'wobble', 'pressureWidth', 'taper', 'strokeGradient', 'globalGradient']) {
      expect(getEffectDefinition(name)).toBeDefined();
    }
  });

  test('returns undefined for unknown names', () => {
    expect(getEffectDefinition('sparkle')).toBeUndefined();
    // Prototype-pollution guard: inherited properties do not count as known effects.
    expect(getEffectDefinition('toString')).toBeUndefined();
    expect(getEffectDefinition('__proto__')).toBeUndefined();
  });

  test('per-stroke effects declare no render hooks', () => {
    for (const name of ['glow', 'wobble', 'pressureWidth', 'taper', 'strokeGradient']) {
      const def = getEffectDefinition(name);
      expect(def?.beforeRender).toBeUndefined();
      expect(def?.afterRender).toBeUndefined();
    }
  });

  test('globalGradient declares a beforeRender hook', () => {
    const def = getEffectDefinition('globalGradient');
    expect(typeof def?.beforeRender).toBe('function');
    expect(def?.afterRender).toBeUndefined();
  });
});

describe('hasRenderHooks', () => {
  test('false when no resolved effect declares a hook', () => {
    const resolved = resolveEffects({ glow: true, wobble: true });
    expect(hasRenderHooks(resolved)).toBe(false);
  });

  test('true when globalGradient is resolved', () => {
    const resolved = resolveEffects({ globalGradient: { colors: ['#000', '#fff'] } });
    expect(hasRenderHooks(resolved)).toBe(true);
  });

  test('false when effects list is empty', () => {
    expect(hasRenderHooks([])).toBe(false);
  });
});

describe('globalGradient beforeRender', () => {
  // Minimal fake ctx: records createLinearGradient args + collects color stops.
  // Only the methods the hook touches are implemented.
  function makeMockStage(bbox: { x: number; y: number; width: number; height: number }) {
    const stops: [number, string][] = [];
    const gradientCalls: number[][] = [];
    const fakeGradient = {
      addColorStop(offset: number, color: string) {
        stops.push([offset, color]);
      },
    };
    const ctx = {
      createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
        gradientCalls.push([x0, y0, x1, y1]);
        return fakeGradient;
      },
    } as unknown as CanvasRenderingContext2D;
    const stage = {
      ctx,
      layout: { lines: [], charOffsets: [], charWidths: [] },
      fontSize: 100,
      lineHeight: 120,
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      bbox,
      baseColor: '#000',
      seed: 0,
    } as any;
    return { stage, stops, gradientCalls, fakeGradient };
  }

  test('no-op when colors is missing or empty', () => {
    const { stage, gradientCalls } = makeMockStage({ x: 0, y: 0, width: 200, height: 100 });
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, {});
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, { colors: [] });
    expect(gradientCalls).toEqual([]);
    expect(stage.strokeStyle).toBeUndefined();
  });

  test('angle 0 (default) produces a horizontal gradient across bbox width', () => {
    const { stage, gradientCalls, stops, fakeGradient } = makeMockStage({ x: 0, y: 0, width: 200, height: 100 });
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, { colors: ['#f00', '#00f'] });
    // Gradient line spans the full width at y=center.
    expect(gradientCalls).toEqual([[0, 50, 200, 50]]);
    expect(stops).toEqual([
      [0, '#f00'],
      [1, '#00f'],
    ]);
    expect(stage.strokeStyle).toBe(fakeGradient);
  });

  test('angle 90 produces a vertical gradient across bbox height', () => {
    const { stage, gradientCalls } = makeMockStage({ x: 0, y: 0, width: 200, height: 100 });
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, { colors: ['#f00', '#00f'], angle: 90 });
    // Floating-point tolerance around sin(90°)·halfH = 50.
    const [x0, y0, x1, y1] = gradientCalls[0] as [number, number, number, number];
    expect(Math.abs(x0 - 100)).toBeLessThan(1e-6);
    expect(Math.abs(x1 - 100)).toBeLessThan(1e-6);
    expect(Math.abs(y0 - 0)).toBeLessThan(1e-6);
    expect(Math.abs(y1 - 100)).toBeLessThan(1e-6);
  });

  test('three-stop gradient places stops at 0, 0.5, 1', () => {
    const { stage, stops } = makeMockStage({ x: 0, y: 0, width: 300, height: 100 });
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, { colors: ['#f00', '#0f0', '#00f'] });
    expect(stops).toEqual([
      [0, '#f00'],
      [0.5, '#0f0'],
      [1, '#00f'],
    ]);
  });

  test('single color degenerate case emits that color at both endpoints', () => {
    const { stage, stops } = makeMockStage({ x: 0, y: 0, width: 100, height: 50 });
    getEffectDefinition('globalGradient')?.beforeRender?.(stage, { colors: ['#abc'] });
    expect(stops).toEqual([
      [0, '#abc'],
      [1, '#abc'],
    ]);
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
