import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

/**
 * Locate the installed package root from `dist/`, so the CLI can copy `web/` and
 * `adapters/` regardless of whether it was installed globally, via npx, or linked
 * from a checkout.
 */
export function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'spec'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate the repro-agent package root');
}

export function assetPath(...parts: string[]): string {
  return join(packageRoot(), ...parts);
}
