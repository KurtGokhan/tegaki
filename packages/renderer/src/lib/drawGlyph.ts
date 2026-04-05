import type { LineCap, TegakiGlyphData } from '../types.ts';
import { findEffect, findEffects, type ResolvedEffect } from './effects.ts';
import { resolveCSSLength } from './utils.ts';

interface GlyphPosition {
  /** X offset in CSS pixels */
  x: number;
  /** Y offset in CSS pixels (top of em square) */
  y: number;
  /** Font size in CSS pixels */
  fontSize: number;
  /** Units per em from the font */
  unitsPerEm: number;
  /** Font ascender in font units */
  ascender: number;
  /** Font descender in font units (negative) */
  descender: number;
}

// --- Color helpers ---

function parseColor(color: string): [number, number, number, number] {
  const h = color.replace('#', '');
  if (h.length === 3) {
    return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16), 1];
  }
  if (h.length === 4) {
    return [parseInt(h[0]! + h[0]!, 16), parseInt(h[1]! + h[1]!, 16), parseInt(h[2]! + h[2]!, 16), parseInt(h[3]! + h[3]!, 16) / 255];
  }
  if (h.length === 8) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
}

function lerpColor(a: [number, number, number, number], b: [number, number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  const al = a[3] + (b[3] - a[3]) * t;
  if (al >= 1) return `rgb(${r},${g},${bl})`;
  return `rgba(${r},${g},${bl},${al.toFixed(3)})`;
}

function gradientColor(progress: number, colors: string[], seed: number): string {
  if (colors.length === 0) return '#000';
  if (colors.length === 1) return colors[0]!;
  const t = (((progress + seed * 0.1) % 1) + 1) % 1;
  const scaledT = t * (colors.length - 1);
  const i = Math.min(Math.floor(scaledT), colors.length - 2);
  const frac = scaledT - i;
  return lerpColor(parseColor(colors[i]!), parseColor(colors[i + 1]!), frac);
}

function rainbowColor(progress: number, saturation: number, lightness: number, seed: number): string {
  const hue = (progress * 360 + seed * 137.5) % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// --- Noise helper for wobble ---

function hash(x: number): number {
  let h = (x * 2654435761) | 0;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff; // 0-1
}

function noise1d(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f); // smoothstep
  return hash(i + seed * 7919) * (1 - t) + hash(i + 1 + seed * 7919) * t;
}

/**
 * Draw a single glyph's strokes onto a canvas context, animated up to `localTime`.
 * `localTime` is seconds relative to this glyph's start (0 = glyph begins).
 */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: TegakiGlyphData,
  pos: GlyphPosition,
  localTime: number,
  lineCap: LineCap,
  color: string,
  effects: ResolvedEffect[] = [],
  seed = 0,
  segmentSize?: number,
) {
  const scale = pos.fontSize / pos.unitsPerEm;
  const ox = pos.x;
  const oy = pos.y;

  const glowEffects = findEffects(effects, 'glow');
  const wobbleEffect = findEffect(effects, 'wobble');
  const pressureEffect = findEffect(effects, 'pressureWidth');
  const taperEffect = findEffect(effects, 'taper');
  const gradientEffect = findEffect(effects, 'gradient');

  // Pressure params (0 = uniform avg width, 1 = fully per-point width)
  const pressureAmount = pressureEffect ? Math.max(0, Math.min(pressureEffect.config.strength ?? 1, 1)) : 0;

  // Wobble params
  const wobbleAmplitude = wobbleEffect ? (wobbleEffect.config.amplitude ?? 1.5) : 0;
  const wobbleFrequency = wobbleEffect ? (wobbleEffect.config.frequency ?? 8) : 0;
  const wobbleMode = wobbleEffect?.config.mode ?? 'sine';

  // Taper params
  const taperStart = taperEffect ? Math.max(0, Math.min(taperEffect.config.startLength ?? 0.15, 1)) : 0;
  const taperEnd = taperEffect ? Math.max(0, Math.min(taperEffect.config.endLength ?? 0.15, 1)) : 0;

  // Gradient params
  const gradientColors = gradientEffect?.config.colors;
  const isRainbow = gradientColors === 'rainbow';
  const gradientColorStops = Array.isArray(gradientColors) ? gradientColors : undefined;
  const gradientSaturation = gradientEffect?.config.saturation ?? 80;
  const gradientLightness = gradientEffect?.config.lightness ?? 55;

  // Helper: apply wobble offset to a point in font units
  const wobbleX = (x: number, y: number, idx: number) => {
    if (!wobbleEffect) return x;
    if (wobbleMode === 'noise') {
      return x + wobbleAmplitude * (noise1d(y * 0.1 + idx * 0.7, seed) * 2 - 1);
    }
    return x + wobbleAmplitude * Math.sin(wobbleFrequency * (y * 0.01 + idx * 0.7) + seed);
  };
  const wobbleY = (x: number, y: number, idx: number) => {
    if (!wobbleEffect) return y;
    if (wobbleMode === 'noise') {
      return y + wobbleAmplitude * (noise1d(x * 0.1 + idx * 0.5, seed * 1.3 + 1000) * 2 - 1);
    }
    return y + wobbleAmplitude * Math.cos(wobbleFrequency * (x * 0.01 + idx * 0.5) + seed * 1.3);
  };

  // Helper: convert font-unit point to pixel
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy + (y + pos.ascender) * scale;

  // Helper: get color for a given stroke progress
  const colorAt = (progress: number): string => {
    if (isRainbow) return rainbowColor(progress, gradientSaturation, gradientLightness, seed);
    if (gradientColorStops) return gradientColor(progress, gradientColorStops, seed);
    return color;
  };
  const hasGradient = !!gradientEffect;

  // Helper: taper multiplier (0-1) for a given stroke progress
  const taperMultiplier = (progress: number): number => {
    let m = 1;
    if (taperStart > 0 && progress < taperStart) m = Math.min(m, progress / taperStart);
    if (taperEnd > 0 && progress > 1 - taperEnd) m = Math.min(m, (1 - progress) / taperEnd);
    return m;
  };

  for (const stroke of glyph.s) {
    if (localTime < stroke.d) continue;
    const elapsed = localTime - stroke.d;
    const progress = Math.min(elapsed / stroke.a, 1);

    const pts = stroke.p;
    if (pts.length === 0) continue;

    const avgWidth = pts.reduce((s, p) => s + p[2], 0) / pts.length;
    const baseLineWidth = Math.max(avgWidth, 0.5) * scale;

    // --- Single-point dot ---
    if (pts.length === 1) {
      if (progress <= 0) continue;
      const p = pts[0]!;
      const dotX = px(wobbleX(p[0], p[1], 0));
      const dotY = py(wobbleY(p[0], p[1], 0));
      const perPointDot = Math.max(p[2], 0.5) * scale;
      let dotWidth = baseLineWidth + (perPointDot - baseLineWidth) * pressureAmount;
      dotWidth *= taperMultiplier(0.5);

      // Glow passes for dots
      for (const glow of glowEffects) {
        ctx.save();
        ctx.shadowBlur = resolveCSSLength(glow.config.radius ?? 8, pos.fontSize);
        ctx.shadowColor = glow.config.color ?? color;
        ctx.shadowOffsetX = (glow.config.offsetX ?? 0) * scale;
        ctx.shadowOffsetY = (glow.config.offsetY ?? 0) * scale;
        ctx.fillStyle = glow.config.color ?? color;
        ctx.beginPath();
        if (lineCap === 'round') {
          ctx.arc(dotX, dotY, dotWidth / 2, 0, Math.PI * 2);
        } else {
          ctx.rect(dotX - dotWidth / 2, dotY - dotWidth / 2, dotWidth, dotWidth);
        }
        ctx.fill();
        ctx.restore();
      }

      // Main dot
      ctx.fillStyle = colorAt(0);
      ctx.beginPath();
      if (lineCap === 'round') {
        ctx.arc(dotX, dotY, dotWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(dotX - dotWidth / 2, dotY - dotWidth / 2, dotWidth, dotWidth);
      }
      continue;
    }

    // --- Compute total path length ---
    let totalLen = 0;
    for (let j = 1; j < pts.length; j++) {
      const dx = pts[j]![0] - pts[j - 1]![0];
      const dy = pts[j]![1] - pts[j - 1]![1];
      totalLen += Math.sqrt(dx * dx + dy * dy);
    }

    const drawLen = totalLen * progress;
    if (drawLen <= 0) continue;

    // --- Collect drawable segments ---
    const segments: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      width0: number;
      width1: number;
      segProgress: number;
    }[] = [];

    let accumulated = 0;
    for (let j = 1; j < pts.length; j++) {
      const prev = pts[j - 1]!;
      const cur = pts[j]!;
      const dx = cur[0] - prev[0];
      const dy = cur[1] - prev[1];
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (accumulated + segLen <= drawLen) {
        segments.push({
          x0: px(wobbleX(prev[0], prev[1], j - 1)),
          y0: py(wobbleY(prev[0], prev[1], j - 1)),
          x1: px(wobbleX(cur[0], cur[1], j)),
          y1: py(wobbleY(cur[0], cur[1], j)),
          width0: prev[2],
          width1: cur[2],
          segProgress: (accumulated + segLen / 2) / totalLen,
        });
        accumulated += segLen;
      } else {
        const remaining = drawLen - accumulated;
        const frac = segLen > 0 ? remaining / segLen : 0;
        const ix = prev[0] + dx * frac;
        const iy = prev[1] + dy * frac;
        const iw = prev[2] + (cur[2] - prev[2]) * frac;
        segments.push({
          x0: px(wobbleX(prev[0], prev[1], j - 1)),
          y0: py(wobbleY(prev[0], prev[1], j - 1)),
          x1: px(wobbleX(ix, iy, j)),
          y1: py(wobbleY(ix, iy, j)),
          width0: prev[2],
          width1: iw,
          segProgress: (accumulated + remaining / 2) / totalLen,
        });
        break;
      }
    }

    if (segments.length === 0) continue;

    // Keep coarse segments for glow (shadowBlur is expensive per draw call)
    const coarseSegments = segments.slice();

    // --- Subdivide long segments for smooth effect transitions ---
    const effectsNeedSubdivision = pressureAmount > 0 || hasGradient || !!wobbleEffect || !!taperEffect;
    const resolvedSegmentSize = segmentSize ?? (effectsNeedSubdivision ? 2 : undefined);
    if (resolvedSegmentSize != null) {
      const maxSegLen = resolvedSegmentSize * scale;
      const subdivided: typeof segments = [];
      for (const seg of segments) {
        const dx = seg.x1 - seg.x0;
        const dy = seg.y1 - seg.y0;
        const len = Math.sqrt(dx * dx + dy * dy);
        const count = Math.max(1, Math.ceil(len / maxSegLen));
        for (let k = 0; k < count; k++) {
          const t0 = k / count;
          const t1 = (k + 1) / count;
          subdivided.push({
            x0: seg.x0 + dx * t0,
            y0: seg.y0 + dy * t0,
            x1: seg.x0 + dx * t1,
            y1: seg.y0 + dy * t1,
            width0: seg.width0 + (seg.width1 - seg.width0) * t0,
            width1: seg.width0 + (seg.width1 - seg.width0) * t1,
            segProgress: seg.segProgress,
          });
        }
      }
      for (let k = 0; k < subdivided.length; k++) {
        subdivided[k]!.segProgress = subdivided.length > 1 ? k / (subdivided.length - 1) : 0;
      }
      segments.length = 0;
      segments.push(...subdivided);
    }

    // Helper: compute segment line width with pressure and taper
    const segWidth = (seg: (typeof segments)[0]) => {
      const perPoint = ((seg.width0 + seg.width1) / 2) * scale;
      const w = Math.max(baseLineWidth + (perPoint - baseLineWidth) * pressureAmount, 0.5 * scale);
      return w * taperMultiplier(seg.segProgress);
    };

    const needsPerSegment = pressureAmount > 0 || taperEffect;

    const drawStrokePath = () => {
      if (needsPerSegment) {
        for (const seg of segments) {
          ctx.lineWidth = segWidth(seg);
          ctx.beginPath();
          ctx.moveTo(seg.x0, seg.y0);
          ctx.lineTo(seg.x1, seg.y1);
          ctx.stroke();
        }
      } else {
        ctx.lineWidth = baseLineWidth;
        ctx.beginPath();
        ctx.moveTo(segments[0]!.x0, segments[0]!.y0);
        for (const seg of segments) {
          ctx.lineTo(seg.x1, seg.y1);
        }
        ctx.stroke();
      }
    };

    const drawGradientPath = () => {
      for (const seg of segments) {
        ctx.strokeStyle = colorAt(seg.segProgress);
        if (needsPerSegment) ctx.lineWidth = segWidth(seg);
        ctx.beginPath();
        ctx.moveTo(seg.x0, seg.y0);
        ctx.lineTo(seg.x1, seg.y1);
        ctx.stroke();
      }
    };

    ctx.lineCap = lineCap;
    ctx.lineJoin = 'round';

    // --- Glow passes (use coarse segments to avoid expensive per-subsegment shadowBlur) ---
    for (const glow of glowEffects) {
      ctx.save();
      ctx.shadowBlur = resolveCSSLength(glow.config.radius ?? 8, pos.fontSize);
      ctx.shadowColor = glow.config.color ?? color;
      ctx.shadowOffsetX = (glow.config.offsetX ?? 0) * scale;
      ctx.shadowOffsetY = (glow.config.offsetY ?? 0) * scale;
      ctx.strokeStyle = glow.config.color ?? color;
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.moveTo(coarseSegments[0]!.x0, coarseSegments[0]!.y0);
      for (const seg of coarseSegments) {
        ctx.lineTo(seg.x1, seg.y1);
      }
      ctx.stroke();
      ctx.restore();
    }

    // --- Main stroke ---
    if (hasGradient) {
      drawGradientPath();
    } else {
      ctx.strokeStyle = color;
      drawStrokePath();
    }
  }
}
