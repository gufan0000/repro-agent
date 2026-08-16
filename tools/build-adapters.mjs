#!/usr/bin/env node
/**
 * Regenerate the checked-in generic adapters from the protocol.
 *
 * These are committed so that someone can copy one straight out of the repository without
 * installing anything, and they ship in the npm tarball. That makes them a generated
 * artifact like any other, so `npm run build` writes them and `npm run check` fails on a
 * diff. Leaving that to CI alone is how 0.1.0 and 0.4.1 both shipped adapters describing a
 * protocol that had already been edited.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAgentsMd, renderWorkbuddySkill } from '../dist/commands/adapters.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const variants = [
  { language: 'en', suffix: '' },
  { language: 'zh-CN', suffix: '.zh-CN' },
];

let stale = 0;
for (const { language, suffix } of variants) {
  const context = { language, region: language === 'zh-CN' ? 'china' : 'global', autonomy: 'guided' };
  emit(join('adapters', 'generic', `AGENTS${suffix}.md`), renderAgentsMd(context));
  emit(join('adapters', 'workbuddy', 'repro-agent', `SKILL${suffix}.md`), renderWorkbuddySkill(context));
}

if (stale) {
  console.error(`${stale} adapter file(s) stale — run 'npm run build' and commit the result`);
  process.exit(1);
}
console.log(check ? 'adapters/ already up to date' : 'regenerated adapters/');

function emit(relative, contents) {
  const target = join(root, relative);
  const current = (() => {
    try {
      return readFileSync(target, 'utf8');
    } catch {
      return null;
    }
  })();
  if (current === contents) return;
  if (check) {
    console.error(`stale: ${relative.replace(/\\/g, '/')}`);
    stale += 1;
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}
