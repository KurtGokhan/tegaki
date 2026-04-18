import { zipSync } from 'fflate';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUNDLE_VERSION,
  computeTimeline,
  type LineCap,
  type TegakiBundle,
  TegakiRenderer,
  type TegakiRendererHandle,
  type TimeControlProp,
} from 'tegaki';
import {
  DEFAULT_OPTIONS,
  EXAMPLE_FONTS,
  enumerateFontChars,
  extractTegakiBundle,
  type ParsedFontInfo,
  type PipelineOptions,
  type PipelineResult,
  parseFont,
  processGlyph,
  renderStage,
  type SkeletonMethod,
  STROKE_COLORS,
  type VisualizationStage,
} from 'tegaki-generator';
import ZoomCanvas from './reactive-canvas.tsx';
import {
  type CustomEffect,
  DEFAULT_EFFECTS_STATE,
  EFFECT_DEFAULTS,
  type EffectsState,
  parseUrlState,
  syncUrlState,
  type TimeMode,
} from './url-state.ts';

type PreviewMode = 'glyph' | 'text';

type EasingPreset = { key: string; label: string; fn: ((t: number) => number) | undefined };

const EASING_PRESETS: EasingPreset[] = [
  { key: 'default', label: 'Default', fn: undefined },
  { key: 'linear', label: 'Linear', fn: (t) => t },
  { key: 'ease-out-quad', label: 'Ease Out Quad', fn: (t) => 1 - (1 - t) * (1 - t) },
  { key: 'ease-out-cubic', label: 'Ease Out Cubic', fn: (t) => 1 - (1 - t) ** 3 },
  { key: 'ease-out-expo', label: 'Ease Out Expo', fn: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)) },
  { key: 'ease-in-quad', label: 'Ease In Quad', fn: (t) => t * t },
  { key: 'ease-in-cubic', label: 'Ease In Cubic', fn: (t) => t ** 3 },
  { key: 'ease-in-out-quad', label: 'Ease In-Out Quad', fn: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) },
  { key: 'ease-in-out-cubic', label: 'Ease In-Out Cubic', fn: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2) },
];

const EASING_MAP = new Map(EASING_PRESETS.map((p) => [p.key, p.fn]));

function getEasingFn(key: string): ((t: number) => number) | undefined {
  return EASING_MAP.get(key);
}

type Stage =
  | 'outline'
  | 'flattened'
  | 'bitmap'
  | 'skeleton'
  | 'overlay'
  | 'distance'
  | 'traced'
  | 'curvature'
  | 'strokes'
  | 'animation'
  | 'final';

const STAGES: { key: Stage; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'flattened', label: 'Flattened' },
  { key: 'bitmap', label: 'Bitmap' },
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'overlay', label: 'Overlay' },
  { key: 'distance', label: 'Distance' },
  { key: 'traced', label: 'Traced' },
  { key: 'curvature', label: 'Curvature' },
  { key: 'strokes', label: 'Strokes' },
  { key: 'animation', label: 'Animation' },
  { key: 'final', label: 'Final' },
];

const SKELETON_METHODS: { value: SkeletonMethod; label: string }[] = [
  { value: 'zhang-suen', label: 'Zhang-Suen' },
  { value: 'guo-hall', label: 'Guo-Hall' },
  { value: 'lee', label: 'Lee' },
  { value: 'medial-axis', label: 'Medial Axis' },
  { value: 'thin', label: 'Morphological Thin' },
  { value: 'voronoi', label: 'Voronoi' },
];

