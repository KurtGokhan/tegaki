import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const rendererPkg = JSON.parse(readFileSync(join(root, 'packages/renderer/package.json'), 'utf-8'));
const version: string = rendererPkg.version;

const packagesToSync = ['package.json', 'packages/generator/package.json', 'packages/website/package.json'];

for (const pkgPath of packagesToSync) {
  const fullPath = join(root, pkgPath);
  const raw = readFileSync(fullPath, 'utf-8');
  const pkg = JSON.parse(raw);
  if (pkg.version !== version) {
    pkg.version = version;
    writeFileSync(fullPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`Synced ${pkgPath} to v${version}`);
  }
}
