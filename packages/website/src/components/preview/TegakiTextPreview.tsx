import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUNDLE_VERSION,
  computeTimeline,
  type TegakiBundle,
  type TegakiEffects,
  type TegakiQuality,
  TegakiRenderer,
  type TegakiRendererHandle,
  type TimeControlProp,
  type TimelineConfig,
} from 'tegaki';
import { type ParsedFontInfo, type PipelineOptions, type PipelineResult, processGlyph } from 'tegaki-generator';

export interface TegakiTextPreviewReadyInfo {
  bundle: TegakiBundle;
  totalDuration: number;
}

export interface TegakiTextPreviewProps {
  fontInfo: ParsedFontInfo;
  fontBuffer: ArrayBuffer;
  /** Additional font subset buffers (e.g. for CJK fonts with split subsets). */
  extraFontBuffers?: ArrayBuffer[];
  text: string;
  options: PipelineOptions;
  time?: TimeControlProp;
  effects?: TegakiEffects<Record<string, any>>;
  timing?: TimelineConfig;
  quality?: TegakiQuality;
  showOverlay?: boolean;
  fontSizePx?: number;
  lineHeightRatio?: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Optional shared cache keyed by `${char}:${JSON.stringify(options)}`. When
   * provided, glyph pipeline results are reused across renders and instances.
   */
  resultsCache?: React.RefObject<Map<string, PipelineResult>>;
  /**
   * Fires once the font has loaded and the glyph bundle is built. Fires again
   * whenever the bundle changes (e.g. text or options change). Useful as a
   * snapshot-ready signal for E2E tests.
   */
  onReady?: (info: TegakiTextPreviewReadyInfo) => void;
}

export const TegakiTextPreview = forwardRef<TegakiRendererHandle, TegakiTextPreviewProps>(function TegakiTextPreview(
  {
    fontInfo,
    fontBuffer,
    extraFontBuffers,
    text,
    options,
    time,
    effects,
    timing,
    quality,
    showOverlay,
    fontSizePx = 128,
    lineHeightRatio = 1.5,
    className,
    style,
    resultsCache,
    onReady,
  },
  ref,
) {
  const [fontReady, setFontReady] = useState(false);

  const fontUrl = useMemo(() => URL.createObjectURL(new Blob([fontBuffer], { type: 'font/ttf' })), [fontBuffer]);

  const prevFontUrl = useRef(fontUrl);
  useEffect(() => {
    const prev = prevFontUrl.current;
    prevFontUrl.current = fontUrl;
    if (prev && prev !== fontUrl) URL.revokeObjectURL(prev);
    return () => {
      if (fontUrl) URL.revokeObjectURL(fontUrl);
    };
  }, [fontUrl]);

  useEffect(() => {
    setFontReady(false);
    const extraUrls = (extraFontBuffers ?? []).map((buf) => URL.createObjectURL(new Blob([buf], { type: 'font/ttf' })));
    const faces = [fontUrl, ...extraUrls].map(
      (url) => new FontFace(fontInfo.family, `url(${url})`, { featureSettings: '"calt" 0, "liga" 0' }),
    );
    let cancelled = false;
    Promise.all(faces.map((f) => f.load())).then((loaded) => {
      if (cancelled) return;
      for (const f of loaded) document.fonts.add(f);
      setFontReady(true);
    });
    return () => {
      cancelled = true;
      for (const f of faces) document.fonts.delete(f);
      for (const url of extraUrls) URL.revokeObjectURL(url);
    };
  }, [fontInfo, fontUrl, extraFontBuffers]);

  const internalCacheRef = useRef<Map<string, PipelineResult>>(new Map());
  const activeCache = resultsCache?.current ?? internalCacheRef.current;

  const fontBundle = useMemo<TegakiBundle>(() => {
    const glyphData: TegakiBundle['glyphData'] = {};
    const optionsKey = JSON.stringify(options);

    const seen = new Set<string>();
    for (const char of text) {
      if (seen.has(char) || char === ' ' || char === '\n') continue;
      seen.add(char);

      const cacheKey = `${char}:${optionsKey}`;
      let res = activeCache.get(cacheKey);
      if (!res) {
        res = processGlyph(fontInfo, char, options) ?? undefined;
        if (res) activeCache.set(cacheKey, res);
      }
      if (!res) continue;

      const last = res.strokesFontUnits[res.strokesFontUnits.length - 1];
      glyphData[char] = {
        w: res.advanceWidth,
        t: last ? Math.round((last.delay + last.animationDuration) * 1000) / 1000 : 0,
        s: res.strokesFontUnits.map((s) => ({
          p: s.points.map((p) => [p.x, p.y, p.width] as [number, number, number]),
          d: s.delay,
          a: s.animationDuration,
        })),
      };
    }

    return {
      version: BUNDLE_VERSION,
      family: fontInfo.family,
      lineCap: options.lineCap === 'auto' ? fontInfo.lineCap : options.lineCap,
      fontUrl,
      fontFaceCSS: `@font-face { font-family: '${fontInfo.family}'; src: url(${fontUrl}); }`,
      unitsPerEm: fontInfo.unitsPerEm,
      ascender: fontInfo.ascender,
      descender: fontInfo.descender,
      glyphData,
    } satisfies TegakiBundle;
  }, [fontInfo, fontUrl, text, options, activeCache]);

  useEffect(() => {
    if (!onReady || !fontReady) return;
    const totalDuration = computeTimeline(text, fontBundle).totalDuration;
    onReady({ bundle: fontBundle, totalDuration });
  }, [onReady, fontReady, fontBundle, text]);

  if (!fontReady) return null;

  return (
    <TegakiRenderer
      ref={ref}
      className={className}
      style={{ fontSize: `${fontSizePx}px`, lineHeight: lineHeightRatio, ...style }}
      text={text}
      time={time}
      font={fontBundle}
      showOverlay={showOverlay}
      effects={effects}
      quality={quality}
      timing={timing}
    />
  );
});
