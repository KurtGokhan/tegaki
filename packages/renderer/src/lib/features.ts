/**
 * Features that harfbuzz's (and the browser's) complex-text shapers apply
 * context-sensitively based on the script. Passing them in an explicit
 * "enable" list tells the shaper to apply them unconditionally to the whole
 * text range, which breaks the positional assignment — e.g. every Arabic
 * glyph collapses to the final form.
 *
 * Trust the shaper's script defaults for these and never emit them as
 * explicit enables. (Explicit *disables* are fine — `-fina` suppressing the
 * automatic fina is exactly the user's intent.)
 */
const SHAPER_MANAGED_FEATURES = new Set(['init', 'medi', 'fina', 'isol', 'rlig']);

/** Build a harfbuzz feature string from bundle features, filtering shaper-managed enables. */
export function toHbFeatureString(enabled: readonly string[]): string {
  const parts: string[] = [];
  for (const tag of enabled) {
    if (SHAPER_MANAGED_FEATURES.has(tag)) continue;
    parts.push(tag);
  }
  return parts.join(',');
}

/**
 * Build a CSS `font-feature-settings` value from bundle features. Same
 * filter as the HB path: shaper-managed tags are omitted so browsers keep
 * their contextual positional assignment.
 *
 * Fonts with no declared features fall back to disabling `liga` + `calt`,
 * which matches the legacy "1:1 char-to-glyph" assumption the renderer
 * makes when it can't shape.
 */
export function toCssFeatureSettings(enabled: readonly string[]): string {
  if (enabled.length === 0) return "'calt' 0, 'liga' 0";
  const explicit = enabled.filter((tag) => !SHAPER_MANAGED_FEATURES.has(tag));
  if (explicit.length === 0) return 'normal';
  return explicit.map((f) => `'${f}' 1`).join(', ');
}