export function PreviewApp() {
  const [initialUrlState] = useState(parseUrlState);
  const [fontFamily, setFontFamily] = useState(initialUrlState.fontFamily);
  const [fontInput, setFontInput] = useState('');
  const [fontInfo, setFontInfo] = useState<ParsedFontInfo | null>(null);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [extraFontBuffers, setExtraFontBuffers] = useState<ArrayBuffer[] | undefined>(undefined);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontError, setFontError] = useState('');

  // Autocomplete state
  const [allFonts, setAllFonts] = useState<{ family: string; category: string }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const fontListFetched = useRef(false);

  const filteredFonts = useMemo(() => {
    if (!fontInput.trim()) return [];
    const query = fontInput.toLowerCase();
    return allFonts.filter((f) => f.family.toLowerCase().includes(query)).slice(0, 12);
  }, [fontInput, allFonts]);

  // Fetch font list from Fontsource for autocomplete (lazy, on first interaction)
  const fetchFontList = useCallback(() => {
    if (fontListFetched.current) return;
    fontListFetched.current = true;
    fetch('https://api.fontsource.org/v1/fonts?type=google')
      .then((r) => r.json())
      .then((data: { family: string; category: string }[]) => {
        setAllFonts(data.map((f) => ({ family: f.family, category: f.category })));
      })
      .catch(() => {
        fontListFetched.current = false;
      });
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        fontInputRef.current &&
        !fontInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const [chars, setChars] = useState(initialUrlState.chars);
  const [selectedChar, setSelectedChar] = useState(initialUrlState.selectedChar);
  const [activeStage, setActiveStage] = useState<Stage>(initialUrlState.activeStage);
  const [options, setOptions] = useState<PipelineOptions>(initialUrlState.options);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialUrlState.previewMode);
  const [previewText, setPreviewText] = useState(initialUrlState.previewText);
  const [animSpeed, setAnimSpeed] = useState(initialUrlState.animSpeed);
  const [fontSizePx, setFontSizePx] = useState(initialUrlState.fontSizePx);
  const [lineHeightRatio, setLineHeightRatio] = useState(initialUrlState.lineHeightRatio);
  const [showOverlay, setShowOverlay] = useState(initialUrlState.showOverlay);
  const [timeMode, setTimeMode] = useState<TimeMode>(initialUrlState.timeMode);
  const [currentTime, setCurrentTime] = useState(initialUrlState.currentTime);
  const [loop, setLoop] = useState(initialUrlState.loop);
  const [effectsState, setEffectsState] = useState<EffectsState>(initialUrlState.effectsState);
  const [customEffects, setCustomEffects] = useState<CustomEffect[]>(initialUrlState.customEffects);
  const [quality, setQuality] = useState(initialUrlState.quality);
  const [catchUp, setCatchUp] = useState(initialUrlState.catchUp);
  const [strokeEasing, setStrokeEasing] = useState(initialUrlState.strokeEasing);
  const [glyphEasing, setGlyphEasing] = useState(initialUrlState.glyphEasing);

  // Animation state (lifted up so controls live outside the canvas area)
  const [animPlaying, setAnimPlaying] = useState(true);
  const [animTime, setAnimTime] = useState(0);
  const prevAnimResultRef = useRef<PipelineResult | null>(null);

  // Cache of results per character
  const resultsCache = useRef(new Map<string, PipelineResult>());

  // Set of characters the font actually supports (checks all subset fonts)
  const availableChars = useMemo(() => {
    if (!fontInfo) return new Set<string>();
    const fonts = [fontInfo.font, ...(fontInfo.extraFonts ?? [])];
    const available = new Set<string>();
    for (const c of chars) {
      for (const f of fonts) {
        const glyph = f.charToGlyph(c);
        if (glyph && glyph.index !== 0) {
          available.add(c);
          break;
        }
      }
    }
    return available;
  }, [fontInfo, chars]);

  const loadFont = useCallback(async (family: string) => {
    setFontLoading(true);
    setFontError('');
    resultsCache.current.clear();
    try {
      const { primary, extra } = await fetchFontFromCDN(family);
      const info = parseFont(primary, extra.length > 0 ? extra : undefined);
      setFontInfo(info);
      setFontBuffer(primary);
      setExtraFontBuffers(extra.length > 0 ? extra : undefined);
      setFontFamily(family);
    } catch (e) {
      setFontError((e as Error).message);
      setFontInfo(null);
    } finally {
      setFontLoading(false);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFontLoading(true);
    setFontError('');
    resultsCache.current.clear();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result as ArrayBuffer;
        const info = parseFont(buf);
        setFontInfo(info);
        setFontBuffer(buf);
        setExtraFontBuffers(undefined);
        setFontFamily(info.family);
      } catch (err) {
        setFontError((err as Error).message);
        setFontInfo(null);
      } finally {
        setFontLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Process glyph when selection or options change
  useEffect(() => {
    if (!fontInfo || !selectedChar) {
      setResult(null);
      return;
    }

    const cacheKey = `${selectedChar}:${JSON.stringify(options)}`;
    const cached = resultsCache.current.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    setProcessing(true);
    // Use setTimeout to let the UI update before heavy computation
    const id = setTimeout(() => {
      const res = processGlyph(fontInfo, selectedChar, options);
      if (res) {
        resultsCache.current.set(cacheKey, res);
      }
      setResult(res);
      setProcessing(false);
    }, 10);
    return () => clearTimeout(id);
  }, [fontInfo, selectedChar, options]);

  // Auto-play animation when result changes
  if (prevAnimResultRef.current !== result) {
    prevAnimResultRef.current = result;
    if (animTime !== 0 || !animPlaying) {
      setAnimTime(0);
      setAnimPlaying(true);
    }
  }

  const totalDuration = useMemo(() => {
    if (!result || result.strokesFontUnits.length === 0) return 0;
    const last = result.strokesFontUnits[result.strokesFontUnits.length - 1]!;
    return last.delay + last.animationDuration;
  }, [result]);

  // Animation loop
  useEffect(() => {
    if (!animPlaying || (activeStage !== 'animation' && activeStage !== 'final')) return;
    let lastTs: number | null = null;
    let raf: number;
    const tick = (ts: number) => {
      if (lastTs === null) {
        lastTs = ts;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      setAnimTime((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setAnimPlaying(false);
          return totalDuration;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animPlaying, totalDuration, activeStage]);

  // Sync configurable state to URL (debounced to avoid thrashing during slider drags)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncUrlState({
        fontFamily,
        chars,
        selectedChar,
        activeStage,
        previewMode,
        previewText,
        options,
        animSpeed,
        fontSizePx,
        lineHeightRatio,
        showOverlay,
        timeMode,
        currentTime,
        loop,
        effectsState,
        customEffects,
        quality,
        catchUp,
        strokeEasing,
        glyphEasing,
      });
    }, 300);
    return () => clearTimeout(syncTimerRef.current);
  }, [
    fontFamily,
    chars,
    selectedChar,
    activeStage,
    previewMode,
    previewText,
    options,
    animSpeed,
    fontSizePx,
    lineHeightRatio,
    showOverlay,
    timeMode,
    currentTime,
    loop,
    catchUp,
    effectsState,
    customEffects,
    quality,
    strokeEasing,
    glyphEasing,
  ]);

  // Auto-load font on mount (from URL state or default)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      loadFont(fontFamily);
    }
  }, [fontFamily, loadFont]);

  const updateOption = useCallback(<K extends keyof PipelineOptions>(key: K, value: PipelineOptions[K]) => {
    resultsCache.current.clear();
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!fontInfo || !fontBuffer) return;
    setDownloading(true);
    try {
      const slug = fontInfo.family.toLowerCase().replace(/\s+/g, '-');
      const bundle = extractTegakiBundle({
        fontBuffer,
        fontFileName: `${slug}.ttf`,
        chars,
        options,
        extraFontBuffers,
        subset: false,
      });

      const encoder = new TextEncoder();
      const zipFiles: Record<string, Uint8Array> = {};
      for (const file of bundle.files) {
        const content = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
        zipFiles[`${slug}/${file.path}`] = content instanceof Uint8Array ? content : new Uint8Array(content);
      }

      const zip = zipSync(zipFiles);
      const blob = new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [fontInfo, fontBuffer, extraFontBuffers, chars, options]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-80 min-w-80 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <a href="/tegaki/" className="text-gray-400 hover:text-gray-700 transition-colors" title="Back to docs">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </a>
            <h1 className="text-lg font-semibold">Tegaki generator</h1>
          </div>
          <a
            href="https://github.com/KurtGokhan/tegaki"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-700 transition-colors"
            title="View on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>

        <div className="p-4 flex flex-col gap-4 flex-1">
          {/* Font loading */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-600 mb-1">Font</legend>
            <div className="flex flex-wrap gap-1">
              {EXAMPLE_FONTS.map((f) => (
                <button
                  type="button"
                  key={f}
                  className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                    fontInfo?.family === f ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => loadFont(f)}
                  disabled={fontLoading}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={fontInputRef}
                  type="text"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  value={fontInput}
                  onChange={(e) => {
                    setFontInput(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => {
                    fetchFontList();
                    if (fontInput.trim()) setShowSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && fontInput.trim()) {
                      setShowSuggestions(false);
                      loadFont(fontInput.trim());
                    }
                    if (e.key === 'Escape') setShowSuggestions(false);
                  }}
                  placeholder="Search Google Fonts..."
                />
                {showSuggestions && filteredFonts.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto"
                  >
                    {filteredFonts.map((f) => (
                      <button
                        type="button"
                        key={f.family}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center justify-between cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setFontInput(f.family);
                          setShowSuggestions(false);
                          loadFont(f.family);
                        }}
                      >
                        <span>{f.family}</span>
                        <span className="text-xs text-gray-400">{f.category}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="px-3 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                onClick={() => fontInput.trim() && loadFont(fontInput.trim())}
                disabled={fontLoading || !fontInput.trim()}
              >
                {fontLoading ? '...' : 'Load'}
              </button>
            </div>
            <label className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              or upload .ttf/.otf:
              <input type="file" accept=".ttf,.otf,.woff" className="hidden" onChange={handleFileUpload} />
            </label>
            {fontError && <p className="text-xs text-red-600">{fontError}</p>}
            {fontInfo && (
              <p className="text-xs text-green-700">
                {fontInfo.family} {fontInfo.style} ({fontInfo.unitsPerEm} UPM, {fontInfo.lineCap} caps)
              </p>
            )}
          </fieldset>

          {/* Characters */}
          <fieldset className="flex flex-col gap-1">
            <div className="flex items-center justify-between mb-1">
              <legend className="text-sm font-medium text-gray-600">Characters</legend>
              {fontInfo && (
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => {
                    setChars(enumerateFontChars(fontInfo.font, fontInfo.extraFonts));
                  }}
                >
                  Select all available
                </button>
              )}
            </div>
            <textarea
              className="px-2 py-1 border border-gray-300 rounded text-sm font-mono h-16 resize-y"
              value={chars}
              onChange={(e) => {
                const seen = new Set<string>();
                const unique: string[] = [];
                for (const { segment } of segmenter.segment(e.target.value)) {
                  if (!seen.has(segment)) {
                    seen.add(segment);
                    unique.push(segment);
                  }
                }
                setChars(unique.join(''));
              }}
            />
          </fieldset>

          {/* Main options */}
          <fieldset className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <legend className="text-sm font-medium text-gray-600">Options</legend>
              {JSON.stringify(options) !== JSON.stringify(DEFAULT_OPTIONS) && (
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                  onClick={() => {
                    resultsCache.current.clear();
                    setOptions(DEFAULT_OPTIONS);
                  }}
                >
                  Reset all
                </button>
              )}
            </div>

            <SliderOption
              label="Resolution"
              value={options.resolution}
              defaultValue={DEFAULT_OPTIONS.resolution}
              min={50}
              max={800}
              step={10}
              onChange={(v) => updateOption('resolution', v)}
            />

            <SelectOption
              label="Skeleton method"
              value={options.skeletonMethod}
              defaultValue={DEFAULT_OPTIONS.skeletonMethod}
              options={SKELETON_METHODS}
              onChange={(v) => updateOption('skeletonMethod', v as SkeletonMethod)}
            />

            <SelectOption
              label="Line cap"
              value={options.lineCap}
              defaultValue={DEFAULT_OPTIONS.lineCap}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'round', label: 'Round' },
                { value: 'butt', label: 'Butt' },
                { value: 'square', label: 'Square' },
              ]}
              onChange={(v) => updateOption('lineCap', v as LineCap | 'auto')}
            />

            <SelectOption
              label="Distance transform"
              value={options.dtMethod}
              defaultValue={DEFAULT_OPTIONS.dtMethod}
              options={[
                { value: 'chamfer', label: 'Chamfer' },
                { value: 'euclidean', label: 'Euclidean' },
              ]}
              onChange={(v) => updateOption('dtMethod', v as 'euclidean' | 'chamfer')}
            />

            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={options.ligatures} onChange={(e) => updateOption('ligatures', e.target.checked)} />
              Ligatures (calt, liga)
            </label>
          </fieldset>

          {/* Advanced options */}
          <fieldset className="flex flex-col gap-2">
            <button
              type="button"
              className="text-sm font-medium text-gray-600 text-left flex items-center gap-1"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span className="text-xs">{showAdvanced ? '\u25BC' : '\u25B6'}</span>
              Advanced
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-2 pl-2">
                <SliderOption
                  label="Bezier tolerance"
                  value={options.bezierTolerance}
                  defaultValue={DEFAULT_OPTIONS.bezierTolerance}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onChange={(v) => updateOption('bezierTolerance', v)}
                />
                <SliderOption
                  label="RDP tolerance"
                  value={options.rdpTolerance}
                  defaultValue={DEFAULT_OPTIONS.rdpTolerance}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(v) => updateOption('rdpTolerance', v)}
                />
                <SliderOption
                  label="Spur length ratio"
                  value={options.spurLengthRatio}
                  defaultValue={DEFAULT_OPTIONS.spurLengthRatio}
                  min={0}
                  max={0.3}
                  step={0.01}
                  onChange={(v) => updateOption('spurLengthRatio', v)}
                />
                <SliderOption
                  label="Merge threshold"
                  value={options.mergeThresholdRatio}
                  defaultValue={DEFAULT_OPTIONS.mergeThresholdRatio}
                  min={0}
                  max={0.3}
                  step={0.01}
                  onChange={(v) => updateOption('mergeThresholdRatio', v)}
                />
                <SliderOption
                  label="Trace lookback"
                  value={options.traceLookback}
                  defaultValue={DEFAULT_OPTIONS.traceLookback}
                  min={1}
                  max={30}
                  step={1}
                  onChange={(v) => updateOption('traceLookback', v)}
                />
                <SliderOption
                  label="Curvature bias"
                  value={options.curvatureBias}
                  defaultValue={DEFAULT_OPTIONS.curvatureBias}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) => updateOption('curvatureBias', v)}
                />
                <SliderOption
                  label="Junction cleanup iterations"
                  value={options.junctionCleanupIterations}
                  defaultValue={DEFAULT_OPTIONS.junctionCleanupIterations}
                  min={0}
                  max={20}
                  step={1}
                  onChange={(v) => updateOption('junctionCleanupIterations', v)}
                />
                {options.skeletonMethod === 'thin' && (
                  <SliderOption
                    label="Thin max iterations"
                    value={options.thinMaxIterations}
                    defaultValue={DEFAULT_OPTIONS.thinMaxIterations}
                    min={1}
                    max={100}
                    step={1}
                    onChange={(v) => updateOption('thinMaxIterations', v)}
                  />
                )}
                {options.skeletonMethod === 'voronoi' && (
                  <SliderOption
                    label="Voronoi sampling interval"
                    value={options.voronoiSamplingInterval}
                    defaultValue={DEFAULT_OPTIONS.voronoiSamplingInterval}
                    min={1}
                    max={10}
                    step={0.5}
                    onChange={(v) => updateOption('voronoiSamplingInterval', v)}
                  />
                )}
                <SliderOption
                  label="Drawing speed"
                  value={options.drawingSpeed}
                  defaultValue={DEFAULT_OPTIONS.drawingSpeed}
                  min={500}
                  max={10000}
                  step={100}
                  onChange={(v) => updateOption('drawingSpeed', v)}
                />
                <SliderOption
                  label="Stroke pause"
                  value={options.strokePause}
                  defaultValue={DEFAULT_OPTIONS.strokePause}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => updateOption('strokePause', v)}
                />
              </div>
            )}
          </fieldset>

          {/* Download */}
          <button
            type="button"
            className="w-full px-3 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50 cursor-pointer"
            disabled={!fontInfo || !fontBuffer || downloading}
            onClick={handleDownload}
          >
            {downloading ? 'Generating...' : 'Download Bundle (.zip)'}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
          {(['glyph', 'text'] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={`px-3 py-1 text-xs rounded cursor-pointer transition-colors ${
                previewMode === mode ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
              onClick={() => setPreviewMode(mode)}
            >
              {mode === 'glyph' ? 'Glyph Inspector' : 'Text Preview'}
            </button>
          ))}
        </div>

        {previewMode === 'glyph' ? (
          <>
            {/* Character grid */}
            <div className="flex flex-wrap gap-0.5 p-3 border-b border-gray-200 bg-white overflow-y-auto max-h-32">
              {[...chars].map((c, i) => (
                <button
                  type="button"
                  key={`${c}-${i}`}
                  className={`w-8 h-8 flex items-center justify-center text-sm font-mono rounded transition-colors ${
                    fontInfo && !availableChars.has(c)
                      ? 'text-gray-300 cursor-not-allowed'
                      : c === selectedChar
                        ? 'bg-gray-800 text-white cursor-pointer'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer'
                  }`}
                  onClick={() => setSelectedChar(c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Stage tabs */}
            <div className="flex gap-1 px-3 py-2 border-b border-gray-200 bg-white overflow-x-auto">
              {STAGES.map((s) => (
                <button
                  type="button"
                  key={s.key}
                  className={`px-2.5 py-1 text-xs rounded whitespace-nowrap cursor-pointer transition-colors ${
                    s.key === activeStage ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setActiveStage(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Canvas area */}
            <ZoomCanvas contentWidth={700} contentHeight={700} className="flex-1 p-4">
              <div className="flex-1 flex p-4 overflow-auto">
                <div className="m-auto">
                  {processing && <p className="text-gray-500">Processing...</p>}
                  {!processing && !result && fontInfo && <p className="text-gray-400">No glyph data for "{selectedChar}"</p>}
                  {!processing && !fontInfo && <p className="text-gray-400">Load a font to get started</p>}
                  {!processing && result && <StageRenderer result={result} stage={activeStage} animTime={animTime} />}
                </div>
              </div>
            </ZoomCanvas>

            {/* Animation controls bar (always rendered with fixed height to prevent layout shift) */}
            <div className={`h-[44px] ${(activeStage === 'animation' || activeStage === 'final') && result ? '' : 'invisible'}`}>
              {result && (
                <AnimationControls
                  result={result}
                  time={animTime}
                  setTime={setAnimTime}
                  playing={animPlaying}
                  setPlaying={setAnimPlaying}
                />
              )}
            </div>

            {/* Info bar */}
            {result && (
              <div className="px-3 py-1.5 border-t border-gray-200 bg-white text-xs text-gray-500 flex gap-4">
                <span>
                  Char: {result.char} (U+{result.unicode.toString(16).padStart(4, '0').toUpperCase()})
                </span>
                <span>Advance: {result.advanceWidth}</span>
                <span>
                  Bitmap: {result.bitmapWidth}x{result.bitmapHeight}
                </span>
                <span>Polylines: {result.polylines.length}</span>
                <span>Strokes: {result.strokes.length}</span>
                <span>Line cap: {result.lineCap}</span>
              </div>
            )}
          </>
        ) : (
          <TextPreview
            fontInfo={fontInfo}
            fontBuffer={fontBuffer}
            extraFontBuffers={extraFontBuffers}
            options={options}
            text={previewText}
            onTextChange={setPreviewText}
            resultsCache={resultsCache}
            animSpeed={animSpeed}
            onAnimSpeedChange={setAnimSpeed}
            fontSizePx={fontSizePx}
            onFontSizePxChange={setFontSizePx}
            lineHeightRatio={lineHeightRatio}
            onLineHeightRatioChange={setLineHeightRatio}
            showOverlay={showOverlay}
            onShowOverlayChange={setShowOverlay}
            timeMode={timeMode}
            onTimeModeChange={setTimeMode}
            currentTime={currentTime}
            onCurrentTimeChange={setCurrentTime}
            loop={loop}
            onLoopChange={setLoop}
            catchUp={catchUp}
            onCatchUpChange={setCatchUp}
            effectsState={effectsState}
            onEffectsStateChange={setEffectsState}
            customEffects={customEffects}
            onCustomEffectsChange={setCustomEffects}
            quality={quality}
            onQualityChange={setQuality}
            strokeEasing={strokeEasing}
            onStrokeEasingChange={setStrokeEasing}
            glyphEasing={glyphEasing}
            onGlyphEasingChange={setGlyphEasing}
          />
        )}
      </main>
    </div>
  );
}

