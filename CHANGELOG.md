# Changelog

All notable changes to this project are documented here.
The package version and the protocol version move independently; protocol changes are called out explicitly.

## [Unreleased]

Planned, roughly in order:

- **MCP server** — expose task generation, validation and redaction as MCP tools so an assistant can drive the whole loop without the user touching a file.
- **Dedicated adapters** for Claude Code (skill), Cursor (rules) and Cline. All of these work today through the generic `AGENTS.md` adapter.
- **A field-report corpus** — anonymised real runs, used as regression cases for protocol wording.
- **`repro-agent doctor`** — validate a maintainer profile against a checkout: do the referenced paths and known-issue references actually exist?

## [0.1.0] — 2026-08-14

Protocol version `1.0`.

First release. The user-side loop is complete: describe a problem, hand it to any AI assistant, get a fix or a bug report.

### Protocol

- Six-section agent instruction set in English and Simplified Chinese: authority and untrusted input, six-phase workflow, diagnostic budget, bug report specification, redaction rules.
- Prompt-injection defence ranked above every other document the agent reads; fetched content is evidence, never instruction.
- Phase D evidence closure: source behaviour, local state, an explaining gap and a reversible fix are all required before any modification.
- Budget exhaustion is defined to mean *write the report*, so weak models escalate instead of escalating their guesses.
- Four option axes, each of which changes the emitted instructions: permission (`readonly` / `guided` / `auto-safe`), network (`global` / `china`), effort (`frugal` / `standard` / `deep`), assistant.
- Five clarifications closing gaps found by [field report 001](docs/field-reports/2026-08-14-tasklite-crlf.md): source that is already on the machine, hard denials being unreachable by the approval workflow, the line between app files and the user's own data, one-line definitions for each outcome, and what to do with `extra_questions` when the user is unreachable.

### Data contract

- `spec/task.schema.json` and `spec/project.schema.json`, draft-07.
- Five policy denials pinned as schema constants: delete files, egress local data, disable security software, read or upload secrets, modify unrelated software.
- Maintainer profiles can tighten the policy and never loosen it.

### Tooling

- `repro-agent` CLI with `init`, `build`, `task`, `adapters`, `validate`, `redact`. Zero runtime dependencies, including the JSON Schema validator.
- Single-file offline HTML generator, bilingual, CSP-locked to no network, no storage APIs, no external resources.
- Adapters for generic `AGENTS.md` and WorkBuddy / OpenClaw skill packages. Markdown only, no executable code.
- Redaction engine that removes credentials, emails, home directories and public IPs while preserving error codes, stack frames, versions and private addresses.
- 60 tests covering schema acceptance and rejection, protocol assembly across all option combinations, safety invariants, redaction behaviour and offline guarantees.
- `examples/tasklite`: a runnable app with a planted defect, so the protocol can be tested rather than described. Its first blind run is written up in `docs/field-reports/`.
