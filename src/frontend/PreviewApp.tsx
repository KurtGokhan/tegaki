import { zipSync } from 'fflate';
import { forwardRef, type SVGProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CHARS, EXAMPLE_FONTS } from '../constants.ts';
import { computeTimeline, Tegaki } from '../lib/TegakiRenderer.tsx';
import { charToFilename, glyphToAnimatedSVG } from '../processing/animated-svg.ts';
import type { FontBundle, FontOutput, LineCap } from '../types.ts';
import {
  type BrowserSkeletonMethod,
  DEFAULT_OPTIONS,
  type ParsedFontInfo,
  type PipelineOptions,
  type PipelineResult,
  parseFont,
  processGlyph,
} from './pipeline.ts';

type PreviewMode = 'glyph' | 'text';

const STROKE_COLORS = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990'];

type Stage = 'outline' | 'flattened' | 'bitmap' | 'skeleton' | 'overlay' | 'distance' | 'traced' | 'strokes' | 'animation' | 'final';

const STAGES: { key: Stage; label: string }[] = [
  { key: 'outline', label: 'Outline' },
  { key: 'flattened', label: 'Flattened' },
  { key: 'bitmap', label: 'Bitmap' },
  { key: 'skeleton', label: 'Skeleton' },
  { key: 'overlay', label: 'Overlay' },
  { key: 'distance', label: 'Distance' },
  { key: 'traced', label: 'Traced' },
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
  const [fontFamily, setFontFamily] = useState('Caveat');
  const [fontInfo, setFontInfo] = useState<ParsedFontInfo | null>(null);
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontLoading, setFontLoading] = useState(false);
  const [fontError, setFontError] = useState('');
  const [chars, setChars] = useState(DEFAULT_CHARS);
  const [selectedChar, setSelectedChar] = useState('A');
  const [activeStage, setActiveStage] = useState<Stage>('final');
  const [options, setOptions] = useState<PipelineOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('glyph');
  const [previewText, setPreviewText] = useState('Hello World');

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

  const updateOption = useCallback(<K extends keyof PipelineOptions>(key: K, value: PipelineOptions[K]) => {
    resultsCache.current.clear();
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!fontInfo || !fontBuffer) return;
    setDownloading(true);
    try {
      // Process all characters (use setTimeout to keep UI responsive)
      const lineCap: LineCap = options.lineCap === 'auto' ? fontInfo.lineCap : options.lineCap;
      const output: FontOutput = {
        font: {
          family: fontInfo.family,
          style: fontInfo.style,
          unitsPerEm: fontInfo.unitsPerEm,
          ascender: fontInfo.ascender,
          descender: fontInfo.descender,
          lineCap,
        },
        glyphs: {},
      };

      const optionsKey = JSON.stringify(options);
      for (const char of chars) {
        const cacheKey = `${char}:${optionsKey}`;
        let res = resultsCache.current.get(cacheKey);
        if (!res) {
          res = processGlyph(fontInfo, char, options) ?? undefined;
          if (res) resultsCache.current.set(cacheKey, res);
        }
        if (!res) continue;

        const { strokesFontUnits, polylines, transform } = res;
        const skeletonFontUnits = polylines.map((pl) =>
          pl.map((p) => ({
            x: Math.round((p.x / transform.scaleX + transform.offsetX) * 100) / 100,
            y: Math.round((p.y / transform.scaleY + transform.offsetY) * 100) / 100,
          })),
        );

        output.glyphs[char] = {
          char: res.char,
          unicode: res.unicode,
          advanceWidth: res.advanceWidth,
          boundingBox: res.boundingBox,
          path: res.pathString,
          skeleton: skeletonFontUnits,
          strokes: strokesFontUnits,
          totalLength: Math.round(strokesFontUnits.reduce((sum, s) => sum + s.length, 0) * 100) / 100,
          totalAnimationDuration:
            strokesFontUnits.length > 0
              ? Math.round(
                  (strokesFontUnits[strokesFontUnits.length - 1]!.delay +
                    strokesFontUnits[strokesFontUnits.length - 1]!.animationDuration) *
                    1000,
                ) / 1000
              : 0,
        };
      }

      // Build ZIP
      const encoder = new TextEncoder();
      const slug = fontInfo.family.toLowerCase().replace(/\s+/g, '-');
      const files: Record<string, Uint8Array> = {};

      files[`${slug}/font.json`] = encoder.encode(JSON.stringify(output, null, 2));
      files[`${slug}/${slug}.ttf`] = new Uint8Array(fontBuffer);

      const glyphEntries: { char: string; basename: string; totalAnimationDuration: number }[] = [];

      for (const glyph of Object.values(output.glyphs)) {
        const basename = charToFilename(glyph.char);
        const svg = glyphToAnimatedSVG(glyph.strokes, glyph.advanceWidth, fontInfo.ascender, fontInfo.descender, lineCap);
        files[`${slug}/svg/${basename}.svg`] = encoder.encode(svg);
        files[`${slug}/svg/${basename}.tsx`] = encoder.encode(svgToTsx(svg));
        glyphEntries.push({ char: glyph.char, basename, totalAnimationDuration: glyph.totalAnimationDuration });
      }

      files[`${slug}/glyphs.ts`] = encoder.encode(generateGlyphsModule(glyphEntries, `${slug}.ttf`, fontInfo.family, lineCap));

      const zip = zipSync(files);
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
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold">Tegaki preview</h1>
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
          />
        )}
      </main>
    </div>
  );
}