// --- Rendering components ---

function PNGView({ data, width, height }: { data: Uint8Array; width: number; height: number }) {
  const url = useMemo(() => URL.createObjectURL(new Blob([data.buffer as ArrayBuffer], { type: 'image/png' })), [data]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const { width: dw, height: dh } = fitSize(width, height, 600);
  return <img src={url} alt="" className="border border-gray-200" style={{ imageRendering: 'pixelated', width: dw, height: dh }} />;
}

function SVGView({ svg }: { svg: string }) {
  const { width: dw, height: dh } = useMemo(() => {
    const vbMatch = svg.match(/viewBox="([^"]+)"/);
    if (!vbMatch) return { width: 600, height: 600 };
    const [, , vw, vh] = vbMatch[1]!.split(' ').map(Number);
    return fitSize(vw!, vh!, 600);
  }, [svg]);
  return (
    <div
      className="[&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:border [&>svg]:border-gray-200"
      style={{ width: dw, height: dh }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from shared renderers is trusted
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function StageRenderer({ result, stage, animTime }: { result: PipelineResult; stage: Stage; animTime: number }) {
  if (stage === 'animation') return <AnimationView result={result} time={animTime} />;
  if (stage === 'final') return <FinalView result={result} time={animTime} />;

  const rendered = renderStage(result, stage as VisualizationStage);
  if (rendered instanceof Uint8Array) {
    return <PNGView data={rendered} width={result.bitmapWidth} height={result.bitmapHeight} />;
  }
  return <SVGView svg={rendered} />;
}

function AnimationView({ result, time }: { result: PipelineResult; time: number }) {
  const { strokesFontUnits, lineCap, bitmapWidth: w, bitmapHeight: h, transform } = result;

  // Content-box viewBox: tight fit around rasterized content to match bitmap-based stages
  const vx = transform.offsetX;
  const vy = transform.offsetY;
  const vw = w / transform.scaleX;
  const vh = h / transform.scaleY;
  const { width: dw, height: dh } = fitSize(w, h, 600);

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="border border-gray-200" style={{ width: dw, height: dh }}>
      <rect x={vx} y={vy} width={vw} height={vh} fill="white" />
      {strokesFontUnits.map((stroke, i) => {
        const color = STROKE_COLORS[i % STROKE_COLORS.length]!;
        const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;
        const localTime = time - stroke.delay;

        if (localTime < 0) return null;

        if (stroke.points.length === 1) {
          const p = stroke.points[0]!;
          const size = Math.max(avgWidth, 0.5);
          return lineCap === 'round' ? (
            <circle key={i} cx={p.x} cy={p.y} r={size / 2} fill={color} />
          ) : (
            <rect key={i} x={p.x - size / 2} y={p.y - size / 2} width={size} height={size} fill={color} />
          );
        }

        const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        let pathLen = 0;
        for (let j = 1; j < stroke.points.length; j++) {
          const dx = stroke.points[j]!.x - stroke.points[j - 1]!.x;
          const dy = stroke.points[j]!.y - stroke.points[j - 1]!.y;
          pathLen += Math.sqrt(dx * dx + dy * dy);
        }

        const progress = stroke.animationDuration > 0 ? Math.min(localTime / stroke.animationDuration, 1) : 1;
        const dashLen = pathLen + avgWidth;
        const dashOffset = dashLen * (1 - progress);

        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(avgWidth, 0.5)}
            strokeLinecap={lineCap}
            strokeLinejoin="round"
            strokeDasharray={dashLen}
            strokeDashoffset={dashOffset}
          />
        );
      })}
    </svg>
  );
}

