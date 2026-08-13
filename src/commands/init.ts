import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import type { Args } from '../index.js';
import { str, pick, LANGUAGES, REGIONS, AUTONOMIES, BUDGETS } from './shared.js';
import { PROTOCOL_VERSION, type ProjectProfile } from '../core/types.js';

/**
 * Scaffolds the maintainer-side profile. The generated file is deliberately populated
 * with placeholder paths rather than left empty: a profile with no `local_targets` and no
 * `known_issues` is only marginally better than no profile at all, and a filled-in
 * template is far more likely to get edited than a blank one.
 */
export function cmdInit(args: Args): number {
  const dir = resolve(str(args, 'dir', '.'));
  const target = join(dir, '.bugbridge', 'project.json');

  if (existsSync(target) && !args.flags['force']) {
    process.stderr.write(`${target} already exists. Pass --force to overwrite.\n`);
    return 1;
  }

  const name = str(args, 'name') || basename(dir);
  const repo = str(args, 'repo');
  const region = pick(args, 'region', REGIONS, 'global');

  const profile: ProjectProfile = {
    protocol: 'bugbridge/project',
    protocol_version: PROTOCOL_VERSION,
    project: {
      name,
      repository: repo,
      repository_public: true,
      mirrors:
        region === 'china'
          ? [{ url: 'https://gitcode.com/OWNER/REPO', kind: 'gitcode', note: 'Pull mirror, may lag behind' }]
          : [],
      deepwiki: false,
      docs_url: '',
      issue_tracker: repo ? `${repo.replace(/\.git$/, '').replace(/\/$/, '')}/issues` : '',
    },
    defaults: {
      language: pick(args, 'lang', LANGUAGES, 'en'),
      region,
      autonomy: pick(args, 'autonomy', AUTONOMIES, 'guided'),
      budget_profile: pick(args, 'budget', BUDGETS, 'standard'),
    },
    environment: {
      supported_os: ['Windows', 'macOS', 'Linux'],
      runtimes: [],
    },
    local_targets: {
      windows: {
        installation_paths: ['%LOCALAPPDATA%\\Programs\\<APP>'],
        log_paths: ['%APPDATA%\\<APP>\\logs'],
        config_paths: ['%APPDATA%\\<APP>\\config.json'],
        process_names: ['<APP>.exe'],
      },
      macos: {
        installation_paths: ['/Applications/<APP>.app'],
        log_paths: ['~/Library/Logs/<APP>'],
        config_paths: ['~/Library/Application Support/<APP>/config.json'],
        process_names: ['<APP>'],
      },
      linux: {
        log_paths: ['~/.local/state/<app>/logs', '~/.cache/<app>/logs'],
        config_paths: ['~/.config/<app>/config.json'],
        process_names: ['<app>'],
      },
    },
    diagnostic_hints: {
      known_issues: [
        {
          symptom: 'Describe a symptom users actually report, in their words',
          cause: 'What is really going on',
          fix: 'The exact remedy, safe for an agent to apply',
          affected_versions: '< 1.2.0',
          reference: '',
        },
      ],
      known_safe_checks: [
        'Check whether the config file parses as valid JSON',
        'Check whether the service/process is running',
      ],
      known_dangerous_actions: [
        'Do not delete the whole configuration directory — it holds user data',
      ],
      verification_steps: ['Restart the app and confirm the failing action now succeeds'],
    },
    escalation: {
      report_path: 'BUG_REPORT.md',
      redact: true,
      extra_questions: [],
    },
  };

  mkdirSync(join(dir, '.bugbridge'), { recursive: true });
  writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`);

  process.stdout.write(
    [
      `Created ${target}`,
      '',
      'Next:',
      '  1. Replace every <APP> placeholder and the example known_issues entry with real values.',
      '     The known_issues list is what makes an agent expert on your project instead of generic.',
      '  2. bugbridge validate .bugbridge/project.json',
      '  3. bugbridge build --profile .bugbridge/project.json',
      '     -> a single offline HTML page to attach to your releases, plus agent adapters.',
      '  4. Link it from your README and SUPPORT.md.',
      '',
    ].join('\n'),
  );
  return 0;
}
