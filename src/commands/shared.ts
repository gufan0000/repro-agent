import { readFileSync } from 'node:fs';
import type { Args } from '../index.js';
import type { Autonomy, BudgetProfile, Language, ProjectProfile, Region, AgentHost } from '../core/types.js';
import { validateProjectProfile } from '../core/task.js';
import { formatErrors } from '../core/schema.js';

export function str(args: Args, name: string, fallback = ''): string {
  const value = args.flags[name];
  return typeof value === 'string' ? value : fallback;
}

export function pick<T extends string>(args: Args, name: string, allowed: readonly T[], fallback: T): T {
  const value = str(args, name);
  if (!value) return fallback;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`--${name} must be one of: ${allowed.join(', ')} (got "${value}")`);
  }
  return value as T;
}

export const LANGUAGES = ['en', 'zh-CN'] as const satisfies readonly Language[];
export const REGIONS = ['global', 'china'] as const satisfies readonly Region[];
export const AUTONOMIES = ['readonly', 'guided', 'auto-safe'] as const satisfies readonly Autonomy[];
export const BUDGETS = ['frugal', 'standard', 'deep'] as const satisfies readonly BudgetProfile[];
export const HOSTS = ['generic', 'workbuddy', 'claude-code', 'cursor', 'codex', 'cline', 'other'] as const satisfies
  readonly AgentHost[];

export function loadProfile(path: string): ProjectProfile {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`cannot read profile: ${path}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${(error as Error).message}`);
  }
  const errors = validateProjectProfile(data);
  if (errors.length) throw new Error(`${path} is not a valid BugBridge project profile:\n${formatErrors(errors)}`);
  return data as ProjectProfile;
}

/** Pull the ```json fenced block out of a rendered task markdown file. */
export function extractTaskJson(markdown: string): unknown {
  const match = markdown.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!match) throw new Error('no ```json task block found in this markdown file');
  return JSON.parse(match[1]!);
}
