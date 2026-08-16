# Changelog

All notable changes to this project are documented here.
The package version and the protocol version move independently; protocol changes are called out explicitly.

## [Unreleased]

Planned, roughly in order:

## [0.4.2] — 2026-08-16

### Fixed — the checked-in adapters described the old protocol

`adapters/**` is generated from `protocol/**`, ships in the npm tarball, and is meant to be
copyable straight out of the repository. But `npm run build` never wrote it and `npm run
check` never checked it: only CI did, after the fact. So 0.4.1 published adapters carrying
the Phase B text the release had just replaced. 0.1.0 shipped the same way, for the same
reason — twice is a process defect, not an oversight.

`repro-agent adapters` and `repro-agent build` were unaffected throughout: both render from
the embedded protocol rather than reading these files.

- `npm run build` writes the adapters and `npm run check` fails on a stale one, so the gate a
  developer gets locally is the gate CI applies.
- CI now runs `npm run check` rather than restating the rule, then diffs the whole tree
  instead of a named list — an artifact that gains a writer but not a `--check` still gets
  caught.

- **MCP server** — expose task generation, validation and redaction as MCP tools so an assistant can drive the whole loop without the user touching a file.
- **Dedicated adapters** for Claude Code (skill), Cursor (rules) and Cline. All of these work today through the generic `AGENTS.md` adapter.
- **A field-report corpus** — anonymised real runs, used as regression cases for protocol wording.
- **`repro-agent doctor`** — validate a maintainer profile against a checkout: do the referenced paths and known-issue references actually exist?

## [0.4.1] — 2026-08-16

Protocol `1.0` is unchanged as a contract. This is wording — and the wording was the bug.

### Fixed — agents were skipping the source and calling it unreachable

A report came back from a real run saying *"cannot access the source locally (repository not
cloned)"*, on a task that carried a public GitHub URL — and whose own citation table proved
the agent had reached github.com, because it quoted the README from there. It could read the
web fine. It just did not know that reading source meant fetching a file.

