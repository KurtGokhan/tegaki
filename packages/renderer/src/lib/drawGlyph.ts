import type { LineCap, TegakiGlyphData } from '../types.ts';
import { findEffect, findEffects, type ResolvedEffect } from './effects.ts';

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
) {
  const scale = pos.fontSize / pos.unitsPerEm;
  const ox = pos.x;
  const oy = pos.y;

  const glowEffects = findEffects(effects, 'glow');
  const wobbleEffect = findEffect(effects, 'wobble');
  const pressureEffect = findEffect(effects, 'pressureWidth');
  const rainbowEffects = findEffects(effects, 'rainbow');

  // Pressure params (0 = uniform avg width, 1 = fully per-point width)
  const pressureAmount = pressureEffect ? Math.max(0, Math.min(pressureEffect.config.strength ?? 1, 1)) : 0;

  // Wobble params
  const wobbleAmplitude = wobbleEffect ? (wobbleEffect.config.amplitude ?? 1.5) : 0;
  const wobbleFrequency = wobbleEffect ? (wobbleEffect.config.frequency ?? 8) : 0;

  // Helper: apply wobble offset to a point in font units
  const wobbleX = (x: number, y: number, idx: number) => {
    if (!wobbleEffect) return x;
    return x + wobbleAmplitude * Math.sin(wobbleFrequency * (y * 0.01 + idx * 0.7) + seed);
  };
  const wobbleY = (x: number, y: number, idx: number) => {
    if (!wobbleEffect) return y;
    return y + wobbleAmplitude * Math.cos(wobbleFrequency * (x * 0.01 + idx * 0.5) + seed * 1.3);
  };

  // Helper: convert font-unit point to pixel
  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy + (y + pos.ascender) * scale;

  // Helper: rainbow color from progress (0-1)
  const rainbowColor = (progress: number, effect: ResolvedEffect<'rainbow'>) => {
    const saturation = effect.config.saturation ?? 80;
    const lightness = effect.config.lightness ?? 55;
    const hue = (progress * 360 + seed * 137.5) % 360;
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  };

  for (const stroke of glyph.strokes) {
    if (localTime < stroke.delay) continue;
    const elapsed = localTime - stroke.delay;
    const progress = Math.min(elapsed / stroke.animationDuration, 1);

    const pts = stroke.points;
    if (pts.length === 0) continue;

    const avgWidth = pts.reduce((s, p) => s + p.width, 0) / pts.length;
    const baseLineWidth = Math.max(avgWidth, 0.5) * scale;

    // --- Single-point dot ---
    if (pts.length === 1) {
      if (progress <= 0) continue;
      const p = pts[0]!;
      const dotX = px(wobbleX(p.x, p.y, 0));
      const dotY = py(wobbleY(p.x, p.y, 0));
      const perPointDot = Math.max(p.width, 0.5) * scale;
      const dotWidth = baseLineWidth + (perPointDot - baseLineWidth) * pressureAmount;

      // Glow passes for dots
      for (const glow of glowEffects) {
        ctx.save();
        ctx.shadowBlur = (glow.config.radius ?? 8) * scale;
        ctx.shadowColor = glow.config.color ?? color;
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
      ctx.fillStyle = rainbowEffects.length > 0 ? rainbowColor(0, rainbowEffects[0]!) : color;
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
      const dx = pts[j]!.x - pts[j - 1]!.x;
      const dy = pts[j]!.y - pts[j - 1]!.y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
    }

    const drawLen = totalLen * progress;
    if (drawLen <= 0) continue;

    // --- Collect drawable segments ---
    // Each segment is a pair of pixel-space points with metadata
    const segments: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      width0: number;
      width1: number;
      segProgress: number; // 0-1 progress along the full stroke
    }[] = [];

    let accumulated = 0;
    for (let j = 1; j < pts.length; j++) {
      const prev = pts[j - 1]!;
      const cur = pts[j]!;
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);

      if (accumulated + segLen <= drawLen) {
        segments.push({
          x0: px(wobbleX(prev.x, prev.y, j - 1)),
          y0: py(wobbleY(prev.x, prev.y, j - 1)),
          x1: px(wobbleX(cur.x, cur.y, j)),
          y1: py(wobbleY(cur.x, cur.y, j)),
          width0: prev.width,
          width1: cur.width,
          segProgress: (accumulated + segLen / 2) / totalLen,
        });
        accumulated += segLen;
      } else {
        // Partial segment
        const remaining = drawLen - accumulated;
        const frac = segLen > 0 ? remaining / segLen : 0;
        const ix = prev.x + dx * frac;
        const iy = prev.y + dy * frac;
        const iw = prev.width + (cur.width - prev.width) * frac;
        segments.push({
          x0: px(wobbleX(prev.x, prev.y, j - 1)),
          y0: py(wobbleY(prev.x, prev.y, j - 1)),
          x1: px(wobbleX(ix, iy, j)),
          y1: py(wobbleY(ix, iy, j)),
          width0: prev.width,
          width1: iw,
          segProgress: (accumulated + remaining / 2) / totalLen,
        });
        break;
      }
    }

    if (segments.length === 0) continue;

    // --- Subdivide long segments for smooth effect transitions ---
    const needsSubdivision = pressureAmount > 0 || rainbowEffects.length > 0 || !!wobbleEffect;
    if (needsSubdivision) {
      const maxSegLen = 2 * scale; // max ~2px per subsegment
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
            segProgress: seg.segProgress, // will be recalculated below
          });
        }
      }
      // Recalculate segProgress evenly across all subdivided segments
      for (let k = 0; k < subdivided.length; k++) {
        subdivided[k]!.segProgress = subdivided.length > 1 ? k / (subdivided.length - 1) : 0;
      }
      segments.length = 0;
      segments.push(...subdivided);
    }

    // Helper: compute segment line width, lerping between avg and per-point by pressureAmount
    const segWidth = (seg: (typeof segments)[0]) => {
      const perPoint = ((seg.width0 + seg.width1) / 2) * scale;
      return Math.max(baseLineWidth + (perPoint - baseLineWidth) * pressureAmount, 0.5 * scale);
    };

    const drawStrokePath = () => {
      if (pressureAmount > 0) {
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

    const drawRainbowPath = (effect: ResolvedEffect<'rainbow'>) => {
      for (const seg of segments) {
        ctx.strokeStyle = rainbowColor(seg.segProgress, effect);
        if (pressureAmount > 0) ctx.lineWidth = segWidth(seg);
        ctx.beginPath();
        ctx.moveTo(seg.x0, seg.y0);
        ctx.lineTo(seg.x1, seg.y1);
        ctx.stroke();
      }
    };

    ctx.lineCap = lineCap;
    ctx.lineJoin = 'round';

    // --- Glow passes ---
    for (const glow of glowEffects) {
      ctx.save();
      ctx.shadowBlur = (glow.config.radius ?? 8) * scale;
      ctx.shadowColor = glow.config.color ?? color;
      ctx.strokeStyle = glow.config.color ?? color;
      drawStrokePath();
      ctx.restore();
    }

    // --- Main stroke ---
    if (rainbowEffects.length > 0) {
      for (const rainbow of rainbowEffects) {
        drawRainbowPath(rainbow);
      }
    } else {
      ctx.strokeStyle = color;
      drawStrokePath();
    }
  }
}