// --- Rendering components ---

function StageRenderer({ result, stage, animTime }: { result: PipelineResult; stage: Stage; animTime: number }) {
  switch (stage) {
    case 'outline':
      return <OutlineView result={result} />;
    case 'flattened':
      return <FlattenedView result={result} />;
    case 'bitmap':
      return <BitmapView bitmap={result.bitmap} width={result.bitmapWidth} height={result.bitmapHeight} />;
    case 'skeleton':
      return <BitmapView bitmap={result.skeleton} width={result.bitmapWidth} height={result.bitmapHeight} color="#e6194b" />;
    case 'overlay':
      return <OverlayView result={result} />;
    case 'distance':
      return <DistanceView result={result} />;
    case 'traced':
      return <TracedView result={result} />;
    case 'strokes':
      return <StrokesView result={result} />;
    case 'animation':
      return <AnimationView result={result} time={animTime} />;
    case 'final':
      return <FinalView result={result} time={animTime} />;
  }
}

function OutlineView({ result }: { result: PipelineResult }) {
  const { pathBBox: bb, pathString } = result;
  const pad = 20;
  const vx = bb.x1 - pad;
  const vy = bb.y1 - pad;
  const vw = bb.x2 - bb.x1 + 2 * pad;
  const vh = bb.y2 - bb.y1 + 2 * pad;
  const { width, height } = fitSize(vw, vh, 600);

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="max-w-full max-h-full" style={{ width, height }}>
      <rect x={vx} y={vy} width={vw} height={vh} fill="white" />
      <path d={pathString} fill="rgba(0,0,0,0.1)" stroke="black" strokeWidth={vw / 300} />
    </svg>
  );
}

function FlattenedView({ result }: { result: PipelineResult }) {
  const { subPaths, pathBBox: bb } = result;
  const pad = 20;
  const vx = bb.x1 - pad;
  const vy = bb.y1 - pad;
  const vw = bb.x2 - bb.x1 + 2 * pad;
  const vh = bb.y2 - bb.y1 + 2 * pad;
  const { width, height } = fitSize(vw, vh, 600);

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="max-w-full max-h-full" style={{ width, height }}>
      <rect x={vx} y={vy} width={vw} height={vh} fill="white" />
      {subPaths.map((path, i) => {
        const d = path.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return <path key={i} d={d} fill="none" stroke={STROKE_COLORS[i % STROKE_COLORS.length]} strokeWidth={vw / 400} />;
      })}
      {subPaths.flatMap((path, pi) =>
        path.map((p, j) => (
          <circle key={`${pi}-${j}`} cx={p.x} cy={p.y} r={vw / 500} fill={STROKE_COLORS[pi % STROKE_COLORS.length]} opacity={0.5} />
        )),
      )}
    </svg>
  );
}

