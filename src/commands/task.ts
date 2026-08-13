import { writeFileSync } from 'node:fs';
import type { Args } from '../index.js';
import { buildTask, assertValidTask } from '../core/task.js';
import { renderTask } from '../core/render.js';
import { str, pick, loadProfile, LANGUAGES, REGIONS, AUTONOMIES, BUDGETS, HOSTS } from './shared.js';
import type { Mirror } from '../core/types.js';

export function cmdTask(args: Args): number {
  const summary = str(args, 'summary');
  if (!summary) {
    process.stderr.write('--summary is required: one sentence describing what went wrong.\n');
    return 1;
  }

  const profilePath = str(args, 'profile');
  const profile = profilePath ? loadProfile(profilePath) : undefined;

  const mirrors: Mirror[] = (args.multi['mirror'] ?? []).map((url) => ({ url }));
  const os = pick(args, 'os', ['', 'Windows', 'macOS', 'Linux', 'Other'] as const, '');

  const task = buildTask({
    language: pick(args, 'lang', LANGUAGES, profile?.defaults?.language ?? 'en'),
    region: pick(args, 'region', REGIONS, profile?.defaults?.region ?? 'global'),
    autonomy: pick(args, 'autonomy', AUTONOMIES, profile?.defaults?.autonomy ?? 'guided'),
    budgetProfile: pick(args, 'budget', BUDGETS, profile?.defaults?.budget_profile ?? 'standard'),
    agentHost: pick(args, 'host', HOSTS, profile?.defaults?.agent_host ?? 'generic'),
    profile,
    project: {
      name: str(args, 'name') || profile?.project.name || 'Unknown project',
      repository: str(args, 'repo') || profile?.project.repository,
      mirrors: mirrors.length ? mirrors : profile?.project.mirrors,
      version: str(args, 'version'),
      commit: str(args, 'commit'),
      issue_tracker: str(args, 'issues') || profile?.project.issue_tracker,
    },
    problem: {
      summary,
      expected: str(args, 'expected'),
      observed: str(args, 'observed'),
      reproduction_steps: args.multi['step'] ?? [],
      user_notes: str(args, 'notes'),
    },
    environment: os ? { os } : undefined,
    localTargets: {
      log_paths: args.multi['log-path'] ?? [],
      config_paths: args.multi['config-path'] ?? [],
      process_names: args.multi['process'] ?? [],
      service_names: args.multi['service'] ?? [],
    },
  });

  assertValidTask(task);
  const markdown = renderTask(task);

  const out = str(args, 'o') || str(args, 'out');
  if (out) {
    writeFileSync(out, markdown, 'utf8');
    process.stderr.write(`wrote ${out} (${markdown.length.toLocaleString()} characters)\n`);
  } else {
    process.stdout.write(markdown);
  }
  return 0;
}
