# Security Policy

## Threat model

Repro Agent produces instructions that cause an AI agent to inspect, and sometimes modify, a non-technical person's computer. The interesting attacks are therefore:

1. **Prompt injection via fetched content.** The agent reads a repository, a web page, a log line or a filename that contains instructions aimed at it. Mitigation: [protocol section 1](protocol/en/10-authority.md) declares all fetched content to be evidence rather than instruction, and ranks itself above every other document the agent reads.
2. **Policy laundering.** A task file, or a maintainer profile, that quietly relaxes a safety boundary. Mitigation: the five hard denials are `const` in `spec/task.schema.json`, and `repro-agent validate` rejects any task that changes them. `buildTask` only ever lets a maintainer profile make the policy stricter.
3. **Data exfiltration through the bug report.** The report is intended to be posted publicly. Mitigation: the protocol's redaction section, plus `repro-agent redact` and the rules in `src/core/redact.ts`.
4. **Supply chain via the skill package.** Mitigation: adapters emit markdown only, asserted by a test.
5. **The offline page itself.** Mitigation: CSP with `default-src 'none'` and `connect-src 'none'`, no external resources, no storage APIs — all asserted in `test/offline.test.js`.

## What is explicitly *not* claimed

- **That a model will always obey the protocol.** It is instruction text, not a sandbox. Real enforcement lives in the agent host's permission system, which is why the protocol tells users to keep their assistant's default permission mode on and why `guided` is the default autonomy level.
- **That redaction catches everything.** The rules cover well-known secret formats. A bespoke internal token format will pass through. The protocol requires the agent to tell the user to skim the report before posting, and so do we.
- **That a `readonly` task cannot be turned into a writing one by a user who wants it to be.** The user owns their machine. The protocol restrains an agent acting in good faith; it is not a DRM system.

## Reporting a vulnerability

Please **do not** open a public issue for:

- a prompt-injection phrasing that defeats section 1 of the protocol
- a way to make `repro-agent validate` accept a task with a relaxed denial
- a redaction bypass that leaks a common credential format
- anything that makes the offline page issue a network request

Email **gufan0000@gmail.com** with `[repro-agent security]` in the subject, or use GitHub's private vulnerability reporting on this repository. Include a minimal reproduction. You should get a reply within 7 days.

Injection phrasings that the protocol *already* handles correctly are very welcome as public issues — they make good regression tests.

## Supported versions

Only the latest release. The protocol version is separate from the package version; a breaking protocol change bumps `protocol_version` and is documented in `CHANGELOG.md`.