Reading the protocol back, it never really had a chance. Three statements told it not to
download the repository — the Phase B heading *"without downloading it"*, the line *"you do
not clone the repository by default"*, and the `no_full_repository_download` policy constant
— against one abstract line telling it to fetch (*"the agent's built-in web fetch, against
`project.repository`"*), with no indication of what a fetch of a source file even looks like.
Then the report template handed it the sentence to give up with: *"Source not reachable **from
this machine**"*, which frames source access as a property of the local disk. It filled in
the blank with the only reason it had: no clone.

- **Both route chains now carry the actual URL shape.** `https://raw.githubusercontent.com/<owner>/<repo>/<tag-or-commit>/<path>` for contents, the `tree/<ref>/<dir>` page for finding a path, and the equivalents for Gitee and GitCode. All three verified against live hosts, tags included.
- **Phase B is now framed by what to do, not what to avoid**: "Read the source without cloning the repository", and *"not having a local clone is not a reason to skip this phase — cloning is the last step of the chain, not its precondition"*.
- **"Unreachable" now has to be earned.** The agent must name each route it tried and what came back. "There is no local clone", "the repository was not downloaded" and "I only have the README" are explicitly not failed routes, and opening a landing page is explicitly not reading source.

## [0.4.0] — 2026-08-16

### Added

- **An illustrated walkthrough in the Chinese package** — `图文教程.html`, eight real screenshots from installing an assistant through to handing it the task file, plus what happens after and the five questions people actually ask. WorkBuddy is the worked example and the page says so in its first sentence; every step applies to any assistant that can read local files. Also published at [`web/tutorial.zh-CN.html`](https://gufan0000.github.io/repro-agent/web/tutorial.zh-CN.html), generated from `docs/tutorial/` and covered by the same drift check as the diagnostic page. Screenshots are inlined as data URIs — a tutorial that has to fetch its own images is broken exactly when it is needed. The English package carries the same walkthrough as `HOW-TO.txt`, in words: a Chinese UI in screenshots teaches an English reader nothing.

## [0.3.0] — 2026-08-14

Protocol `1.0` is unchanged. This release is about the developer who will not run a command.

### Added — a package a developer can ship without adapting anything

Every route into this project so far assumed the maintainer would run something. Two new
release assets assume nothing: download, unzip, ship the folder with your software.

- **`repro-agent-user-zh-CN-<version>.zip`** and **`repro-agent-user-en-<version>.zip`**, each holding the offline page, a readme for the user in one language, and a readme for the developer. The `zh-CN` page is built with `region: china`, so source access tries GitCode and Gitee before GitHub.
- **A `repro-project` block at the top of every page**, four values a developer may fill in with a text editor. Filled, the page stops asking the user which software broke and the assistant knows where to read the source; empty, the page asks in plain language and everything else still works. It can set the project's name, repository, one mirror and the issue tracker — and nothing else. Policy, budget, autonomy and region are not readable from it, non-`https` addresses are rejected, and a block that cannot be parsed produces a visible note instead of a silent fallback.
- Pages built by `repro-agent build` no longer show the mirror, issue-tracker, source-route, budget and assistant fields. Those are a maintainer's vocabulary; the hosted page keeps them, because whoever opens that is filing on behalf of a project they do not own.
- The archives are written by `tools/build-packages.mjs` rather than shelled out to `zip`: entry names are flagged UTF-8 so Chinese filenames survive Windows Explorer, and the timestamps are fixed so a commit always produces the same bytes.

The single bilingual `repro-agent-user-<version>.zip` from 0.2.0 is replaced by the two above.

### Fixed

- **`repro-agent build --region china` without a profile still emitted `global`.** The page's three technical selects were read straight from the DOM but never seeded from the embedded defaults, so they sat on their first `<option>` no matter what the maintainer had asked for. Same shape as the 0.2.0 drift bug, one layer down. Budget and assistant host were affected identically.
- **Every page without a maintainer profile opened with an empty white card**, the hosted one included. `.locked{display:flex}` quietly beats the `hidden` attribute.

## [0.2.0] — 2026-08-14

Protocol `1.0` is unchanged. This release is about the offline page: what it generates, and who is allowed to change what.

### Fixed — the page and the CLI had drifted

The page carried its own hand-written copy of the task builder, and that copy had fallen behind. For a project whose profile set `budget_profile: frugal`, `agent_host: workbuddy` and `policy_overrides: { allow_run_repository_scripts: "deny" }`, the page produced a task with the `standard` budget, the `generic` host, and **`allow_run_repository_scripts: "ask"`**.

That last one is a security boundary, not a cosmetic difference: the README promises that a maintainer profile can only ever tighten the policy, and on this path it silently loosened it. Mirrors lost their `kind` and everything past the first one; `environment.runtimes` was dropped entirely.

- The page now runs the real builder. `src/browser/entry.ts` re-exports the core, `tools/bundle-core.mjs` inlines the compiled modules into the single offline file, and nothing in `web/` reimplements core logic. Runtime dependencies are still zero, and so are bundler dependencies.
- `repro-agent build` injects all five maintainer defaults into the page, not three.
- Everything the page generates is checked against `task.schema.json` — the same validator the CLI uses — before it can be downloaded.

### Fixed — users could overwrite the maintainer's facts

Project name, repository, mirror and issue tracker were ordinary form fields: "clear" wiped them, and importing saved answers could replace the repository with any URL, producing a valid-looking task that pointed at the wrong project. They are now displayed as a locked card and have no editable control at all.

### Changed — the page a non-technical person actually sees

- A project-specific page now opens with **one** required text box. It was 41 controls and roughly 4,000px of scrolling on a phone.
- Problem type, frequency and onset are single-tap choices, every one of them with a "Not sure".
- Repository, mirrors, issue tracker, commit, log/config/install paths, process names, region, budget and agent host are gone from the user's view. They come from the profile, or the agent checks them itself.
- Only `guided` and `readonly` are offered. `auto-safe` remains in the protocol and the CLI for maintainers.
- A project that supports one operating system no longer asks the user which one they are on. Previously, not answering meant the maintainer's platform-specific paths never reached the task.
- With no maintainer profile the page becomes a helper mode — "diagnose an open-source project for someone" — which asks for a repository URL and infers the name from it. The two audiences were sharing one form, which is why a single sentence was not enough to generate anything.

### Added

- A real-browser test job. Every defect above passed a green string-matching suite; the new job asserts zero network requests, one visible input, locked project facts, and that the page and the CLI produce a deep-equal task from the same answers.
- Every tag now attaches the user download to its GitHub release: the offline page, a zip with instructions in both languages, and `SHA256SUMS.txt`. Only `v0.1.0` had ever carried one.
- `--version` and unknown-flag handling: `repro-agent build --output x` used to exit 0 and write somewhere else. It now exits 2 and suggests `--out`.

### Credit

Every defect in this release was found by an independent review of `0.1.2`, including the browser-versus-CLI comparison that exposed the policy drift.

## [0.1.2] — 2026-08-14

- The published tarball's README carried a stale status line: it still said `0.1.0` and `60 tests`, because those lines were corrected after 0.1.1 had already gone out.
- First release published by CI through npm trusted publishing, so this is the first version carrying a provenance attestation.

## [0.1.1] — 2026-08-14

- `--version` now prints `repro-agent <package version> (protocol <protocol version>)`. It previously printed only the protocol version, so a bug report quoting it sent the maintainer to the wrong code. The package version is baked in by the generator, and CI's drift check catches a bump of one without the other.
- Releases are published from CI by tag, using npm trusted publishing (OIDC). No npm token exists in this repository or in GitHub secrets, and published tarballs now carry provenance.

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
