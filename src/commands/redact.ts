import { readFileSync, writeFileSync } from 'node:fs';
import type { Args } from '../index.js';
import { redact } from '../core/redact.js';
import { str } from './shared.js';

export function cmdRedact(args: Args): number {
  const file = args._[1];
  if (!file) {
    process.stderr.write('usage: bugbridge redact <file> [-o FILE] [--literal <string>]...\n');
    return 1;
  }

  const input = readFileSync(file, 'utf8');
  const result = redact(input, { extraLiterals: args.multi['literal'] ?? [] });

  const out = str(args, 'o') || str(args, 'out');
  if (out) {
    writeFileSync(out, result.text, 'utf8');
    process.stderr.write(`wrote ${out}\n`);
  } else {
    process.stdout.write(result.text);
  }

  const summary = result.categories.length
    ? result.categories.map((id) => `${id} ×${result.counts[id]}`).join(', ')
    : 'nothing matched';
  process.stderr.write(`redacted: ${summary}\n`);
  return 0;
}