function BitmapView({ bitmap, width, height, color }: { bitmap: Uint8Array; width: number; height: number; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const fg = color ? parseColor(color) : [0, 0, 0];
    for (let i = 0; i < bitmap.length; i++) {
      const base = i * 4;
      if (bitmap[i]) {
        imageData.data[base] = fg[0]!;
        imageData.data[base + 1] = fg[1]!;
        imageData.data[base + 2] = fg[2]!;
        imageData.data[base + 3] = 255;
      } else {
        imageData.data[base] = 255;
        imageData.data[base + 1] = 255;
        imageData.data[base + 2] = 255;
        imageData.data[base + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [bitmap, width, height, color]);

  const { width: dw, height: dh } = fitSize(width, height, 600);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-full border border-gray-200"
      style={{ imageRendering: 'pixelated', width: dw, height: dh }}
    />
  );
}

function OverlayView({ result }: { result: PipelineResult }) {
  const { bitmap, skeleton, bitmapWidth: w, bitmapHeight: h } = result;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(w, h);
    for (let i = 0; i < bitmap.length; i++) {
      const base = i * 4;
      if (skeleton[i]) {
        imageData.data[base] = 230;
        imageData.data[base + 1] = 25;
        imageData.data[base + 2] = 75;
        imageData.data[base + 3] = 255;
      } else if (bitmap[i]) {
        imageData.data[base] = 220;
        imageData.data[base + 1] = 220;
        imageData.data[base + 2] = 220;
        imageData.data[base + 3] = 255;
      } else {
        imageData.data[base] = 255;
        imageData.data[base + 1] = 255;
        imageData.data[base + 2] = 255;
        imageData.data[base + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [bitmap, skeleton, w, h]);

  const { width: dw, height: dh } = fitSize(w, h, 600);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-full border border-gray-200"
      style={{ imageRendering: 'pixelated', width: dw, height: dh }}
    />
  );
}

function DistanceView({ result }: { result: PipelineResult }) {
  const { inverseDT, bitmap, bitmapWidth: w, bitmapHeight: h } = result;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(w, h);

    // Find max DT value for normalization
    let maxDT = 0;
    for (let i = 0; i < inverseDT.length; i++) {
      if (bitmap[i] && inverseDT[i]! > maxDT) maxDT = inverseDT[i]!;
    }

    for (let i = 0; i < inverseDT.length; i++) {
      const base = i * 4;
      if (bitmap[i] && maxDT > 0) {
        const t = inverseDT[i]! / maxDT;
        // Heatmap: blue -> cyan -> green -> yellow -> red
        const [r, g, b] = heatmapColor(t);
        imageData.data[base] = r;
        imageData.data[base + 1] = g;
        imageData.data[base + 2] = b;
        imageData.data[base + 3] = 255;
      } else {
        imageData.data[base] = 255;
        imageData.data[base + 1] = 255;
        imageData.data[base + 2] = 255;
        imageData.data[base + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, [inverseDT, bitmap, w, h]);

  const { width: dw, height: dh } = fitSize(w, h, 600);

  return (
    <canvas
      ref={canvasRef}
      className="max-w-full max-h-full border border-gray-200"
      style={{ imageRendering: 'pixelated', width: dw, height: dh }}
    />
  );
}

function TracedView({ result }: { result: PipelineResult }) {
  const { polylines, bitmapWidth: w, bitmapHeight: h } = result;
  const { width: dw, height: dh } = fitSize(w, h, 600);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="max-w-full max-h-full border border-gray-200" style={{ width: dw, height: dh }}>
      <rect width={w} height={h} fill="white" />
      {polylines.map((pl, i) => {
        const color = STROKE_COLORS[i % STROKE_COLORS.length]!;
        if (pl.length === 1) {
          return <circle key={i} cx={pl[0]!.x} cy={pl[0]!.y} r={2} fill={color} />;
        }
        const d = pl.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        return <path key={i} d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {/* Mark endpoints */}
      {polylines.map((pl, i) => {
        const color = STROKE_COLORS[i % STROKE_COLORS.length]!;
        const start = pl[0]!;
        return <circle key={`start-${i}`} cx={start.x} cy={start.y} r={3} fill={color} opacity={0.8} />;
      })}
    </svg>
  );
}

function StrokesView({ result }: { result: PipelineResult }) {
  const { strokes, bitmapWidth: w, bitmapHeight: h, lineCap } = result;
  const { width: dw, height: dh } = fitSize(w, h, 600);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="max-w-full max-h-full border border-gray-200" style={{ width: dw, height: dh }}>
      <rect width={w} height={h} fill="white" />
      {strokes.map((stroke, i) => {
        const color = STROKE_COLORS[i % STROKE_COLORS.length]!;
        const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;

        if (stroke.points.length === 1) {
          const p = stroke.points[0]!;
          return lineCap === 'round' ? (
            <circle key={i} cx={p.x} cy={p.y} r={Math.max(avgWidth / 2, 1)} fill={color} opacity={0.7} />
          ) : (
            <rect
              key={i}
              x={p.x - Math.max(avgWidth / 2, 1)}
              y={p.y - Math.max(avgWidth / 2, 1)}
              width={Math.max(avgWidth, 2)}
              height={Math.max(avgWidth, 2)}
              fill={color}
              opacity={0.7}
            />
          );
        }

        const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        return (
          <g key={i}>
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(avgWidth, 1)}
              strokeLinecap={lineCap}
              strokeLinejoin="round"
              opacity={0.5}
            />
            <path d={d} fill="none" stroke={color} strokeWidth={1} strokeLinecap={lineCap} strokeLinejoin="round" />
            {/* Order label */}
            <circle cx={stroke.points[0]!.x} cy={stroke.points[0]!.y} r={6} fill={color} />
            <text
              x={stroke.points[0]!.x}
              y={stroke.points[0]!.y + 3.5}
              textAnchor="middle"
              fontSize={8}
              fill="white"
              fontFamily="sans-serif"
            >
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AnimationView({ result, time }: { result: PipelineResult; time: number }) {
  const { strokesFontUnits, lineCap, bitmapWidth: w, bitmapHeight: h, transform } = result;

  // Derive viewBox from bitmap transform so the aspect ratio exactly matches bitmap-based views.
  // The rasterizer maps font coords via: bitmapX = (fontX - offsetX) * scaleX
  // So the font-unit region covered by the bitmap is:
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
        const dashOffset = pathLen * (1 - progress);

        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(avgWidth, 0.5)}
            strokeLinecap={lineCap}
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={dashOffset}
          />
        );
      })}
    </svg>
  );
}

function FinalView({ result, time }: { result: PipelineResult; time: number }) {
  const { strokesFontUnits, lineCap, ascender, descender, advanceWidth, bitmapWidth: bw, bitmapHeight: bh } = result;

  // Use the production viewBox: full em-square, font coordinates
  const vx = 0;
  const vy = -ascender;
  const vw = advanceWidth;
  const vh = ascender - descender;
  // Display size derived from bitmap dimensions to match other views
  const { width: dw, height: dh } = fitSize(bw, bh, 600);

  return (
    <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} className="border border-gray-200" style={{ width: dw, height: dh }}>
      <rect x={vx} y={vy} width={vw} height={vh} fill="white" />
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
        const dashOffset = pathLen * (1 - progress);

        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(avgWidth, 0.5)}
            strokeLinecap={lineCap}
            strokeLinejoin="round"
            strokeDasharray={pathLen}
            strokeDashoffset={dashOffset}
          />
        );
      })}
    </svg>
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
}: {
  fontInfo: ParsedFontInfo | null;
  fontBuffer: ArrayBuffer | null;
  options: PipelineOptions;
  text: string;
  onTextChange: (text: string) => void;
  resultsCache: React.RefObject<Map<string, PipelineResult>>;
}) {
  const [playing, setPlaying] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const timeRef = useRef(0);
  const [fontReady, setFontReady] = useState(false);

  // Register font face (stable — only changes when font changes, not on text edits)
  const fontUrl = useMemo(() => {
    if (!fontBuffer) return null;
    return URL.createObjectURL(new Blob([fontBuffer], { type: 'font/ttf' }));
  }, [fontBuffer]);

  useEffect(() => {
    if (!fontInfo || !fontUrl) {
      setFontReady(false);
      return;
    }
    setFontReady(false);
    const face = new FontFace(fontInfo.family, `url(${fontUrl})`);
    face.load().then((loaded) => {
      document.fonts.add(loaded);
      setFontReady(true);
    });
  }, [fontInfo, fontUrl]);

  // Process glyphs and build a FontBundle (glyph components are cached via resultsCache + componentCache)
  const componentCache = useRef(new Map<string, React.FC<SVGProps<SVGSVGElement>>>());
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
      glyphs,
      glyphTimings,
      registerFontFace: async () => {},
    } satisfies FontBundle;
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
      timeRef.current = Math.min(timeRef.current + dt, timeline.totalDuration);
      setDisplayTime(timeRef.current);
      if (timeRef.current >= timeline.totalDuration) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timeline.totalDuration]);

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
      <div className="flex-1 flex items-start justify-center p-8 overflow-auto">
        {!fontInfo && <p className="text-gray-400">Load a font to get started</p>}
        {fontInfo && !fontReady && <p className="text-gray-500">Loading font...</p>}
        {fontBundle && fontReady && <Tegaki className="text-5xl w-full max-w-2xl" text={text} time={displayTime} font={fontBundle} />}
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-gray-200 bg-white h-11">
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

