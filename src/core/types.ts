export const PROTOCOL_VERSION = '1.0';

export type Language = 'zh-CN' | 'en';
export type Region = 'global' | 'china';
export type Autonomy = 'readonly' | 'guided' | 'auto-safe';
export type BudgetProfile = 'frugal' | 'standard' | 'deep';
export type AgentHost = 'generic' | 'workbuddy' | 'claude-code' | 'cursor' | 'codex' | 'cline' | 'other';

export interface Mirror {
  url: string;
  kind?: 'gitcode' | 'gitee' | 'codeberg' | 'gitlab' | 'sourcehut' | 'mirror' | 'other';
  note?: string;
}

export interface KnownIssue {
  symptom: string;
  cause?: string;
  fix?: string;
  affected_versions?: string;
  reference?: string;
}

export interface TargetSet {
  installation_paths?: string[];
  executable_paths?: string[];
  log_paths?: string[];
  config_paths?: string[];
  data_paths?: string[];
  process_names?: string[];
  service_names?: string[];
  ports?: number[];
  registry_paths_read_only?: string[];
}

export interface Budget {
  max_active_hypotheses: number;
  max_full_cycles: number;
  max_remote_files_per_cycle: number;
  max_log_lines_per_read: number;
  max_local_commands_per_cycle: number;
}

export interface Policy {
  read_only_first: true;
  no_full_repository_download: boolean;
  allow_modify_target_app_files: 'deny' | 'ask' | 'ask-after-backup' | 'auto-if-reversible';
  allow_install_dependencies: 'deny' | 'ask';
  allow_admin_privileges: 'deny' | 'ask';
  allow_delete_files: 'deny';
  allow_run_repository_scripts: 'deny' | 'ask';
  allow_network_egress_of_local_data: 'deny';
  allow_disable_security_software: 'deny';
  allow_read_or_upload_secrets: 'deny';
  allow_modify_unrelated_software: 'deny';
}

export interface Task {
  protocol: 'repro-agent/task';
  protocol_version: string;
  task_id?: string;
  created_at?: string;
  language: Language;
  options: {
    agent_host: AgentHost;
    region: Region;
    autonomy: Autonomy;
    budget_profile: BudgetProfile;
  };
  project: {
    name: string;
    repository?: string;
    repository_public?: boolean;
    mirrors?: Mirror[];
    deepwiki?: boolean;
    docs_url?: string;
    issue_tracker?: string;
    version?: string;
    commit?: string;
    release_page?: string;
  };
  problem: {
    summary: string;
    expected?: string;
    observed?: string;
    reproduction_steps?: string[];
    frequency?: '' | 'always' | 'often' | 'sometimes' | 'once';
    first_seen?: string;
    changed_recently?: string;
    user_notes?: string;
  };
  environment?: {
    os?: '' | 'Windows' | 'macOS' | 'Linux' | 'Other';
    os_version?: string;
    architecture?: '' | 'x64' | 'arm64' | 'x86';
    locale?: string;
    runtimes?: string[];
  };
  local_targets?: TargetSet;
  diagnostic_hints?: {
    known_issues?: KnownIssue[];
    known_safe_checks?: string[];
    known_dangerous_actions?: string[];
    verification_steps?: string[];
  };
  budget: Budget;
  policy: Policy;
  escalation?: {
    report_path?: string;
    issue_tracker?: string;
    issue_template_url?: string;
    redact?: boolean;
    extra_questions?: string[];
  };
  success_criteria?: string[];
}

export interface ProjectProfile {
  protocol: 'repro-agent/project';
  protocol_version: string;
  project: {
    name: string;
    repository?: string;
    repository_public?: boolean;
    mirrors?: Mirror[];
    deepwiki?: boolean;
    docs_url?: string;
    issue_tracker?: string;
  };
  defaults?: {
    language?: Language;
    region?: Region;
    autonomy?: Autonomy;
    budget_profile?: BudgetProfile;
    agent_host?: AgentHost;
  };
  environment?: {
    supported_os?: Array<'Windows' | 'macOS' | 'Linux'>;
    runtimes?: string[];
  };
  local_targets?: {
    windows?: TargetSet;
    macos?: TargetSet;
    linux?: TargetSet;
    any?: TargetSet;
  };
  diagnostic_hints?: Task['diagnostic_hints'];
  policy_overrides?: Partial<
    Pick<
      Policy,
      | 'no_full_repository_download'
      | 'allow_modify_target_app_files'
      | 'allow_install_dependencies'
      | 'allow_admin_privileges'
      | 'allow_run_repository_scripts'
    >
  >;
  escalation?: Task['escalation'];
}

export const BUDGET_PRESETS: Record<BudgetProfile, Budget> = {
  // Free tiers and small local models: keep the context tiny and bail out early.
  frugal: {
    max_active_hypotheses: 2,
    max_full_cycles: 2,
    max_remote_files_per_cycle: 4,
    max_log_lines_per_read: 200,
    max_local_commands_per_cycle: 6,
  },
  standard: {
    max_active_hypotheses: 3,
    max_full_cycles: 3,
    max_remote_files_per_cycle: 8,
    max_log_lines_per_read: 400,
    max_local_commands_per_cycle: 12,
  },
  deep: {
    max_active_hypotheses: 5,
    max_full_cycles: 5,
    max_remote_files_per_cycle: 20,
    max_log_lines_per_read: 1200,
    max_local_commands_per_cycle: 30,
  },
};

/**
 * The four `deny` entries are constants in the schema, not defaults. They stay denied
 * for the whole session no matter what the maintainer profile or the fetched repository says.
 */
export function policyFor(autonomy: Autonomy): Policy {
  return {
    read_only_first: true,
    no_full_repository_download: true,
    allow_modify_target_app_files:
      autonomy === 'readonly' ? 'deny' : autonomy === 'auto-safe' ? 'auto-if-reversible' : 'ask-after-backup',
    allow_install_dependencies: autonomy === 'readonly' ? 'deny' : 'ask',
    allow_admin_privileges: autonomy === 'readonly' ? 'deny' : 'ask',
    allow_delete_files: 'deny',
    allow_run_repository_scripts: autonomy === 'readonly' ? 'deny' : 'ask',
    allow_network_egress_of_local_data: 'deny',
    allow_disable_security_software: 'deny',
    allow_read_or_upload_secrets: 'deny',
    allow_modify_unrelated_software: 'deny',
  };
}
