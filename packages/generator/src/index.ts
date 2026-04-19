export {
  type BundleFile,
  DEFAULT_OPTIONS,
  type ExtractBundleInput,
  extractTegakiBundle,
  generateArgsSchema,
  type ParsedFontInfo,
  type PipelineOptions,
  type PipelineResult,
  parseFont,
  processGlyph,
  processGlyphById,
  type TegakiBundleOutput,
} from './commands/generate.ts';
export { DEFAULT_CHARS, EXAMPLE_FONTS, type SkeletonMethod } from './constants.ts';
export { createHbShaper, type HbShaper, type ShapedGlyph } from './font/hb-shaper.ts';
export { enumerateFontChars } from './font/parse.ts';
export { glyphToAnimatedSVG } from './processing/animated-svg.ts';
export { renderStage, STROKE_COLORS, type VisualizationStage } from './processing/visualize.ts';
