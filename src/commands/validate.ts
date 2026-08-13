import { readFileSync } from 'node:fs';
import type { Args } from '../index.js';
import { validateTask, validateProjectProfile } from '../core/task.js';
import { formatErrors } from '../core/schema.js';
import { extractTaskJson } from './shared.js';

export function cmdValidate(args: Args): number {
  const files = args._.slice(1);
  if (files.length === 0) {
    process.stderr.write('usage: bugbridge validate <file...>\n');
    return 1;
  }

  let failures = 0;
  for (const file of files) {
    let data: unknown;
    try {
      const raw = readFileSync(file, 'utf8');
      data = file.endsWith('.md') ? extractTaskJson(raw) : JSON.parse(raw);
    } catch (error) {
      process.stderr.write(`✗ ${file}: ${(error as Error).message}\n`);
      failures += 1;
      continue;
    }

    const kind = (data as { protocol?: string } | null)?.protocol;
    let errors;
    if (kind === 'bugbridge/project') {
      errors = validateProjectProfile(data);
    } else if (kind === 'bugbridge/task') {
      errors = validateTask(data);
    } else {
      process.stderr.write(`✗ ${file}: missing or unknown "protocol" field (${String(kind)})\n`);
      failures += 1;
      continue;
    }

    if (errors.length) {
      process.stderr.write(`✗ ${file} (${kind})\n${formatErrors(errors)}\n`);
      failures += 1;
    } else {
      process.stdout.write(`✓ ${file} (${kind})\n`);
    }
  }
  return failures > 0 ? 1 : 0;
}
