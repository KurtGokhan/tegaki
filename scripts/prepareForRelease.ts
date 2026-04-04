import { copyFileSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootFile = (path: string) => fileURLToPath(import.meta.resolve?.(path) || '');

copyFileSync(rootFile('../README.md'), './README.md');
copyFileSync(rootFile('../LICENSE'), './LICENSE');
cpSync(rootFile('../media'), './media', { recursive: true });
