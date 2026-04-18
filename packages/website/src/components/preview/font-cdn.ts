/**
 * Fetch a Google Font from the Fontsource CDN (CORS-enabled, no server needed).
 *
 * First queries the Fontsource API for available subsets, then downloads the Latin
 * subset as primary and any extra subsets (e.g., japanese, korean, cyrillic) as
 * additional font files. This enables CJK and other non-Latin fonts to work.
 */
export async function fetchFontFromCDN(family: string): Promise<{ primary: ArrayBuffer; extra: ArrayBuffer[] }> {
  const slug = family.toLowerCase().replace(/\s+/g, '-');
  const baseUrl = `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest`;

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

  const latinResp = await fetch(`${baseUrl}/latin-400-normal.ttf`);
  if (!latinResp.ok) {
    throw new Error(`Font "${family}" not found on CDN (${latinResp.status}). Try uploading a .ttf file instead.`);
  }
  const primary = await latinResp.arrayBuffer();

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
