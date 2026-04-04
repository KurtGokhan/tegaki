import { resolve } from 'node:path';

const SCRIPT_PATH = resolve(import.meta.dirname, 'skimage_bridge.py');

export type SkimageMethod = 'lee' | 'thin' | 'zhang' | 'medial-axis';

/**
 * Call scikit-image skeletonization via a Python subprocess.
 * Requires `uv` (https://docs.astral.sh/uv/) to be installed.
 * scikit-image is installed automatically on first run via `uv run --with`.
 */
export async function skimageSkeletonize(
  bitmap: Uint8Array,
  width: number,
  height: number,
  method: SkimageMethod,
  maxIter?: number,
): Promise<Uint8Array> {
  const input = JSON.stringify({
    width,
    height,
    method,
    bitmap: Buffer.from(bitmap).toString('base64'),
    ...(maxIter != null && { maxIter }),
  });

  const proc = Bun.spawn(['uv', 'run', '--with', 'scikit-image', '--with', 'numpy', 'python3', SCRIPT_PATH], {
    stdin: new Blob([input]),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

  if (exitCode !== 0) {
    throw new Error(`scikit-image bridge failed (exit ${exitCode}): ${stderr.trim()}`);
  }

  const result = JSON.parse(stdout);
  const decoded = Buffer.from(result.skeleton, 'base64');
  return new Uint8Array(decoded);
}
