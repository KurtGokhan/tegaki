import { findEffect, findEffects, type ResolvedEffect } from './effects.ts';
import { resolveCSSLength } from './utils.ts';

/**
 * Draw a fallback glyph (plain text) with applicable effects (glow, gradient, wobble).
 */
export function drawFallbackGlyph(
  ctx: CanvasRenderingContext2D,
  char: string,
  x: number,
  baseline: number,
  fontSize: number,
  fontFamily: string,
  color: string,
  effects: ResolvedEffect[] = [],
  seed = 0,
) {
  const glowEffects = findEffects(effects, 'glow');
  const wobbleEffect = findEffect(effects, 'wobble');
  const gradientEffect = findEffect(effects, 'gradient');

  // Wobble offsets
  let dx = 0;
  let dy = 0;
  if (wobbleEffect) {
    const amplitude = (wobbleEffect.config.amplitude ?? 1.5) * (fontSize / 100);
    const frequency = wobbleEffect.config.frequency ?? 8;
    dx = amplitude * Math.sin(frequency * (baseline * 0.01) + seed);
    dy = amplitude * Math.cos(frequency * (x * 0.01) + seed * 1.3);
  }

  const drawX = x + dx;
  const drawY = baseline + dy;

  // Gradient / rainbow color
  let fillColor = color;
  if (gradientEffect) {
    const colors = gradientEffect.config.colors;
    if (colors === 'rainbow') {
      const saturation = gradientEffect.config.saturation ?? 80;
      const lightness = gradientEffect.config.lightness ?? 55;
      const hue = (seed * 137.5) % 360;
      fillColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } else if (Array.isArray(colors) && colors.length > 0) {
      fillColor = colors[Math.floor(seed) % colors.length]!;
    }
  }

  ctx.save();
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'alphabetic';

  // Glow passes
  for (const glow of glowEffects) {
    ctx.save();
    ctx.shadowBlur = resolveCSSLength(glow.config.radius ?? 8, fontSize);
    ctx.shadowColor = glow.config.color ?? color;
    ctx.shadowOffsetX = glow.config.offsetX ?? 0;
    ctx.shadowOffsetY = glow.config.offsetY ?? 0;
    ctx.fillStyle = glow.config.color ?? color;
    ctx.fillText(char, drawX, drawY);
    ctx.restore();
  }

  // Main text
  ctx.fillStyle = fillColor;
  ctx.fillText(char, drawX, drawY);

  ctx.restore();
}
