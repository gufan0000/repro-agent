// Turns the compiled ES modules under dist/ into one inline <script> body, so the offline
// page runs the *same* task builder as the CLI instead of a second hand-written copy.
//
// This is deliberately not a general bundler and must not become one. It handles exactly
// the shapes tsc emits for this codebase — `export const`, `export function`, and
// single-line `import { … } from './x.js'` — and throws on anything else rather than
// guessing. A wrong guess here would silently change what the page generates, which is
// the failure mode the shared builder exists to prevent.
//
// Using esbuild instead would work, but this file is ~60 lines and keeps the dependency
// count at zero in both directions, which is a claim the project makes on its front page.

import { readFileSync } from 'node:fs';
import { dirname, join, posix, relative } from 'node:path';

const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?\s*$/;
const EXPORT_NAME = /^export\s+(?:const|function|class|let)\s+([A-Za-z0-9_$]+)/;

/** Read one compiled module and split it into its dependencies, body and exported names. */
function readModule(distDir, specifier) {
  const source = readFileSync(join(distDir, specifier), 'utf8');
  const deps = [];
  const exported = [];
  const body = [];

  for (const line of source.split(/\r?\n/)) {
    const imported = line.match(IMPORT);
    if (imported) {
      const target = posix.normalize(posix.join(posix.dirname(specifier), imported[2]));
      deps.push(target);
      body.push(`const {${imported[1]}} = __require(${JSON.stringify(target)});`);
      continue;
    }

    if (line.startsWith('import ')) {
      throw new Error(`${specifier}: unsupported import form, this bundler only handles named imports:\n  ${line}`);
    }

    const name = line.match(EXPORT_NAME);
    if (name) {
      exported.push(name[1]);
      body.push(line.replace(/^export\s+/, ''));
      continue;
    }

    if (line.startsWith('export ')) {
      throw new Error(`${specifier}: unsupported export form, this bundler only handles named declarations:\n  ${line}`);
    }

    body.push(line);
  }

  return { deps, exported, body: body.join('\n') };
}

/** Collect an entry module and everything it reaches, in dependency-first order. */
export function bundle(distDir, entrySpecifier) {
  const modules = new Map();

  const visit = (specifier, stack) => {
    if (modules.has(specifier)) return;
    if (stack.includes(specifier)) {
      throw new Error(`import cycle: ${[...stack, specifier].join(' -> ')}`);
    }
    const mod = readModule(distDir, specifier);
    for (const dep of mod.deps) visit(dep, [...stack, specifier]);
    modules.set(specifier, mod);
  };
  visit(entrySpecifier, []);

  const defined = [...modules]
    .map(
      ([specifier, mod]) =>
        `__define(${JSON.stringify(specifier)}, function (exports, __require) {\n${mod.body}\n` +
        `Object.assign(exports, {${mod.exported.join(', ')}});\n});`,
    )
    .join('\n\n');

  return [
    '(function () {',
    '"use strict";',
    'var __modules = {}, __cache = {};',
    'function __define(name, factory) { __modules[name] = factory; }',
    'function __require(name) {',
    '  if (!__cache[name]) { var exports = {}; __cache[name] = exports; __modules[name](exports, __require); }',
    '  return __cache[name];',
    '}',
    defined,
    `__require(${JSON.stringify(entrySpecifier)});`,
    '})();',
  ].join('\n');
}

/** Path of a compiled module relative to dist/, in the form the bundler keys on. */
export function specifierFor(distDir, file) {
  return relative(distDir, file).split(/[\\/]/).join('/');
}

export { dirname };