// --- Bundle generation utilities ---

/** SVG attribute name → JSX camelCase name */
const SVG_ATTR_MAP: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'font-size': 'fontSize',
  'font-family': 'fontFamily',
};

/** Convert an SVG string (from glyphToAnimatedSVG) to a SVGR-style TSX React component */
function svgToTsx(svg: string): string {
  // Convert hyphenated SVG attributes to camelCase JSX
  let jsx = svg;
  for (const [attr, jsxAttr] of Object.entries(SVG_ATTR_MAP)) {
    jsx = jsx.replaceAll(` ${attr}=`, ` ${jsxAttr}=`);
  }
  // Inject {...props} into the root <svg> tag
  jsx = jsx.replace(/<svg\s/, '<svg {...props} ');

  return `import type { SVGProps } from "react";
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (${jsx});
export default SvgComponent;
`;
}

/** Browser-compatible version of the CLI's generateGlyphsModule */
function generateGlyphsModule(
  entries: { char: string; basename: string; totalAnimationDuration: number }[],
  fontFileName: string,
  fontFamily: string,
  lineCap: LineCap,
): string {
  const imports: string[] = [];
  const mapEntries: string[] = [];
  const timingEntries: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const { char, basename: base, totalAnimationDuration } = entries[i]!;
    const varName = `_${i}`;
    imports.push(`import ${varName} from './svg/${base}.tsx';`);

    const escaped = char === '\\' ? '\\\\' : char === "'" ? "\\'" : char;
    mapEntries.push(`  '${escaped}': ${varName},`);
    timingEntries.push(`  '${escaped}': ${totalAnimationDuration},`);
  }

  return `// Auto-generated by Tegaki. Do not edit manually.
import fontUrl from './${fontFileName}' with { type: 'url' };

${imports.join('\n')}

let registered: Promise<void> | null = null;

const bundle = {
  family: '${fontFamily.replace(/'/g, "\\'")}',
  lineCap: '${lineCap}',
  fontUrl,
  glyphs: {
${mapEntries.join('\n')}
  },
  glyphTimings: {
${timingEntries.join('\n')}
  },
  registerFontFace() {
    if (!registered) {
      registered = new FontFace(bundle.family, \`url(\${fontUrl})\`)
        .load()
        .then((loaded) => { document.fonts.add(loaded); });
    }
    return registered;
  },
} as const;

export default bundle;
`;
}

// --- Color utilities ---

function parseColor(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function heatmapColor(t: number): [number, number, number] {
  // 0 = blue, 0.25 = cyan, 0.5 = green, 0.75 = yellow, 1 = red
  if (t < 0.25) {
    const s = t / 0.25;
    return [0, Math.round(s * 255), 255];
  }
  if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0, 255, Math.round((1 - s) * 255)];
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [Math.round(s * 255), 255, 0];
  }
  const s = (t - 0.75) / 0.25;
  return [255, Math.round((1 - s) * 255), 0];
}
