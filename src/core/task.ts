import { newTaskId } from './id.js';
import { validate, formatErrors, type SchemaError } from './schema.js';
import { TASK_SCHEMA, PROJECT_SCHEMA } from './schema-data.js';
import {
  BUDGET_PRESETS,
  PROTOCOL_VERSION,
  policyFor,
  type Autonomy,
  type BudgetProfile,
  type Language,
  type ProjectProfile,
  type Region,
  type Task,
  type TargetSet,
  type AgentHost,
} from './types.js';

export interface TaskInput {
  language?: Language;
  region?: Region;
  autonomy?: Autonomy;
  budgetProfile?: BudgetProfile;
  agentHost?: AgentHost;
  os?: 'Windows' | 'macOS' | 'Linux' | 'Other' | '';
  project?: Partial<Task['project']>;
  problem: Task['problem'];
  environment?: Task['environment'];
  localTargets?: TargetSet;
  hints?: Task['diagnostic_hints'];
  escalation?: Task['escalation'];
  profile?: ProjectProfile;
  taskId?: string;
  createdAt?: string;
}

const SUCCESS_CRITERIA: Record<Language, string[]> = {
  en: [
    'State a root cause with its evidence, or state honestly that it is unknown',
    'If a fix was applied, verify it against the original symptom',
    'Record every change with its backup path and rollback steps',
    'If unfixed, produce a bug report a maintainer can act on without follow-up questions',
  ],
  'zh-CN': [
    '给出根因及其证据，或如实说明根因未知',
    '若执行了修复，针对原始症状完成验证',
    '记录每一处改动的备份路径和回滚步骤',
    '若未修复，产出一份维护者无需追问即可着手的 bug 报告',
  ],
};

const OS_KEY: Record<string, 'windows' | 'macos' | 'linux'> = {
  Windows: 'windows',
  macOS: 'macos',
  Linux: 'linux',
};

function mergeTargets(...sets: Array<TargetSet | undefined>): TargetSet {
  const keys: Array<keyof TargetSet> = [
    'installation_paths',
    'executable_paths',
    'log_paths',
    'config_paths',
    'data_paths',
    'process_names',
    'service_names',
    'ports',
    'registry_paths_read_only',
  ];
  const out: TargetSet = {};
  for (const key of keys) {
    const merged = sets.flatMap((set) => (set?.[key] as unknown[] | undefined) ?? []);
    const unique = [...new Set(merged)];
    if (unique.length) (out as Record<string, unknown>)[key] = unique;
  }
  return out;
}

function clean<T extends object>(value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    if (typeof item === 'string' && item === '') continue;
    if (Array.isArray(item) && item.length === 0) continue;
    if (typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 0) continue;
    out[key] = item;
  }
  return out as T;
}

/**
 * Build a complete, schema-valid task from user input plus an optional maintainer profile.
 *
 * Precedence: explicit input > maintainer profile defaults > protocol defaults. A maintainer
 * can pre-select options and supply project knowledge, but never overrides what the user
 * chose in front of them.
 */
