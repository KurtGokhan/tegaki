'use client';

import { type ComponentProps, createElement, type ReactNode, type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { TegakiEngine, type TegakiEngineOptions } from '../core/engine.ts';
import type { Coercible } from '../lib/utils.ts';
import { coerceToString } from '../lib/utils.ts';
import type { TegakiEffects } from '../types.ts';

/** Imperative handle exposed via the `ref` prop. */
export interface TegakiRendererHandle {
  /** The underlying engine instance. `null` before mount and after unmount. */
  readonly engine: TegakiEngine | null;
  /** The container DOM element. */
  readonly element: HTMLDivElement | null;
}

export interface TegakiRendererProps<E extends TegakiEffects<E> = Record<string, never>>
  extends Omit<TegakiEngineOptions, 'effects'>,
    Omit<ComponentProps<'div'>, 'children' | 'ref'> {
  /** Imperative handle ref for playback controls and DOM access. */
  ref?: Ref<TegakiRendererHandle>;

  /** Children coerced to string. Strings and numbers are kept; everything else is ignored. */
  children?: Coercible;

  /** Visual effects applied during canvas rendering. */
  effects?: E;
}

function reactCreateElement(tag: string, props: Record<string, any>, ...children: (ReactNode | string)[]): ReactNode {
  return createElement(tag, { ...props, key: props['data-tegaki'] }, ...children);
}

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
  ...divProps
}: TegakiRendererProps<E>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<TegakiEngine | null>(null);
  const resolvedText = text ?? coerceToString(children);

  // Render the element tree via the engine's static method (SSR-safe)
  const engineOptions: TegakiEngineOptions = {
    text: resolvedText,
    font,
    time: timeProp,
    effects: effects as Record<string, any>,
    segmentSize,
    timing,
    showOverlay,
    onComplete,
  };
  const elements = TegakiEngine.renderElements(engineOptions, reactCreateElement);

  // Create engine on mount, adopting the pre-rendered elements
  useEffect(() => {
    const engine = new TegakiEngine(containerRef.current!, { adopt: true });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Update engine with current props every render
  useEffect(() => {
    engineRef.current?.update(engineOptions);
  });

  // Imperative handle
  useImperativeHandle(
    ref,
    () => ({
      get engine() {
        return engineRef.current;
      },
      get element() {
        return containerRef.current;
      },
    }),
    [],
  );

  return (
    <div ref={containerRef} {...divProps}>
      {elements}
    </div>
  );
}
