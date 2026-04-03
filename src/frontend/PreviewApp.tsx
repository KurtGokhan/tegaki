import { zipSync } from 'fflate';
import { forwardRef, type SVGProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type BrowserSkeletonMethod,
  DEFAULT_OPTIONS,
  extractTegakiBundle,
  type ParsedFontInfo,
  type PipelineOptions,
  type PipelineResult,
  parseFont,
  processGlyph,
} from '../commands/generate.ts';
import { EXAMPLE_FONTS } from '../constants.ts';
import { computeTimeline, TegakiRenderer } from '../lib/TegakiRenderer.tsx';
import { glyphToAnimatedSVG } from '../processing/animated-svg.ts';
import { renderStage, STROKE_COLORS, type VisualizationStage } from '../processing/visualize.ts';
import type { LineCap, TegakiBundle } from '../types.ts';
import { parseUrlState, syncUrlState } from './url-state.ts';

type PreviewMode = 'glyph' | 'text';

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

const SKELETON_METHODS: { value: BrowserSkeletonMethod; label: string }[] = [
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
  const [fontInfo, setFontInfo] = useState<ParsedFontInfo | null>(null);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontError, setFontError] = useState('');
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
  const [showOverlay, setShowOverlay] = useState(initialUrlState.showOverlay);

  // Animation state (lifted up so controls live outside the canvas area)
  const [animPlaying, setAnimPlaying] = useState(true);
  const [animTime, setAnimTime] = useState(0);
  const prevAnimResultRef = useRef<PipelineResult | null>(null);

  // Cache of results per character
  const resultsCache = useRef(new Map<string, PipelineResult>());

  const loadFont = useCallback(async (family: string) => {
    setFontLoading(true);
    setFontError('');
    resultsCache.current.clear();
    try {
      const buffer = await fetchFontFromCDN(family);
      const info = parseFont(buffer);
      setFontInfo(info);
      setFontBuffer(buffer);
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
        showOverlay,
      });
    }, 300);
    return () => clearTimeout(syncTimerRef.current);
  }, [fontFamily, chars, selectedChar, activeStage, previewMode, previewText, options, animSpeed, fontSizePx, showOverlay]);

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
  }, [fontInfo, fontBuffer, chars, options]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-80 min-w-80 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Tegaki preview</h1>
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
                  onClick={() => {
                    setFontFamily(f);
                    loadFont(f);
                  }}
                  disabled={fontLoading}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadFont(fontFamily)}
                placeholder="Google Fonts family"
              />
              <button
                type="button"
                className="px-3 py-1 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 disabled:opacity-50"
                onClick={() => loadFont(fontFamily)}
                disabled={fontLoading}
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
            <legend className="text-sm font-medium text-gray-600 mb-1">Characters</legend>
            <textarea
              className="px-2 py-1 border border-gray-300 rounded text-sm font-mono h-16 resize-y"
              value={chars}
              onChange={(e) => setChars(e.target.value)}
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
              onChange={(v) => updateOption('skeletonMethod', v as BrowserSkeletonMethod)}
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
                  className={`w-8 h-8 flex items-center justify-center text-sm font-mono rounded cursor-pointer transition-colors ${
                    c === selectedChar ? 'bg-gray-800 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
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
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              {processing && <p className="text-gray-500">Processing...</p>}
              {!processing && !result && fontInfo && <p className="text-gray-400">No glyph data for "{selectedChar}"</p>}
              {!processing && !fontInfo && <p className="text-gray-400">Load a font to get started</p>}
              {!processing && result && <StageRenderer result={result} stage={activeStage} animTime={animTime} />}
            </div>

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
            options={options}
            text={previewText}
            onTextChange={setPreviewText}
            resultsCache={resultsCache}
            animSpeed={animSpeed}
            onAnimSpeedChange={setAnimSpeed}
            fontSizePx={fontSizePx}
            onFontSizePxChange={setFontSizePx}
            showOverlay={showOverlay}
            onShowOverlayChange={setShowOverlay}
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

/** Create a React SVG component from an SVG string (produced by glyphToAnimatedSVG) */
function createGlyphComponent(svgString: string) {
  return forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => {
    const callbackRef = useCallback(
      (wrapper: HTMLSpanElement | null) => {
        const svg = wrapper?.querySelector('svg') ?? null;
        if (svg && props.style) Object.assign(svg.style, props.style);
        if (typeof ref === 'function') ref(svg);
        else if (ref) ref.current = svg;
      },
      [ref, props.style],
    );
    // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from glyphToAnimatedSVG is trusted
    return <span ref={callbackRef} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: svgString }} />;
  });
}

function TextPreview({
  fontInfo,
  fontBuffer,
  options,
  text,
  onTextChange,
  resultsCache,
  animSpeed,
  onAnimSpeedChange,
  fontSizePx,
  onFontSizePxChange,
  showOverlay,
  onShowOverlayChange,
}: {
  fontInfo: ParsedFontInfo | null;
  fontBuffer: ArrayBuffer | null;
  options: PipelineOptions;
  text: string;
  onTextChange: (text: string) => void;
  resultsCache: React.RefObject<Map<string, PipelineResult>>;
  animSpeed: number;
  onAnimSpeedChange: (v: number) => void;
  fontSizePx: number;
  onFontSizePxChange: (v: number) => void;
  showOverlay: boolean;
  onShowOverlayChange: (v: boolean) => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const timeRef = useRef(0);
  const [fontReady, setFontReady] = useState(false);

  // Synchronous font change detection — reset all font-dependent state BEFORE rendering
  // so TegakiRenderer never sees stale fontReady, displayTime, or glyph components.
  const componentCache = useRef(new Map<string, React.FC<SVGProps<SVGSVGElement>>>());
  const prevFontInfoForReset = useRef(fontInfo);
  if (prevFontInfoForReset.current !== fontInfo) {
    prevFontInfoForReset.current = fontInfo;
    componentCache.current.clear();
    if (fontReady) setFontReady(false);
    timeRef.current = 0;
    if (displayTime !== 0) setDisplayTime(0);
    if (!playing) setPlaying(true);
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
    const face = new FontFace(fontInfo.family, `url(${fontUrl})`, {
      featureSettings: '"calt" 0, "liga" 0',
    });
    let cancelled = false;
    face.load().then((loaded) => {
      if (cancelled) return;
      document.fonts.add(loaded);
      setFontReady(true);
    });
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [fontInfo, fontUrl]);

  // Process glyphs and build a FontBundle (glyph components are cached via resultsCache + componentCache)
  const fontBundle = useMemo(() => {
    if (!fontInfo || !fontUrl) return null;

    const glyphs: Record<string, React.FC<SVGProps<SVGSVGElement>>> = {};
    const glyphTimings: Record<string, number> = {};
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

      // Reuse existing component if the pipeline result is the same
      let component = componentCache.current.get(cacheKey);
      if (!component) {
        const svg = glyphToAnimatedSVG(res.strokesFontUnits, res.advanceWidth, res.ascender, res.descender, res.lineCap);
        component = createGlyphComponent(svg);
        componentCache.current.set(cacheKey, component);
      }
      glyphs[char] = component;

      const last = res.strokesFontUnits[res.strokesFontUnits.length - 1];
      glyphTimings[char] = last ? Math.round((last.delay + last.animationDuration) * 1000) / 1000 : 0;
    }

    return {
      family: fontInfo.family,
      lineCap: fontInfo.lineCap,
      fontUrl,
      unitsPerEm: fontInfo.unitsPerEm,
      ascender: fontInfo.ascender,
      descender: fontInfo.descender,
      glyphs,
      glyphTimings,
      registerFontFace: async () => {},
    } satisfies TegakiBundle;
  }, [fontInfo, fontUrl, text, options, resultsCache]);

  const timeline = useMemo(() => (fontBundle ? computeTimeline(text, fontBundle) : { entries: [], totalDuration: 0 }), [text, fontBundle]);

  const prevTotalRef = useRef(timeline.totalDuration);

  // Auto-resume when text extends timeline
  useEffect(() => {
    if (timeline.totalDuration > prevTotalRef.current && timeRef.current >= prevTotalRef.current) {
      setPlaying(true);
    }
    prevTotalRef.current = timeline.totalDuration;
  }, [timeline.totalDuration]);

  // Clamp time when text shortens
  useEffect(() => {
    if (timeRef.current > timeline.totalDuration) {
      timeRef.current = timeline.totalDuration;
      setDisplayTime(timeline.totalDuration);
    }
  }, [timeline.totalDuration]);

  // rAF playback loop
  useEffect(() => {
    if (!playing || timeline.totalDuration <= 0) return;
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
  }, [playing, timeline.totalDuration, animSpeed]);

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

      {/* Rendered text */}
      <div className="flex-1 flex items-start justify-start p-8 overflow-auto">
        {!fontInfo && <p className="text-gray-400">Load a font to get started</p>}
        {fontInfo && !fontReady && <p className="text-gray-500">Loading font...</p>}
        {fontBundle && fontReady && (
          <TegakiRenderer
            className="w-full max-w-2xl"
            style={{ fontSize: `${fontSizePx}px` }}
            text={text}
            time={displayTime}
            font={fontBundle}
            showOverlay={showOverlay}
          />
        )}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-200 bg-white">
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

        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showOverlay} onChange={(e) => onShowOverlayChange(e.target.checked)} />
          Overlay
        </label>
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

/** Fetch a Google Font as TTF directly from the Fontsource CDN (CORS-enabled, no server needed) */
async function fetchFontFromCDN(family: string): Promise<ArrayBuffer> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-400-normal.ttf`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Font "${family}" not found on CDN (${resp.status}). Try uploading a .ttf file instead.`);
  }
  return resp.arrayBuffer();
}

// --- Layout utilities ---

/** Scale (w, h) to fit within maxSize while preserving aspect ratio */
function fitSize(w: number, h: number, maxSize: number): { width: number; height: number } {
  const scale = Math.min(maxSize / w, maxSize / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
