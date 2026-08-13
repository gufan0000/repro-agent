#!/usr/bin/env node
import { cmdInit } from './commands/init.js';
import { cmdTask } from './commands/task.js';
import { cmdValidate } from './commands/validate.js';
import { cmdBuild } from './commands/build.js';
import { cmdRedact } from './commands/redact.js';
import { cmdAdapters } from './commands/adapters.js';
import { PROTOCOL_VERSION } from './core/types.js';

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
    process.stdout.write(`${PROTOCOL_VERSION}\n`);
    return 0;
  }
  if (!command || args.flags['help'] || args.flags['h'] || command === 'help') {
    process.stdout.write(USAGE);
    return command && command !== 'help' ? 1 : 0;
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