function FinalView({ result, time }: { result: PipelineResult; time: number }) {
  const { strokesFontUnits, lineCap, bitmapWidth: bw, bitmapHeight: bh, transform, ascender, descender, advanceWidth } = result;

  // Container matches the content-box display size (same as bitmap-based stages)
  const { width: dw, height: dh } = fitSize(bw, bh, 600);

  // Em-square viewBox (matches production SVG output)
  const ew = advanceWidth;
  const eh = ascender - descender;

  // Content-box in font units
  const cx = transform.offsetX;
  const cy = transform.offsetY;
  const cw = bw / transform.scaleX;
  const ch = bh / transform.scaleY;

  // Scale the SVG so the content region fills exactly (dw, dh)
  const svgW = (dw * ew) / cw;
  const svgH = (dh * eh) / ch;

  // Offset to align the content region with the container's top-left
  const ox = (cx * dw) / cw;
  const oy = ((cy + ascender) * dh) / ch;

  return (
    <div className="border border-gray-200 overflow-hidden relative" style={{ width: dw, height: dh }}>
      <svg
        viewBox={`0 ${-ascender} ${ew} ${eh}`}
        style={{ position: 'absolute', left: -ox, top: -oy, width: svgW, height: svgH, overflow: 'visible' }}
      >
        <rect x={0} y={-ascender} width={ew} height={eh} fill="white" />
        {strokesFontUnits.map((stroke, i) => {
          const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;
          const localTime = time - stroke.delay;

          if (localTime < 0) return null;

          if (stroke.points.length === 1) {
            const p = stroke.points[0]!;
            const size = Math.max(avgWidth, 0.5);
            return lineCap === 'round' ? (
              <circle key={i} cx={p.x} cy={p.y} r={size / 2} fill="currentColor" />
            ) : (
              <rect key={i} x={p.x - size / 2} y={p.y - size / 2} width={size} height={size} fill="currentColor" />
            );
          }

          const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          let pathLen = 0;
          for (let j = 1; j < stroke.points.length; j++) {
            const dx = stroke.points[j]!.x - stroke.points[j - 1]!.x;
            const dy = stroke.points[j]!.y - stroke.points[j - 1]!.y;
            pathLen += Math.sqrt(dx * dx + dy * dy);
          }

          const progress = stroke.animationDuration > 0 ? Math.min(localTime / stroke.animationDuration, 1) : 1;
          const dashLen = pathLen + avgWidth;
          const dashOffset = dashLen * (1 - progress);

          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={Math.max(avgWidth, 0.5)}
              strokeLinecap={lineCap}
              strokeLinejoin="round"
              strokeDasharray={dashLen}
              strokeDashoffset={dashOffset}
            />
          );
        })}
      </svg>
    </div>
  );
}

function AnimationControls({
  result,
  time,
  setTime,
  playing,
  setPlaying,
}: {
  result: PipelineResult;
  time: number;
  setTime: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
}) {
  const totalDuration = useMemo(() => {
    if (result.strokesFontUnits.length === 0) return 0;
    const last = result.strokesFontUnits[result.strokesFontUnits.length - 1]!;
    return last.delay + last.animationDuration;
  }, [result.strokesFontUnits]);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-200 bg-white h-[44px]">
      <button
        type="button"
        className="px-3 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-100"
        onClick={() => {
          if (time >= totalDuration) setTime(0);
          setPlaying(!playing);
        }}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button
        type="button"
        className="px-3 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-100"
        onClick={() => {
          setTime(0);
          setPlaying(false);
        }}
      >
        Reset
      </button>
      <span className="text-xs tabular-nums text-gray-500 w-24">
        {time.toFixed(2)}s / {totalDuration.toFixed(2)}s
      </span>
      <input
        type="range"
        className="flex-1 max-w-64"
        min={0}
        max={totalDuration}
        step={0.01}
        value={time}
        onChange={(e) => {
          setTime(Number(e.target.value));
          setPlaying(false);
        }}
      />
    </div>
  );
}

