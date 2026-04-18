import { describe, expectTypeOf, test } from 'bun:test';
import font from 'tegaki/fonts/tangerine';
import type { TegakiBundle, TegakiEffects } from './types.ts';

function assertType<const E extends TegakiEffects<E>>(_value: E) {}

describe.skip('TegakiEffects', () => {
  test('ensure font assignable', () => {
    expectTypeOf(font).toExtend<TegakiBundle>();
  });
});

describe.skip('TegakiEffects', () => {
  test('known key with config', () => {
    assertType({ glow: { radius: 5 } });
    assertType({ wobble: { amplitude: 2, frequency: 3 } });
    assertType({ strokeGradient: { colors: ['#ff0000', '#00ff00'] } });
    assertType({ strokeGradient: { colors: 'rainbow', saturation: 80 } });
    assertType({ taper: { startLength: 0.2, endLength: 0.1 } });
    assertType({ pressureWidth: {} });
  });

  test('known key with boolean shorthand', () => {
    assertType({ glow: true });
    assertType({ wobble: true });
    assertType({ taper: true });
    assertType({ strokeGradient: true });
  });

  test('known key with explicit effect field', () => {
    assertType({ glow: { effect: 'glow', radius: 10 } });
  });

  test('known key with order', () => {
    assertType({ glow: { radius: 5, order: 1 } });
  });

  test('custom key with explicit effect', () => {
    assertType({ outerGlow: { effect: 'glow', radius: 20 } });
    assertType({ innerGlow: { effect: 'glow', radius: 5, order: 1 } });
  });

  test('multiple effects combined', () => {
    assertType({
      glow: { radius: 20 },
      innerGlow: { effect: 'glow', radius: 5, order: 1 },
      wobble: true,
      strokeGradient: { colors: 'rainbow' },
      taper: { startLength: 0.2 },
    });
  });

  test('glow with offset (shadow)', () => {
    assertType({ glow: { radius: 8, offsetX: 2, offsetY: 2, color: '#000000' } });
  });

  test('wobble with noise mode', () => {
    assertType({ wobble: { amplitude: 2, mode: 'noise' } });
    assertType({ wobble: { amplitude: 2, mode: 'sine' } });
  });

  test('custom key without effect field is rejected', () => {
    // @ts-expect-error — unknown key must have explicit `effect`
    assertType({ myGlow: { radius: 5 } });
  });

  test('wrong params for effect are rejected', () => {
    // @ts-expect-error — amplitude is not a glow param
    assertType({ glow: { amplitude: 5 } });
  });

  test('known key with wrong effect name is rejected', () => {
    // @ts-expect-error — glow key cannot have effect: 'wobble'
    assertType({ glow: { effect: 'wobble' } });
  });

  test('invalid effect name is rejected', () => {
    // @ts-expect-error — 'sparkle' is not a valid effect
    assertType({ myEffect: { effect: 'sparkle' } });
  });

  test('singleton effect cannot be used with custom key', () => {
    // @ts-expect-error — pressureWidth is singleton, cannot be duplicated via custom key
    assertType({ myPressure: { effect: 'pressureWidth', strength: 0.5 } });
    // @ts-expect-error — wobble is singleton, cannot be duplicated via custom key
    assertType({ myWobble: { effect: 'wobble', amplitude: 2 } });
    // @ts-expect-error — strokeGradient is singleton, cannot be duplicated via custom key
    assertType({ myGradient: { effect: 'strokeGradient', colors: 'rainbow' } });
    // @ts-expect-error — taper is singleton, cannot be duplicated via custom key
    assertType({ myTaper: { effect: 'taper', startLength: 0.2 } });
  });

  test('singleton effect works with its own key', () => {
    assertType({ pressureWidth: { strength: 0.5 } });
    assertType({ pressureWidth: true });
    assertType({ taper: { startLength: 0.2 } });
    assertType({ strokeGradient: { colors: 'rainbow' } });
  });
});
