import type { TegakiEffectConfigs, TegakiEffectName } from '../types.ts';

export interface ResolvedEffect<K extends TegakiEffectName = TegakiEffectName> {
  effect: K;
  order: number;
  config: TegakiEffectConfigs[K];
}

/**
 * Normalizes an effects record into a sorted array of resolved effects.
 * Known keys infer the effect name; custom keys read it from the `effect` field.
 * Boolean `true` becomes an empty config. `false`/absent entries are skipped.
 */
export function resolveEffects(effects: Record<string, any> | undefined): ResolvedEffect[] {
  if (!effects) return [];

  const knownEffects: Set<string> = new Set(['glow', 'wobble', 'pressureWidth', 'taper', 'gradient']);
  const result: ResolvedEffect[] = [];

  for (const [key, value] of Object.entries(effects)) {
    if (value === false || value == null) continue;

    let effectName: TegakiEffectName;
    let config: Record<string, any>;
    let order: number;

    if (value === true) {
      effectName = (knownEffects.has(key) ? key : undefined) as TegakiEffectName;
      if (!effectName) continue;
      config = {};
      order = 0;
    } else {
      if (value.enabled === false) continue;
      effectName = value.effect ?? (knownEffects.has(key) ? key : undefined);
      if (!effectName) continue;
      const { effect: _, order: o, enabled: __, ...rest } = value;
      config = rest;
      order = o ?? 0;
    }

    result.push({ effect: effectName, order, config });
  }

  result.sort((a, b) => a.order - b.order);
  return result;
}

/** Check if a specific effect is active. */
export function findEffect<K extends TegakiEffectName>(effects: ResolvedEffect[], name: K): ResolvedEffect<K> | undefined {
  return effects.find((e) => e.effect === name) as ResolvedEffect<K> | undefined;
}

/** Get all instances of a specific effect (for duplicates). */
export function findEffects<K extends TegakiEffectName>(effects: ResolvedEffect[], name: K): ResolvedEffect<K>[] {
  return effects.filter((e) => e.effect === name) as ResolvedEffect<K>[];
}