export function buildTask(input: TaskInput): Task {
  const profile = input.profile;
  const defaults = profile?.defaults ?? {};

  const language: Language = input.language ?? defaults.language ?? 'en';
  const region: Region = input.region ?? defaults.region ?? 'global';
  const autonomy: Autonomy = input.autonomy ?? defaults.autonomy ?? 'guided';
  const budgetProfile: BudgetProfile = input.budgetProfile ?? defaults.budget_profile ?? 'standard';
  const agentHost: AgentHost = input.agentHost ?? defaults.agent_host ?? 'generic';

  const os = input.environment?.os || input.os || '';
  const osKey = OS_KEY[os];

  const localTargets = mergeTargets(
    profile?.local_targets?.any,
    osKey ? profile?.local_targets?.[osKey] : undefined,
    input.localTargets,
  );

  const policy = policyFor(autonomy);
  const overrides = profile?.policy_overrides ?? {};
  // Maintainers may only tighten. `deny` always wins over `ask`.
  if (overrides.no_full_repository_download === true) policy.no_full_repository_download = true;
  const writable = policy as unknown as Record<string, string>;
  for (const key of ['allow_modify_target_app_files', 'allow_install_dependencies', 'allow_admin_privileges', 'allow_run_repository_scripts'] as const) {
    if (overrides[key] === 'deny') writable[key] = 'deny';
    else if (overrides[key] === 'ask' && policy[key] === 'auto-if-reversible') writable[key] = 'ask-after-backup';
  }

  const task: Task = {
    protocol: 'repro-agent/task',
    protocol_version: PROTOCOL_VERSION,
    task_id: input.taskId ?? newTaskId(),
    created_at: input.createdAt ?? new Date().toISOString(),
    language,
    options: { agent_host: agentHost, region, autonomy, budget_profile: budgetProfile },
    project: clean({
      name: input.project?.name ?? profile?.project.name ?? '',
      repository: input.project?.repository ?? profile?.project.repository,
      repository_public: input.project?.repository_public ?? profile?.project.repository_public,
      mirrors: input.project?.mirrors ?? profile?.project.mirrors,
      deepwiki: input.project?.deepwiki ?? profile?.project.deepwiki,
      docs_url: input.project?.docs_url ?? profile?.project.docs_url,
      issue_tracker: input.project?.issue_tracker ?? profile?.project.issue_tracker,
      version: input.project?.version,
      commit: input.project?.commit,
      release_page: input.project?.release_page,
    }) as Task['project'],
    problem: clean(input.problem) as Task['problem'],
    budget: { ...BUDGET_PRESETS[budgetProfile] },
    policy,
  };

  const environment = clean({
    ...(input.environment ?? {}),
    os: os || undefined,
    runtimes: input.environment?.runtimes ?? profile?.environment?.runtimes,
  });
  if (Object.keys(environment).length) task.environment = environment as Task['environment'];

  if (Object.keys(localTargets).length) task.local_targets = localTargets;

  const hints = clean({
    known_issues: [...(profile?.diagnostic_hints?.known_issues ?? []), ...(input.hints?.known_issues ?? [])],
    known_safe_checks: [
      ...(profile?.diagnostic_hints?.known_safe_checks ?? []),
      ...(input.hints?.known_safe_checks ?? []),
    ],
    known_dangerous_actions: [
      ...(profile?.diagnostic_hints?.known_dangerous_actions ?? []),
      ...(input.hints?.known_dangerous_actions ?? []),
    ],
    verification_steps: [
      ...(profile?.diagnostic_hints?.verification_steps ?? []),
      ...(input.hints?.verification_steps ?? []),
    ],
  });
  if (Object.keys(hints).length) task.diagnostic_hints = hints as Task['diagnostic_hints'];

  const escalation = clean({
    report_path: input.escalation?.report_path ?? profile?.escalation?.report_path ?? 'BUG_REPORT.md',
    issue_tracker:
      input.escalation?.issue_tracker ?? input.project?.issue_tracker ?? profile?.project.issue_tracker,
    issue_template_url: input.escalation?.issue_template_url ?? profile?.escalation?.issue_template_url,
    redact: input.escalation?.redact ?? profile?.escalation?.redact ?? true,
    extra_questions: input.escalation?.extra_questions ?? profile?.escalation?.extra_questions,
  });
  task.escalation = escalation as Task['escalation'];

  task.success_criteria = SUCCESS_CRITERIA[language];

  return task;
}

export function validateTask(data: unknown): SchemaError[] {
  return validate(TASK_SCHEMA, data);
}

export function validateProjectProfile(data: unknown): SchemaError[] {
  return validate(PROJECT_SCHEMA, data);
}

export function assertValidTask(data: unknown): asserts data is Task {
  const errors = validateTask(data);
  if (errors.length) throw new Error(`invalid Repro Agent task:\n${formatErrors(errors)}`);
}
