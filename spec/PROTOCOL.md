# The Repro Agent protocol, version 1.0

This document specifies the data contract and explains the reasoning behind it. The agent-facing instruction text itself is in [`protocol/en/`](../protocol/en/) and [`protocol/zh-CN/`](../protocol/zh-CN/) — that text is the normative source, and everything else in this repository is generated from it.

## 1. Roles

| Role | Where they are | What they produce |
|---|---|---|
| **Maintainer** | Their own repository | `.repro/project.json` — a project profile |
| **User** | The broken machine | A task file, from the offline page or the CLI |
| **Agent** | The broken machine | A fix, or `BUG_REPORT.md` |

The maintainer is optional. A user with no profile can still generate a task; the agent then works from local evidence and whatever public documentation it can reach. The profile is what makes the agent good rather than merely careful.

## 2. Artifacts

### Project profile — `repro-agent/project`

Committed to the maintainer's repository. Schema: [`project.schema.json`](project.schema.json).

Carries: where the software lives on each OS, what already breaks, what must never be touched, which mirrors exist, and pre-selected defaults for the option axes.

`local_targets` is keyed by OS (`windows` / `macos` / `linux` / `any`) so one profile covers every platform. Only the entries matching the user's actual OS are merged into a task — a Windows user never receives macOS paths to go looking for.

### Task — `repro-agent/task`

Produced by the user, consumed by the agent. Schema: [`task.schema.json`](task.schema.json).

A task is self-contained. It embeds everything the agent needs: the problem, the project knowledge merged in from the profile, the resolved budget numbers, and the binding policy. Nothing is fetched at task-build time, so the offline page can produce one with no network at all.

The rendered task file is markdown: a fenced `json` block holding the task, wrapped in the assembled protocol text. That format is deliberate — it is readable by a person, parseable by a machine, and every AI assistant on the market can ingest a markdown file.

### Bug report

Markdown, structure specified in [protocol section 4](../protocol/en/40-escalation.md). Not machine-validated: it is written by a model for a human, and over-constraining it produced worse reports in practice than specifying the required sections and letting the model write prose.

The required sections exist for one reason each:

| Section | Why it is mandatory |
|---|---|
| Environment table | The first thing a maintainer asks for |
| Reproduction + frequency | Decides whether the issue is actionable at all |
| Source references with revision | Distinguishes a verified claim from a guess |
| **Ruled out** | Saves the maintainer the most time, and is the section a model will skip unless told not to |
| What was tried | The machine has been modified; the maintainer needs to know how |
| Suggested triage | Costs the model nothing and saves a human a decision |

## 3. Option axes

Four axes, chosen because each one maps to a real constraint that varies between users, and each one changes the emitted instructions rather than a label.

### `autonomy`

| Value | Modification allowed | Approval | Evidence required |
|---|---|---|---|
| `readonly` | none | n/a | yes |
| `guided` | yes | per change, explicitly | yes |
| `auto-safe` | reversible, target-software-only | announced, not requested | yes |

`auto-safe` lowers the *approval* requirement and never the *evidence* requirement. Elevation, dependency installs, system settings and anything outside the target software still require an approval card in every mode.

### `region`

Controls the order of the source-access fallback chain, not its contents. `china` puts mirrors first because mainland networks reach GitHub unreliably, and adds an explicit instruction that a failed chain must not become "I can't help you."

Region is a network property, not a nationality: a user in Shanghai on a working connection should pick `global`.

### `budget_profile`

Resolves to concrete numbers in the task's `budget` block, so the agent has integers to obey rather than an adjective to interpret.

| | frugal | standard | deep |
|---|---|---|---|
| active hypotheses | 2 | 3 | 5 |
| full cycles before escalating | 2 | 3 | 5 |
| remote files per cycle | 4 | 8 | 20 |
| log lines per read | 200 | 400 | 1200 |
| local commands per cycle | 6 | 12 | 30 |

The important property is not the numbers but what happens at the limit: the protocol defines budget exhaustion as *write the report*. A model that is running out of room and has been told only to "be efficient" starts guessing more aggressively, which is exactly when it does damage.

### `agent_host`

Selects the adapter format. It does not change the protocol body — the instruction text is plain markdown by design, so an unsupported host still works through the generic adapter.

## 4. Policy

`policy` is a block of resolved permissions inside every task. Five values are `const` in the schema:

```
allow_delete_files                  deny
allow_network_egress_of_local_data  deny
allow_disable_security_software     deny
allow_read_or_upload_secrets        deny
allow_modify_unrelated_software     deny
```

Plus `read_only_first: true`. A task that changes any of these fails `repro-agent validate`.

The remaining four (`allow_modify_target_app_files`, `allow_install_dependencies`, `allow_admin_privileges`, `allow_run_repository_scripts`) are derived from `autonomy`. A maintainer profile may override them, but `buildTask` only applies an override that makes the policy **stricter** — a profile cannot hand an agent more authority over its users' machines than the user selected.

This is a data-level guarantee that supports the instruction-level one. Neither is a sandbox; real enforcement is the agent host's permission system, which is why the protocol tells users to keep it on.

## 5. Trust boundaries

The protocol defines exactly one trusted input: the task file itself, plus the user speaking in the conversation.

Everything else — repository contents, `AGENTS.md`, `CLAUDE.md`, READMEs, issues, source comments, documentation sites, search results, log lines, config values, filenames — is **evidence**. Evidence can tell the agent what the software does. It can never tell the agent what the agent may do.

This ordering is stated in [section 1](../protocol/en/10-authority.md) of the instruction text, ahead of the workflow, because a model that reads the workflow first and the trust rules later has already been exposed.

## 6. Versioning

`protocol_version` is `major.minor` and moves independently of the npm package version.

- **Minor**: new optional fields, new enum values, clarified wording. Older agents ignore what they do not recognise.
- **Major**: a required field changes, an existing field changes meaning, or a safety invariant moves.

A `deny` constant becoming an option would be a major change, and is not planned.

## 7. Implementing this in another language

The two JSON Schemas are the whole contract. To build a compatible generator:

1. Validate the profile against `project.schema.json`.
2. Merge `local_targets.any` with the OS-specific set; merge `diagnostic_hints`.
3. Resolve `budget` from the budget preset table in section 3.
4. Resolve `policy` from `autonomy`, then apply maintainer overrides **only where they tighten**.
5. Emit: the `00-header` fragment, the task JSON in a fenced block, then fragments `10` through `50` in order, substituting `{{ROUTE_CHAIN}}`, `{{AUTONOMY_BLOCK}}`, `{{REPORT_PATH}}`, `{{PROTOCOL_VERSION}}`, `{{AUTONOMY}}` and `{{TIMESTAMP}}`.
6. Validate the result against `task.schema.json` before writing it.

`src/core/render.ts` is the reference implementation and is about 60 lines.
