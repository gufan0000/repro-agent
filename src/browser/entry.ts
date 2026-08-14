/**
 * What the offline page is allowed to use.
 *
 * The page used to carry its own copy of the task builder. That copy quietly diverged:
 * it ignored `policy_overrides`, so a maintainer who denied "run repository scripts" got
 * a task that permitted it, and it fell back to the `standard` budget for projects that
 * had asked for `frugal`. Nothing here may reimplement core logic — it only re-exports it.
 */
import { buildTask, validateTask, validateProjectProfile } from '../core/task.js';
import { renderTask } from '../core/render.js';
import { formatErrors } from '../core/schema.js';
import { PROTOCOL_VERSION, BUDGET_PRESETS, policyFor } from '../core/types.js';
import { PACKAGE_VERSION } from '../core/protocol-data.js';

export const ReproCore = {
  buildTask,
  validateTask,
  validateProjectProfile,
  renderTask,
  formatErrors,
  policyFor,
  BUDGET_PRESETS,
  PROTOCOL_VERSION,
  PACKAGE_VERSION,
};

(globalThis as unknown as { ReproCore: typeof ReproCore }).ReproCore = ReproCore;
