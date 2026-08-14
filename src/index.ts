#!/usr/bin/env node
import { cmdInit } from './commands/init.js';
import { cmdTask } from './commands/task.js';
import { cmdValidate } from './commands/validate.js';
import { cmdBuild } from './commands/build.js';
import { cmdRedact } from './commands/redact.js';
import { cmdAdapters } from './commands/adapters.js';
import { PROTOCOL_VERSION } from './core/types.js';
import { PACKAGE_VERSION } from './core/protocol-data.js';

const USAGE = `repro-agent — turn "it doesn't work" into a fix, or a bug report a maintainer can act on

Usage
  repro-agent init [--dir .] [--name <project>] [--repo <url>] [--force]
      Create .repro/project.json in your repository. Run this once, as a maintainer.

  repro-agent validate <file...>
      Validate a project profile, a task JSON, or a task markdown file.

  repro-agent task --profile <file> --summary "<what broke>" [options] [-o FILE]
      Build a diagnostic task file for a user to hand to their agent.

  repro-agent build [--profile <file>] [--out dist-support] [--lang en|zh-CN]
      Produce a shippable support kit: a single offline HTML page with your project
      pre-filled, plus the agent adapters. Attach it to a release or host it on Pages.

  repro-agent adapters <generic|workbuddy|all> [--out .] [--lang en|zh-CN] [options]
      Write agent adapter files (AGENTS.md, WorkBuddy skill) for your project.

  repro-agent redact <file> [-o FILE] [--literal <string>]...
      Strip secrets, tokens, emails, home directories and public IPs from a file.

Task options (also accepted by build/adapters where relevant)
  --lang     en | zh-CN            output language                 (default en)
  --region   global | china        source-access fallback chain    (default global)
  --autonomy readonly | guided | auto-safe                          (default guided)
  --budget   frugal | standard | deep                               (default standard)
  --host     generic | workbuddy | claude-code | cursor | codex | cline

  --name, --repo, --mirror <url>, --version, --commit, --issues <url>,
  --os Windows|macOS|Linux, --expected, --observed, --step <text> (repeatable),
  --log-path, --config-path, --process, --service (all repeatable)

Protocol version ${PROTOCOL_VERSION} · https://github.com/gufan0000/repro-agent
`;

export interface Args {
  _: string[];
  flags: Record<string, string | boolean>;
  multi: Record<string, string[]>;
}

const REPEATABLE = new Set(['mirror', 'step', 'log-path', 'config-path', 'process', 'service', 'literal', 'question']);

/**
 * What each subcommand accepts. A mistyped flag used to be ignored in silence — `build
 * --output dist` exited 0 and wrote to `repro-support/` instead, which reads as "the build
 * produced nothing". The person running this is often already dealing with a broken
 * machine and should not have to wonder.
 */
const COMMON = ['lang', 'help', 'h'] as const;
const TASK_FLAGS = ['profile', 'summary', 'region', 'autonomy', 'budget', 'host', 'name', 'repo', 'version',
  'commit', 'issues', 'os', 'os-version', 'expected', 'observed', 'notes', 'o', 'out',
  'mirror', 'step', 'log-path', 'config-path', 'process', 'service'];

const ALLOWED_FLAGS: Record<string, readonly string[]> = {
  init: [...COMMON, 'dir', 'name', 'repo', 'force'],
  validate: [...COMMON],
  task: [...COMMON, ...TASK_FLAGS],
  build: [...COMMON, 'profile', 'out', 'region', 'autonomy', 'budget', 'host'],
  adapters: [...COMMON, ...TASK_FLAGS],
  redact: [...COMMON, 'o', 'out', 'literal'],
};

/** Levenshtein distance, small and good enough to suggest the flag they meant. */
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i]![j] = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
    }
  }
  return rows[a.length]![b.length]!;
}

function rejectUnknownFlags(command: string, args: Args): string | null {
  const allowed = ALLOWED_FLAGS[command];
  if (!allowed) return null;
  const supplied = [...Object.keys(args.flags), ...Object.keys(args.multi)];
  for (const name of supplied) {
    if (allowed.includes(name)) continue;
    const near = allowed
      .map((candidate) => ({ candidate, d: distance(name, candidate) }))
      .filter((c) => c.d <= 2)
      .sort((x, y) => x.d - y.d)[0];
    return `unknown option \`--${name}\` for \`repro-agent ${command}\`` +
      (near ? `; did you mean \`--${near.candidate}\`?` : '') + '\n';
  }
  return null;
}

export function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {}, multi: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('-')) {
      out._.push(token);
      continue;
    }
    const name = token.replace(/^--?/, '');
    const next = argv[i + 1];
    const takesValue = next !== undefined && !next.startsWith('-');
    const value = takesValue ? next! : true;
    if (takesValue) i += 1;
    if (REPEATABLE.has(name)) {
      (out.multi[name] ??= []).push(String(value));
    } else {
      out.flags[name] = value;
    }
  }
  return out;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  // `--version` only means "print the version" with no subcommand; `repro-agent task --version 1.4.0`
  // is the version of the *user's* software, which is a far more common thing to type.
  if (!command && (args.flags['version'] || args.flags['v'])) {
    // Both numbers matter and they move independently, so print both. Leading with the
    // package version is what every other CLI does and what a bug report will quote.
    process.stdout.write(`repro-agent ${PACKAGE_VERSION} (protocol ${PROTOCOL_VERSION})\n`);
    return 0;
  }
  if (!command || args.flags['help'] || args.flags['h'] || command === 'help') {
    process.stdout.write(USAGE);
    return command && command !== 'help' ? 1 : 0;
  }

  const badFlag = rejectUnknownFlags(command, args);
  if (badFlag) {
    process.stderr.write(badFlag);
    return 2;
  }

  switch (command) {
    case 'init':
      return cmdInit(args);
    case 'validate':
      return cmdValidate(args);
    case 'task':
      return cmdTask(args);
    case 'build':
      return cmdBuild(args);
    case 'adapters':
      return cmdAdapters(args);
    case 'redact':
      return cmdRedact(args);
    default:
      process.stderr.write(`unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
