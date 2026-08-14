// web/template.html + the compiled core -> web/index.html
//
// The page must never carry a second implementation of the task builder. It gets the real
// one, inlined, so that what a user downloads from the offline page and what `repro-agent
// task` writes are produced by the same code path.
//
// Run with --check to fail instead of writing, which is what CI uses to catch a template
// or core change that was not regenerated.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from './bundle-core.mjs';
import { renderTutorial } from './build-tutorial.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const CORE_START = '/* REPRO:CORE:START */';
const CORE_END = '/* REPRO:CORE:END */';

function replaceBlock(source, start, end, body, label) {
  const from = source.indexOf(start);
  const to = source.indexOf(end);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`web/template.html is missing the ${label} markers`);
  }
  return source.slice(0, from + start.length) + '\n' + body + '\n' + source.slice(to);
}

const template = readFileSync(join(root, 'web', 'template.html'), 'utf8');
const core = bundle(join(root, 'dist'), 'browser/entry.js');
const next = replaceBlock(template, CORE_START, CORE_END, core, 'core');

// A page that can reach the network is a different product from the one described in the
// README, so the guarantee is asserted at build time as well as in the test suite.
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon', 'import(']) {
  if (next.includes(forbidden)) {
    throw new Error(`refusing to build: the page would contain ${forbidden}, which can reach the network`);
  }
}
if (/<(script|img|link|iframe)\b[^>]*\b(src|href)\s*=\s*["']https?:/i.test(next)) {
  throw new Error('refusing to build: the page would load an external resource');
}

// The illustrated walkthrough is generated the same way and checked for drift the same way,
// so a screenshot swapped in `docs/tutorial/` cannot get left out of the shipped package.
emit('web/index.html', next);
emit('web/tutorial.zh-CN.html', renderTutorial());

function emit(relative, contents) {
  const target = join(root, relative);
  const current = (() => {
    try {
      return readFileSync(target, 'utf8');
    } catch {
      return null;
    }
  })();

  if (current === contents) {
    console.log(`${relative} already up to date`);
  } else if (check) {
    console.error(`${relative} is stale — run 'npm run build' and commit the result`);
    process.exit(1);
  } else {
    writeFileSync(target, contents);
    console.log(`wrote ${relative} (${contents.length.toLocaleString()} chars)`);
  }
}
