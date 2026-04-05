import { useEffect, useRef, useState } from 'react';
import { type TegakiBundle, TegakiRenderer } from 'tegaki';
import {
  DEFAULT_OPTIONS,
  EXAMPLE_FONTS,
  type ParsedFontInfo,
  type PipelineOptions,
  type PipelineResult,
  parseFont,
  processGlyph,
} from 'tegaki-generator';

const SHOWCASE_FONTS = EXAMPLE_FONTS.slice(0, 8);
const HERO_FONT = 'Caveat';
const HERO_TEXT = 'Hello, World!';
const SHOWCASE_TEXT = 'The quick brown fox';
const OPTIONS: PipelineOptions = DEFAULT_OPTIONS;

async function fetchFontFromCDN(family: string): Promise<ArrayBuffer> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const url = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-400-normal.ttf`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font "${family}" not found (${resp.status})`);
  return resp.arrayBuffer();
}

// --- Build a TegakiBundle from a parsed font ---

function buildBundle(fontInfo: ParsedFontInfo, fontUrl: string, text: string, cache: Map<string, PipelineResult>): TegakiBundle {
  const glyphData: TegakiBundle['glyphData'] = {};
  const optionsKey = JSON.stringify(OPTIONS);

  const seen = new Set<string>();
  for (const char of text) {
    if (seen.has(char) || char === ' ' || char === '\n') continue;
    seen.add(char);

    const cacheKey = `${char}:${optionsKey}`;
    let res = cache.get(cacheKey);
    if (!res) {
      res = processGlyph(fontInfo, char, OPTIONS) ?? undefined;
      if (res) cache.set(cacheKey, res);
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
    family: fontInfo.family,
    lineCap: fontInfo.lineCap,
    fontUrl,
    unitsPerEm: fontInfo.unitsPerEm,
    ascender: fontInfo.ascender,
    descender: fontInfo.descender,
    glyphData,
    registerFontFace: async () => {},
  };
}

// --- Single font showcase card ---

type FontState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; fontInfo: ParsedFontInfo; fontUrl: string; bundle: TegakiBundle };

function FontCard({ family, text, fontSize }: { family: string; text: string; fontSize?: number }) {
  const [state, setState] = useState<FontState>({ status: 'loading' });
  const resultsCache = useRef(new Map<string, PipelineResult>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buffer = await fetchFontFromCDN(family);
        if (cancelled) return;
        const fontInfo = parseFont(buffer);
        const fontUrl = URL.createObjectURL(new Blob([buffer], { type: 'font/ttf' }));

        // Register font face for text measurement
        const face = new FontFace(fontInfo.family, `url(${fontUrl})`, {
          featureSettings: '"calt" 0, "liga" 0',
        });
        const loaded = await face.load();
        if (cancelled) {
          URL.revokeObjectURL(fontUrl);
          return;
        }
        document.fonts.add(loaded);

        const bundle = buildBundle(fontInfo, fontUrl, text, resultsCache.current);
        setState({ status: 'ready', fontInfo, fontUrl, bundle });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [family, text]);

  return (
    <div className="group relative">
      <div className="mb-2 text-sm font-medium text-gray-500 tracking-wide">{family}</div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md" style={{ minHeight: 80 }}>
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            Loading font...
          </div>
        )}
        {state.status === 'error' && <div className="text-sm text-red-400">{state.message}</div>}
        {state.status === 'ready' && (
          <TegakiRenderer font={state.bundle} time={{ mode: 'uncontrolled', speed: 1, loop: true }} style={{ fontSize: fontSize ?? 36 }}>
            {text}
          </TegakiRenderer>
        )}
      </div>
    </div>
  );
}

// --- Hero section ---

function Hero() {
  const [state, setState] = useState<FontState>({ status: 'loading' });
  const resultsCache = useRef(new Map<string, PipelineResult>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buffer = await fetchFontFromCDN(HERO_FONT);
        if (cancelled) return;
        const fontInfo = parseFont(buffer);
        const fontUrl = URL.createObjectURL(new Blob([buffer], { type: 'font/ttf' }));
        const face = new FontFace(fontInfo.family, `url(${fontUrl})`, {
          featureSettings: '"calt" 0, "liga" 0',
        });
        const loaded = await face.load();
        if (cancelled) {
          URL.revokeObjectURL(fontUrl);
          return;
        }
        document.fonts.add(loaded);
        const bundle = buildBundle(fontInfo, fontUrl, HERO_TEXT, resultsCache.current);
        setState({ status: 'ready', fontInfo, fontUrl, bundle });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16">
      <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900">Tegaki</h1>
      <p className="mb-12 max-w-lg text-center text-lg text-gray-500">
        Animated handwriting from any Google Font. Generate stroke data, render beautiful writing animations in React.
      </p>
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            Preparing animation...
          </div>
        )}
        {state.status === 'error' && <div className="py-8 text-center text-red-400">{state.message}</div>}
        {state.status === 'ready' && (
          <TegakiRenderer font={state.bundle} time={{ mode: 'uncontrolled', speed: 1, loop: true }} style={{ fontSize: 64 }}>
            {HERO_TEXT}
          </TegakiRenderer>
        )}
      </div>
    </section>
  );
}

// --- Main page ---

export function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <span className="text-lg font-semibold tracking-tight text-gray-900">tegaki</span>
        <div className="flex gap-4 text-sm">
          <a href="/generator/" className="text-gray-500 hover:text-gray-900 transition-colors">
            Generator
          </a>
          <a href="/chat/" className="text-gray-500 hover:text-gray-900 transition-colors">
            Chat Demo
          </a>
        </div>
      </nav>

      {/* Hero */}
      <Hero />

      {/* Font showcase */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-2xl font-semibold text-gray-900">Font Showcase</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {SHOWCASE_FONTS.map((family) => (
            <FontCard key={family} family={family} text={SHOWCASE_TEXT} />
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-200 bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-12 text-2xl font-semibold text-gray-900">How it works</h2>
          <div className="grid gap-12 sm:grid-cols-3">
            <div>
              <div className="mb-3 text-3xl">1</div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">Generate</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                The generator CLI downloads any Google Font, extracts glyph outlines, rasterizes them, computes skeletons, and traces stroke
                paths with width and timing data.
              </p>
            </div>
            <div>
              <div className="mb-3 text-3xl">2</div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">Bundle</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Stroke data is packaged into a compact bundle with glyph metrics and timing information ready for the renderer.
              </p>
            </div>
            <div>
              <div className="mb-3 text-3xl">3</div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">Render</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Drop the <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">TegakiRenderer</code> React component into your app. It
                handles text layout, line wrapping, and smooth animation playback.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-400">Tegaki — Animated handwriting for the web</footer>
    </div>
  );
}