// --- Text preview ---

function TextPreview({
  fontInfo,
  fontBuffer,
  extraFontBuffers,
  options,
  text,
  onTextChange,
  resultsCache,
  animSpeed,
  onAnimSpeedChange,
  fontSizePx,
  onFontSizePxChange,
  lineHeightRatio,
  onLineHeightRatioChange,
  showOverlay,
  onShowOverlayChange,
  timeMode,
  onTimeModeChange: setTimeMode,
  currentTime,
  onCurrentTimeChange,
  loop,
  onLoopChange: setLoop,
  catchUp,
  onCatchUpChange,
  effectsState,
  onEffectsStateChange,
  customEffects,
  onCustomEffectsChange,
  quality,
  onQualityChange,
  strokeEasing,
  onStrokeEasingChange,
  glyphEasing,
  onGlyphEasingChange,
}: {
  fontInfo: ParsedFontInfo | null;
  fontBuffer: ArrayBuffer | null;
  extraFontBuffers: ArrayBuffer[] | undefined;
  options: PipelineOptions;
  text: string;
  onTextChange: (text: string) => void;
  resultsCache: React.RefObject<Map<string, PipelineResult>>;
  animSpeed: number;
  onAnimSpeedChange: (v: number) => void;
  fontSizePx: number;
  onFontSizePxChange: (v: number) => void;
  lineHeightRatio: number;
  onLineHeightRatioChange: (v: number) => void;
  showOverlay: boolean;
  onShowOverlayChange: (v: boolean) => void;
  timeMode: TimeMode;
  onTimeModeChange: (v: TimeMode) => void;
  currentTime: number;
  onCurrentTimeChange: (v: number) => void;
  loop: boolean;
  onLoopChange: (v: boolean) => void;
  catchUp: number;
  onCatchUpChange: (v: number) => void;
  effectsState: EffectsState;
  onEffectsStateChange: (v: EffectsState) => void;
  customEffects: CustomEffect[];
  onCustomEffectsChange: (v: CustomEffect[]) => void;
  quality: { pixelRatio: number; segmentSize: number; clipText: boolean | number };
  onQualityChange: (v: { pixelRatio: number; segmentSize: number; clipText: boolean | number }) => void;
  strokeEasing: string;
  onStrokeEasingChange: (v: string) => void;
  glyphEasing: string;
  onGlyphEasingChange: (v: string) => void;
}) {
  // Initial time/paused state come from the URL (controlled mode only): a non-zero
  // `ct` param loads the timeline paused at that position so agents can inspect a
  // specific frame by editing the URL.
  const [playing, setPlaying] = useState(() => currentTime === 0);
  const [displayTime, setDisplayTime] = useState(() => currentTime);
  const timeRef = useRef(currentTime);
  const [fontReady, setFontReady] = useState(false);
  const [showEffectsDrawer, setShowEffectsDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const rendererRef = useRef<TegakiRendererHandle>(null);
  const updateEffect = useCallback(
    (updater: (prev: EffectsState) => EffectsState) => onEffectsStateChange(updater(effectsState)),
    [effectsState, onEffectsStateChange],
  );

  const addCustomEffect = useCallback(
    (effect: CustomEffect['effect']) => {
      // Find next available key: glow1, glow2, etc.
      const existing = customEffects.filter((e) => e.effect === effect);
      let n = existing.length + 1;
      while (customEffects.some((e) => e.key === `${effect}${n}`)) n++;
      onCustomEffectsChange([...customEffects, { key: `${effect}${n}`, effect, enabled: true, config: { ...EFFECT_DEFAULTS[effect] } }]);
    },
    [customEffects, onCustomEffectsChange],
  );

  const removeCustomEffect = useCallback(
    (key: string) => onCustomEffectsChange(customEffects.filter((e) => e.key !== key)),
    [customEffects, onCustomEffectsChange],
  );

  const updateCustomEffect = useCallback(
    (key: string, update: Partial<CustomEffect>) =>
      onCustomEffectsChange(customEffects.map((e) => (e.key === key ? { ...e, ...update } : e))),
    [customEffects, onCustomEffectsChange],
  );

  const effects = useMemo(() => {
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
  }, [effectsState, customEffects]);

  // Synchronous font change detection — reset all font-dependent state BEFORE rendering
  // so TegakiRenderer never sees stale fontReady, displayTime, or glyph components.
  // We skip the initial null→loaded transition so URL-seeded state (e.g. `ct`) survives
  // the first font load; playback is only reset when the user actually switches fonts.
  const prevFontInfoForReset = useRef(fontInfo);
  if (prevFontInfoForReset.current !== fontInfo) {
    const wasLoaded = prevFontInfoForReset.current !== null;
    prevFontInfoForReset.current = fontInfo;
    if (fontReady) setFontReady(false);
    if (wasLoaded) {
      timeRef.current = 0;
      if (displayTime !== 0) setDisplayTime(0);
      if (!playing) setPlaying(true);
    }
  }

  // Register font face (stable — only changes when font changes, not on text edits)
  const fontUrl = useMemo(() => {
    if (!fontBuffer) return null;
    return URL.createObjectURL(new Blob([fontBuffer], { type: 'font/ttf' }));
  }, [fontBuffer]);

  // Revoke old blob URL when fontBuffer changes
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
    if (!fontInfo || !fontUrl) {
      setFontReady(false);
      return;
    }
    // Create blob URLs for extra subset buffers (CJK fonts have multiple subsets)
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

  // Process glyphs and build a FontBundle
  const fontBundle = useMemo(() => {
    if (!fontInfo || !fontUrl) return null;

    const glyphData: TegakiBundle['glyphData'] = {};
    const optionsKey = JSON.stringify(options);

    const seen = new Set<string>();
    for (const char of text) {
      if (seen.has(char) || char === ' ' || char === '\n') continue;
      seen.add(char);

      const cacheKey = `${char}:${optionsKey}`;
      let res = resultsCache.current.get(cacheKey);
      if (!res) {
        res = processGlyph(fontInfo, char, options) ?? undefined;
        if (res) resultsCache.current.set(cacheKey, res);
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
  }, [fontInfo, fontUrl, text, options, resultsCache]);

  const timeline = useMemo(() => (fontBundle ? computeTimeline(text, fontBundle) : { entries: [], totalDuration: 0 }), [text, fontBundle]);

  const prevTotalRef = useRef(timeline.totalDuration);

  // Auto-resume when text extends timeline. Guard against the initial 0→N transition
  // (font loading) so a URL-seeded pause isn't silently resumed on mount.
  useEffect(() => {
    if (prevTotalRef.current > 0 && timeline.totalDuration > prevTotalRef.current && timeRef.current >= prevTotalRef.current) {
      setPlaying(true);
    }
    prevTotalRef.current = timeline.totalDuration;
  }, [timeline.totalDuration]);

  // Clamp time when text shortens. Skip while the timeline is empty (font not loaded yet)
  // so URL-seeded `ct` isn't clamped to 0 before the real duration becomes known.
  useEffect(() => {
    if (timeline.totalDuration > 0 && timeRef.current > timeline.totalDuration) {
      timeRef.current = timeline.totalDuration;
      setDisplayTime(timeline.totalDuration);
    }
  }, [timeline.totalDuration]);

  // Persist the paused timeline position to the URL (controlled mode). We only sync
  // while paused — during playback the URL would update 60x/sec, which is both noisy
  // and not useful (the URL represents a specific frame to resume from). This covers
  // pause, seek (which forces `playing=false`), reset, and natural animation end.
  useEffect(() => {
    if (!playing) onCurrentTimeChange(displayTime);
  }, [playing, displayTime, onCurrentTimeChange]);

  // rAF playback loop (controlled mode only)
  useEffect(() => {
    if (timeMode !== 'controlled' || !playing || timeline.totalDuration <= 0) return;
    let lastTs: number | null = null;
    let raf: number;
    const tick = (ts: number) => {
      if (lastTs === null) {
        lastTs = ts;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      timeRef.current = Math.min(timeRef.current + dt * animSpeed, timeline.totalDuration);
      setDisplayTime(timeRef.current);
      if (timeRef.current >= timeline.totalDuration) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeMode, playing, timeline.totalDuration, animSpeed]);

  // Compute time prop for TegakiRenderer
  const timeProp: TimeControlProp =
    timeMode === 'controlled'
      ? displayTime
      : timeMode === 'uncontrolled'
        ? { mode: 'uncontrolled' as const, speed: animSpeed, loop, catchUp: catchUp || undefined }
        : 'css';

  const timingConfig = useMemo(() => {
    const strokeFn = getEasingFn(strokeEasing);
    const glyphFn = getEasingFn(glyphEasing);
    if (strokeFn === undefined && glyphFn === undefined) return undefined;
    return { ...(strokeFn !== undefined ? { strokeEasing: strokeFn } : {}), ...(glyphFn !== undefined ? { glyphEasing: glyphFn } : {}) };
  }, [strokeEasing, glyphEasing]);

  const activeEffectCount = effects ? Object.keys(effects).length : 0;

  const handleCopyEffects = useCallback(() => {
    const json = effects ? JSON.stringify(effects, null, 2) : '{}';
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [effects]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Text input */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-y"
          rows={2}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Type text to preview..."
        />
      </div>

      {/* Content area: preview + optional effects drawer */}
      <div className="flex-1 flex min-h-0">
        {/* Rendered text — CSS mode needs timeline-scope on a common ancestor */}
        <div
          className="flex-1 flex flex-col min-h-0 min-w-0"
          style={timeMode === 'css' ? ({ timelineScope: '--tegaki-scroll' } as React.CSSProperties) : undefined}
        >
          {timeMode === 'css' && (
            <style>
              {`@keyframes tegaki-scroll-progress {
                from { --tegaki-progress: 0; }
                to { --tegaki-progress: 1; }
              }`}
            </style>
          )}

          <div className="flex-1 flex items-start justify-start p-8 overflow-auto">
            {!fontInfo && <p className="text-gray-400">Load a font to get started</p>}
            {fontInfo && !fontReady && <p className="text-gray-500">Loading font...</p>}
            {fontBundle && fontReady && (
              <TegakiRenderer
                ref={rendererRef}
                className="w-full max-w-2xl"
                style={{
                  fontSize: `${fontSizePx}px`,
                  lineHeight: lineHeightRatio,
                  ...(timeMode === 'css'
                    ? ({
                        animation: 'tegaki-scroll-progress linear both',
                        animationTimeline: '--tegaki-scroll',
                      } as React.CSSProperties)
                    : undefined),
                }}
                text={text}
                time={timeProp}
                font={fontBundle}
                showOverlay={showOverlay}
                effects={effects}
                quality={quality}
                timing={timingConfig}
              />
            )}
          </div>

          {/* CSS mode: horizontal scroll bar */}
          {timeMode === 'css' && (
            <div
              className="border-t border-gray-200 bg-white"
              style={
                {
                  overflowX: 'scroll',
                  scrollTimeline: '--tegaki-scroll inline',
                } as React.CSSProperties
              }
            >
              <div style={{ width: '300%', height: 1 }} />
            </div>
          )}
        </div>

        {/* Effects drawer (right side) */}
        {showEffectsDrawer && (
          <aside className="w-64 min-w-64 border-l border-gray-200 bg-white overflow-y-auto flex flex-col">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Effects</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                    copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                  onClick={handleCopyEffects}
                  title="Copy effects as React JSX prop"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                {activeEffectCount > 0 && (
                  <button
                    type="button"
                    className="px-2 py-0.5 text-xs rounded cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-600"
                    onClick={() => {
                      onEffectsStateChange(DEFAULT_EFFECTS_STATE);
                      onCustomEffectsChange([]);
                    }}
                    title="Reset all effects"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-600 cursor-pointer px-1"
                  onClick={() => setShowEffectsDrawer(false)}
                  title="Close"
                >
                  {'\u2715'}
                </button>
              </div>
            </div>

            <div className="p-3 flex flex-col gap-4">
              {/* Glow */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={effectsState.glow.enabled}
                      onChange={(e) => updateEffect((s) => ({ ...s, glow: { ...s.glow, enabled: e.target.checked } }))}
                    />
                    Glow
                  </label>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer px-1"
                    onClick={() => addCustomEffect('glow')}
                    title="Add another glow"
                  >
                    +
                  </button>
                </div>
                {effectsState.glow.enabled && (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <EffectSlider
                      label="Radius"
                      value={effectsState.glow.radius as number}
                      min={1}
                      max={30}
                      step={1}
                      onChange={(v) => updateEffect((s) => ({ ...s, glow: { ...s.glow, radius: v } }))}
                    />
                    <EffectColor
                      label="Color"
                      value={effectsState.glow.color}
                      onChange={(v) => updateEffect((s) => ({ ...s, glow: { ...s.glow, color: v } }))}
                    />
                    <EffectSlider
                      label="Offset X"
                      value={effectsState.glow.offsetX}
                      min={-20}
                      max={20}
                      step={1}
                      onChange={(v) => updateEffect((s) => ({ ...s, glow: { ...s.glow, offsetX: v } }))}
                    />
                    <EffectSlider
                      label="Offset Y"
                      value={effectsState.glow.offsetY}
                      min={-20}
                      max={20}
                      step={1}
                      onChange={(v) => updateEffect((s) => ({ ...s, glow: { ...s.glow, offsetY: v } }))}
                    />
                  </div>
                )}
                {customEffects
                  .filter((e) => e.effect === 'glow')
                  .map((ce) => (
                    <CustomEffectControls key={ce.key} entry={ce} onUpdate={updateCustomEffect} onRemove={removeCustomEffect}>
                      <EffectSlider
                        label="Radius"
                        value={ce.config.radius as number}
                        min={1}
                        max={30}
                        step={1}
                        onChange={(v) => updateCustomEffect(ce.key, { config: { ...ce.config, radius: v } })}
                      />
                      <EffectColor
                        label="Color"
                        value={(ce.config.color as string) ?? '#00ccff'}
                        onChange={(v) => updateCustomEffect(ce.key, { config: { ...ce.config, color: v } })}
                      />
                      <EffectSlider
                        label="Offset X"
                        value={(ce.config.offsetX as number) ?? 0}
                        min={-20}
                        max={20}
                        step={1}
                        onChange={(v) => updateCustomEffect(ce.key, { config: { ...ce.config, offsetX: v } })}
                      />
                      <EffectSlider
                        label="Offset Y"
                        value={(ce.config.offsetY as number) ?? 0}
                        min={-20}
                        max={20}
                        step={1}
                        onChange={(v) => updateCustomEffect(ce.key, { config: { ...ce.config, offsetY: v } })}
                      />
                    </CustomEffectControls>
                  ))}
              </div>

              {/* Wobble */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectsState.wobble.enabled}
                    onChange={(e) => updateEffect((s) => ({ ...s, wobble: { ...s.wobble, enabled: e.target.checked } }))}
                  />
                  Wobble
                </label>
                {effectsState.wobble.enabled && (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <label className="flex items-center justify-between text-[11px] text-gray-500">
                      Mode
                      <select
                        className="px-1 py-0.5 border border-gray-300 rounded text-[11px] bg-white"
                        value={effectsState.wobble.mode}
                        onChange={(e) => updateEffect((s) => ({ ...s, wobble: { ...s.wobble, mode: e.target.value as 'sine' | 'noise' } }))}
                      >
                        <option value="sine">Sine</option>
                        <option value="noise">Noise</option>
                      </select>
                    </label>
                    <EffectSlider
                      label="Amplitude"
                      value={effectsState.wobble.amplitude}
                      min={0.5}
                      max={10}
                      step={0.5}
                      onChange={(v) => updateEffect((s) => ({ ...s, wobble: { ...s.wobble, amplitude: v } }))}
                    />
                    <EffectSlider
                      label="Frequency"
                      value={effectsState.wobble.frequency}
                      min={1}
                      max={20}
                      step={1}
                      onChange={(v) => updateEffect((s) => ({ ...s, wobble: { ...s.wobble, frequency: v } }))}
                    />
                  </div>
                )}
              </div>

              {/* Pressure Width */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectsState.pressureWidth.enabled}
                    onChange={(e) => updateEffect((s) => ({ ...s, pressureWidth: { ...s.pressureWidth, enabled: e.target.checked } }))}
                  />
                  Pressure Width
                </label>
                {effectsState.pressureWidth.enabled && (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <EffectSlider
                      label="Strength"
                      value={effectsState.pressureWidth.strength}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateEffect((s) => ({ ...s, pressureWidth: { ...s.pressureWidth, strength: v } }))}
                    />
                  </div>
                )}
              </div>

              {/* Taper */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectsState.taper.enabled}
                    onChange={(e) => updateEffect((s) => ({ ...s, taper: { ...s.taper, enabled: e.target.checked } }))}
                  />
                  Taper
                </label>
                {effectsState.taper.enabled && (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <EffectSlider
                      label="Start"
                      value={effectsState.taper.startLength}
                      min={0}
                      max={0.5}
                      step={0.05}
                      onChange={(v) => updateEffect((s) => ({ ...s, taper: { ...s.taper, startLength: v } }))}
                    />
                    <EffectSlider
                      label="End"
                      value={effectsState.taper.endLength}
                      min={0}
                      max={0.5}
                      step={0.05}
                      onChange={(v) => updateEffect((s) => ({ ...s, taper: { ...s.taper, endLength: v } }))}
                    />
                  </div>
                )}
              </div>

              {/* Gradient */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectsState.gradient.enabled}
                    onChange={(e) => updateEffect((s) => ({ ...s, gradient: { ...s.gradient, enabled: e.target.checked } }))}
                  />
                  Gradient
                </label>
                {effectsState.gradient.enabled && (
                  <div className="flex flex-col gap-1.5 pl-5">
                    <label className="flex items-center justify-between text-[11px] text-gray-500">
                      Preset
                      <select
                        className="px-1 py-0.5 border border-gray-300 rounded text-[11px] bg-white"
                        value={effectsState.gradient.colors === 'rainbow' ? 'rainbow' : 'custom'}
                        onChange={(e) =>
                          updateEffect((s) => ({
                            ...s,
                            gradient: {
                              ...s.gradient,
                              colors: e.target.value === 'rainbow' ? 'rainbow' : ['#ff0000', '#00ff00', '#0000ff'],
                            },
                          }))
                        }
                      >
                        <option value="rainbow">Rainbow</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    {effectsState.gradient.colors === 'rainbow' ? (
                      <>
                        <EffectSlider
                          label="Saturation"
                          value={effectsState.gradient.saturation}
                          min={0}
                          max={100}
                          step={5}
                          suffix="%"
                          onChange={(v) => updateEffect((s) => ({ ...s, gradient: { ...s.gradient, saturation: v } }))}
                        />
                        <EffectSlider
                          label="Lightness"
                          value={effectsState.gradient.lightness}
                          min={10}
                          max={90}
                          step={5}
                          suffix="%"
                          onChange={(v) => updateEffect((s) => ({ ...s, gradient: { ...s.gradient, lightness: v } }))}
                        />
                      </>
                    ) : (
                      <GradientColorStops
                        colors={Array.isArray(effectsState.gradient.colors) ? effectsState.gradient.colors : ['#ff0000', '#0000ff']}
                        onChange={(colors) => updateEffect((s) => ({ ...s, gradient: { ...s.gradient, colors } }))}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Quality: segment size + pixel ratio + clip text */}
              <div className="border-t border-gray-200 pt-3 flex flex-col gap-2">
                <label className="flex items-center justify-between text-xs text-gray-600">
                  Segment size
                  <span className="flex items-center gap-1">
                    <input
                      type="range"
                      className="w-24"
                      min={0.5}
                      max={10}
                      step={0.5}
                      value={quality.segmentSize}
                      onChange={(e) => onQualityChange({ ...quality, segmentSize: Number(e.target.value) })}
                    />
                    <span className="tabular-nums w-7 text-right text-gray-400">{quality.segmentSize}px</span>
                  </span>
                </label>
                <label className="flex items-center justify-between text-xs text-gray-600">
                  Pixel ratio
                  <span className="flex items-center gap-1">
                    <input
                      type="range"
                      className="w-24"
                      min={0.5}
                      max={4}
                      step={0.25}
                      value={quality.pixelRatio}
                      onChange={(e) => onQualityChange({ ...quality, pixelRatio: Number(e.target.value) })}
                    />
                    <span className="tabular-nums w-7 text-right text-gray-400">{quality.pixelRatio}x</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={!!quality.clipText}
                    onChange={(e) => onQualityChange({ ...quality, clipText: e.target.checked ? 2 : false })}
                  />
                  Clip to text
                </label>
                {!!quality.clipText && (
                  <label className="flex items-center justify-between text-xs text-gray-600 pl-4">
                    Stroke scale
                    <span className="flex items-center gap-1">
                      <input
                        type="range"
                        className="w-24"
                        min={1}
                        max={5}
                        step={0.5}
                        value={typeof quality.clipText === 'number' ? quality.clipText : 1}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          onQualityChange({ ...quality, clipText: v === 1 ? true : v });
                        }}
                      />
                      <span className="tabular-nums w-7 text-right text-gray-400">
                        {typeof quality.clipText === 'number' ? quality.clipText : 1}x
                      </span>
                    </span>
                  </label>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Controls */}
      <div className="border-t border-gray-200 bg-white px-3 py-1.5 flex flex-col gap-1.5">
        {/* Row 1: time mode + mode-specific controls */}
        <div className="flex items-center gap-3">
          {/* Time mode selector */}
          <div className="flex gap-0.5">
            {(['controlled', 'uncontrolled', 'css'] as const).map((m) => (
              <button
                type="button"
                key={m}
                className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                  timeMode === m ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                onClick={() => setTimeMode(m)}
              >
                {m === 'controlled' ? 'Controlled' : m === 'uncontrolled' ? 'Uncontrolled' : 'CSS'}
              </button>
            ))}
          </div>

          <span className="border-l border-gray-200 h-6" />

          {/* Controlled mode controls */}
          {timeMode === 'controlled' && (
            <>
              <button
                type="button"
                className="px-3 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  if (timeRef.current >= timeline.totalDuration) {
                    timeRef.current = 0;
                    setDisplayTime(0);
                  }
                  setPlaying(!playing);
                }}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                type="button"
                className="px-3 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  timeRef.current = 0;
                  setDisplayTime(0);
                  setPlaying(false);
                }}
              >
                Reset
              </button>
              <span className="text-xs tabular-nums text-gray-500 w-24">
                {displayTime.toFixed(2)}s / {timeline.totalDuration.toFixed(2)}s
              </span>
              <input
                type="range"
                className="flex-1 max-w-64"
                min={0}
                max={timeline.totalDuration}
                step={0.01}
                value={displayTime}
                onChange={(e) => {
                  const t = Number(e.target.value);
                  timeRef.current = t;
                  setDisplayTime(t);
                  setPlaying(false);
                }}
              />

              <span className="border-l border-gray-200 h-6" />

              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                Speed
                <input
                  type="range"
                  className="w-20"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={animSpeed}
                  onChange={(e) => onAnimSpeedChange(Number(e.target.value))}
                />
                <span className="tabular-nums text-gray-400 w-8">{animSpeed}x</span>
              </label>
            </>
          )}

          {/* Uncontrolled mode controls */}
          {timeMode === 'uncontrolled' && (
            <>
              <button
                type="button"
                className="px-3 py-1 border border-gray-300 rounded text-sm cursor-pointer hover:bg-gray-100"
                onClick={() => rendererRef.current?.engine?.restart()}
              >
                Restart
              </button>

              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                Speed
                <input
                  type="range"
                  className="w-20"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={animSpeed}
                  onChange={(e) => onAnimSpeedChange(Number(e.target.value))}
                />
                <span className="tabular-nums text-gray-400 w-8">{animSpeed}x</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
                Loop
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                Catch-up
                <input
                  type="range"
                  className="w-20"
                  min={0}
                  max={2}
                  step={0.1}
                  value={catchUp}
                  onChange={(e) => onCatchUpChange(Number(e.target.value))}
                />
                <span className="tabular-nums text-gray-400 w-8">{catchUp}</span>
              </label>
            </>
          )}

          {/* CSS mode: hint */}
          {timeMode === 'css' && <span className="text-xs text-gray-500">Scroll the bar above to control animation progress</span>}
        </div>

        {/* Row 2: display settings */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Size
            <input
              type="range"
              className="w-20"
              min={16}
              max={256}
              step={1}
              value={fontSizePx}
              onChange={(e) => onFontSizePxChange(Number(e.target.value))}
            />
            <span className="tabular-nums text-gray-400 w-10">{fontSizePx}px</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Line height
            <input
              type="range"
              className="w-20"
              min={0}
              max={3}
              step={0.1}
              value={lineHeightRatio}
              onChange={(e) => onLineHeightRatioChange(Number(e.target.value))}
            />
            <span className="tabular-nums text-gray-400 w-8">{lineHeightRatio}</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showOverlay} onChange={(e) => onShowOverlayChange(e.target.checked)} />
            Overlay
          </label>

          <span className="border-l border-gray-200 h-6" />

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Stroke easing
            <select
              className="px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
              value={strokeEasing}
              onChange={(e) => onStrokeEasingChange(e.target.value)}
            >
              {EASING_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key === 'default' ? 'Default (Ease Out Quad)' : p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Glyph easing
            <select
              className="px-1 py-0.5 border border-gray-300 rounded text-xs bg-white"
              value={glyphEasing}
              onChange={(e) => onGlyphEasingChange(e.target.value)}
            >
              {EASING_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key === 'default' ? 'Default (Linear)' : p.label}
                </option>
              ))}
            </select>
          </label>

          <span className="border-l border-gray-200 h-6" />

          <button
            type="button"
            className={`px-2 py-0.5 text-xs rounded cursor-pointer transition-colors ${
              showEffectsDrawer ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
            onClick={() => setShowEffectsDrawer(!showEffectsDrawer)}
          >
            Effects{activeEffectCount > 0 ? ` (${activeEffectCount})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Utility components ---

function ResetButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="text-gray-400 hover:text-gray-600 text-xs leading-none cursor-pointer"
      onClick={onClick}
      title="Reset to default"
    >
      {'\u21A9'}
    </button>
  );
}

function CustomEffectControls({
  entry,
  onUpdate,
  onRemove,
  children,
}: {
  entry: CustomEffect;
  onUpdate: (key: string, update: Partial<CustomEffect>) => void;
  onRemove: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-gray-200 pl-3 ml-1">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 cursor-pointer">
          <input type="checkbox" checked={entry.enabled} onChange={(e) => onUpdate(entry.key, { enabled: e.target.checked })} />
          {entry.key}
        </label>
        <button
          type="button"
          className="text-gray-400 hover:text-red-500 text-xs cursor-pointer px-1"
          onClick={() => onRemove(entry.key)}
          title={`Remove ${entry.key}`}
        >
          {'\u2212'}
        </button>
      </div>
      {entry.enabled && <div className="flex flex-col gap-1.5 pl-5">{children}</div>}
    </div>
  );
}

function EffectSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between text-[11px] text-gray-500">
      {label}
      <span className="flex items-center gap-1">
        <input
          type="range"
          className="w-24"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="tabular-nums w-7 text-right">
          {value}
          {suffix}
        </span>
      </span>
    </label>
  );
}

function EffectColor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between text-[11px] text-gray-500">
      {label}
      <input
        type="color"
        {...{ alpha: 'true' }}
        className="w-6 h-5 rounded border border-gray-300 cursor-pointer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function GradientColorStops({ colors, onChange }: { colors: string[]; onChange: (colors: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {colors.map((c, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            type="color"
            {...{ alpha: 'true' }}
            className="w-6 h-5 rounded border border-gray-300 cursor-pointer"
            value={c}
            onChange={(e) => {
              const next = [...colors];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <span className="text-[11px] text-gray-400 flex-1">{c}</span>
          {colors.length > 2 && (
            <button
              type="button"
              className="text-gray-400 hover:text-red-500 text-xs cursor-pointer px-0.5"
              onClick={() => onChange(colors.filter((_, j) => j !== i))}
            >
              {'\u2212'}
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer self-start"
        onClick={() => onChange([...colors, '#888888'])}
      >
        + Add color
      </button>
    </div>
  );
}

function SliderOption({
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  defaultValue?: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const isModified = defaultValue !== undefined && value !== defaultValue;
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs">
        <span className={`${isModified ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{label}</span>
        <span className="flex items-center gap-1">
          <ResetButton visible={isModified} onClick={() => onChange(defaultValue!)} />
          <span className="text-gray-400 tabular-nums">{value}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function SelectOption<T extends string>({
  label,
  value,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  value: T;
  defaultValue?: T;
  options: { value: T; label: string }[];
  onChange: (v: string) => void;
}) {
  const isModified = defaultValue !== undefined && value !== defaultValue;
  return (
    <label className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className={`text-xs ${isModified ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>{label}</span>
        <ResetButton visible={isModified} onClick={() => onChange(defaultValue!)} />
      </div>
      <select
        className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// --- Font loading ---

/**
 * Fetch a Google Font from the Fontsource CDN (CORS-enabled, no server needed).
 *
 * First queries the Fontsource API for available subsets, then downloads the Latin
 * subset as primary and any extra subsets (e.g., japanese, korean, cyrillic) as
 * additional font files. This enables CJK and other non-Latin fonts to work.
 */
async function fetchFontFromCDN(family: string): Promise<{ primary: ArrayBuffer; extra: ArrayBuffer[] }> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const baseUrl = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest`;

  // Fetch font metadata to discover which subsets are available
  let subsets: string[] = ['latin'];
  try {
    const metaResp = await fetch(`https://api.fontsource.org/v1/fonts/${slug}`);
    if (metaResp.ok) {
      const meta: { subsets?: string[] } = await metaResp.json();
      if (meta.subsets?.length) subsets = meta.subsets;
    }
  } catch {
    // Fall back to just latin if metadata fetch fails
  }

  // Always fetch latin as the primary (carries font metrics)
  const latinResp = await fetch(`${baseUrl}/latin-400-normal.ttf`);
  if (!latinResp.ok) {
    throw new Error(`Font "${family}" not found on CDN (${latinResp.status}). Try uploading a .ttf file instead.`);
  }
  const primary = await latinResp.arrayBuffer();

  // Download all other available subsets in parallel
  // Some subsets may only have woff2 (not TTF), so 404s are silently skipped
  const extraSubsets = subsets.filter((s) => s !== 'latin');
  const extraResults = await Promise.allSettled(
    extraSubsets.map(async (subset) => {
      const resp = await fetch(`${baseUrl}/${subset}-400-normal.ttf`);
      if (!resp.ok) return null;
      return resp.arrayBuffer();
    }),
  );

  const extra = extraResults
    .filter((r): r is PromiseFulfilledResult<ArrayBuffer | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((buf): buf is ArrayBuffer => buf !== null);

  return { primary, extra };
}

// --- Layout utilities ---

/** Scale (w, h) to fit within maxSize while preserving aspect ratio */
function fitSize(w: number, h: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(maxSize / w, maxSize / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
