#!/usr/bin/env node
/**
 * Enumerate the test files ourselves and pass explicit paths to `node --test`.
 *
 * Glob support in the test runner arrived in a later Node than this package supports,
 * and cmd.exe does not expand globs at all — so a quoted pattern in the npm script
 * works on some CI legs and silently fails on others. Explicit paths work everywhere.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const testDir = join(root, 'test');

const files = readdirSync(testDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join(testDir, name));

if (files.length === 0) {
  console.error('no test files found in test/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
});

process.exit(result.status ?? 1);
