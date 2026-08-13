#!/usr/bin/env node
/**
 * Regenerate the checked-in generic adapters from the protocol.
 *
 * These are committed so that someone can copy one straight out of the repository
 * without installing anything. CI regenerates them and fails on a diff, so they cannot
 * drift away from `protocol/**`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAgentsMd, renderWorkbuddySkill } from '../dist/commands/adapters.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const variants = [
  { language: 'en', suffix: '' },
  { language: 'zh-CN', suffix: '.zh-CN' },
];

for (const { language, suffix } of variants) {
  const context = { language, region: language === 'zh-CN' ? 'china' : 'global', autonomy: 'guided' };

  mkdirSync(join(root, 'adapters', 'generic'), { recursive: true });
  writeFileSync(join(root, 'adapters', 'generic', `AGENTS${suffix}.md`), renderAgentsMd(context), 'utf8');

  const skillDir = join(root, 'adapters', 'workbuddy', 'bugbridge-doctor');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, `SKILL${suffix}.md`), renderWorkbuddySkill(context), 'utf8');
}

console.log('regenerated adapters/');
