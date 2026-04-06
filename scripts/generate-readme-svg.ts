/**
 * Generate an animated SVG for the README from the Caveat font bundle.
 * Uses CSS animations (not SMIL) for GitHub compatibility.
 * Usage: bun scripts/generate-readme-svg.ts
 */
import glyphData from '../packages/renderer/fonts/tangerine/glyphData.json' with { type: 'json' };

const text = 'Hello World';
const ascender = 960;
const descender = -300;
const emHeight = ascender - descender;
const lineCap = 'round';
const timeScale = 1.4;
const charGap = 30;
const pauseBetweenChars = 0.05;

interface GlyphStroke {
  p: number[][];
  d: number;
  a: number;
}

interface GlyphEntry {
  w: number;
  t: number;
  s: GlyphStroke[];
}

const glyphs = glyphData as Record<string, GlyphEntry>;

let cursorX = 0;
let globalTime = 0;

interface AnimatedStroke {
  points: { x: number; y: number; width: number }[];
  delay: number;
  duration: number;
}

const allStrokes: AnimatedStroke[] = [];

for (const char of text) {
  if (char === ' ') {
    cursorX += 250;
    globalTime += 0.1;
    continue;
  }

  const glyph = glyphs[char];
  if (!glyph) continue;

  for (const stroke of glyph.s) {
    const points = stroke.p.map(([x, y, w]) => ({
      x: x! + cursorX,
      y: y!,
      width: w!,
    }));

    allStrokes.push({
      points,
      delay: globalTime + stroke.d * timeScale,
      duration: stroke.a * timeScale,
    });
  }

  globalTime += glyph.t * timeScale + pauseBetweenChars;
  cursorX += glyph.w + charGap;
}

const totalDuration = globalTime + 1.5; // add hold time at the end
const cycleDuration = totalDuration + 1.0; // add pause before loop

// Compute actual bounding box from stroke points + their widths
let minX = Infinity;
let minY = Infinity;
let maxX = -Infinity;
let maxY = -Infinity;
for (const stroke of allStrokes) {
  for (const p of stroke.points) {
    const halfW = p.width / 2;
    minX = Math.min(minX, p.x - halfW);
    minY = Math.min(minY, p.y - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    maxY = Math.max(maxY, p.y + halfW);
  }
}

const pad = 20;
const vx = minX - pad;
const vy = minY - pad;
const vw = maxX - minX + pad * 2;
const vh = maxY - minY + pad * 2;

// Build CSS keyframes for each stroke
const styles: string[] = [];
const elements: string[] = [];

for (let i = 0; i < allStrokes.length; i++) {
  const stroke = allStrokes[i]!;

  if (stroke.points.length < 2) {
    // Dot stroke
    const p = stroke.points[0]!;
    const size = Math.max(p.width, 0.5);
    const appearPct = ((stroke.delay / cycleDuration) * 100).toFixed(2);
    const holdEndPct = ((totalDuration / cycleDuration) * 100).toFixed(2);
    const fadeEndPct = (((totalDuration + 0.3) / cycleDuration) * 100).toFixed(2);

    styles.push(
      `@keyframes s${i} { 0%,${appearPct}% { opacity:0 } ${appearPct}%,${holdEndPct}% { opacity:1 } ${fadeEndPct}%,100% { opacity:0 } }`,
    );
    elements.push(`  <circle cx="${p.x}" cy="${p.y}" r="${(size / 2).toFixed(1)}" fill="#1a1a1a" class="s${i}"/>`);
    continue;
  }

  const d = stroke.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  let pathLen = 0;
  for (let j = 1; j < stroke.points.length; j++) {
    const dx = stroke.points[j]!.x - stroke.points[j - 1]!.x;
    const dy = stroke.points[j]!.y - stroke.points[j - 1]!.y;
    pathLen += Math.sqrt(dx * dx + dy * dy);
  }

  const avgWidth = stroke.points.reduce((s, p) => s + p.width, 0) / stroke.points.length;
  const dashLen = pathLen + avgWidth;

  // Calculate percentage keyframe positions
  const appearPct = ((stroke.delay / cycleDuration) * 100).toFixed(2);
  const donePct = (((stroke.delay + stroke.duration) / cycleDuration) * 100).toFixed(2);
  const holdEndPct = ((totalDuration / cycleDuration) * 100).toFixed(2);
  const fadeEndPct = (((totalDuration + 0.3) / cycleDuration) * 100).toFixed(2);

  styles.push(
    `@keyframes d${i} { 0%,${appearPct}% { stroke-dashoffset:${dashLen.toFixed(1)} } ${donePct}%,${holdEndPct}% { stroke-dashoffset:0 } ${fadeEndPct}%,100% { stroke-dashoffset:${dashLen.toFixed(1)} } }`,
    `@keyframes o${i} { 0%,${appearPct}% { opacity:0 } ${appearPct}%,${holdEndPct}% { opacity:1 } ${fadeEndPct}%,100% { opacity:0 } }`,
  );

  elements.push(`  <path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="${Math.max(avgWidth, 0.5).toFixed(1)}" stroke-linecap="${lineCap}" stroke-linejoin="round"
    stroke-dasharray="${dashLen.toFixed(1)}" class="s${i}"/>`);
}

// Generate CSS with animation assignments
const cssRules = [
  ...styles,
  ...allStrokes.map((s, i) =>
    s.points.length < 2
      ? `.s${i} { animation: s${i} ${cycleDuration.toFixed(2)}s infinite }`
      : `.s${i} { animation: d${i} ${cycleDuration.toFixed(2)}s infinite, o${i} ${cycleDuration.toFixed(2)}s infinite }`,
  ),
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="600">
  <style>${cssRules.join(' ')}</style>
${elements.join('\n')}
</svg>`;

await Bun.write('media/hello-world.svg', svg);
console.log(`Generated media/hello-world.svg (${allStrokes.length} strokes, ${cycleDuration.toFixed(1)}s cycle)`);
