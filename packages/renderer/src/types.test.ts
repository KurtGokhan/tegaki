import { describe, test } from 'bun:test';
import type { TegakiEffects } from './types.ts';

function assertType<const E extends TegakiEffects<E>>(_value: E) {}

describe.skip('TegakiEffects', () => {
  test('known key with config', () => {
    assertType({ glow: { radius: 5 } });
    assertType({ wobble: { amplitude: 2, frequency: 3 } });
    assertType({ rainbow: { saturation: 80 } });
    assertType({ pressureWidth: {} });
  });

  test('known key with boolean shorthand', () => {
    assertType({ glow: true });
    assertType({ wobble: true });
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
    });
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
});
