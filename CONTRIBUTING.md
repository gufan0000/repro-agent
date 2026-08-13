# Contributing to BugBridge

Thanks for looking. This project is small on purpose, so almost anything you send will get read quickly.

## The single most useful contribution

**A field report.** Open an issue with the `field-report` template describing a real run: which assistant and model, which of the four options you picked, what the problem was, and — most importantly — where the agent went wrong. Did it change something before it had evidence? Did it obey a stray instruction it read in a README? Did it declare victory without verifying?

The protocol is a set of testable claims about model behaviour. Only real runs can falsify them.

## Setup

```bash
npm install
npm test        # builds, then runs the suite
```

Node 18.17+. There are no runtime dependencies and there should not be any — this tool runs on machines that are already broken.

## How the repository fits together

```
protocol/{en,zh-CN}/*.md   the agent-facing text — SINGLE SOURCE OF TRUTH
spec/*.schema.json         the data contract, language-agnostic
tools/build-protocol.mjs   generates the embedded copies below
  └─► src/core/protocol-data.ts, src/core/schema-data.ts, web/index.html
src/                       the CLI and the reusable core
web/index.html             the offline generator a user actually opens
adapters/                  checked-in generic adapters, regenerated from the protocol
test/                      node:test, no framework
```

**Never edit `src/core/protocol-data.ts`, `src/core/schema-data.ts`, or the marked block inside `web/index.html` by hand.** Edit `protocol/**` or `spec/**`, then:

```bash
npm run generate
```

CI runs `npm run generate -- --check` and fails if the generated files are stale.

## Changing the protocol text

This is the highest-leverage and highest-risk area. Guidelines:

- **Say what to do, not what to value.** "Read logs in slices around the failure timestamp" beats "be mindful of context length."
- **Give a weak model an exit.** Every constraint needs a defined action for when it binds. Running out of budget must mean *write the report*, not *try harder*.
- **Both languages, always.** `protocol/en/` and `protocol/zh-CN/` must stay structurally identical — the build fails on a missing fragment and a test asserts the sets match. The Chinese version is a translation for Chinese users, not a summary.
- **Add a test.** If you closed a loophole, `test/render.test.js` should assert the new wording survives into a rendered task.

## Changing the schema

`additionalProperties: false` everywhere is deliberate: a typo in a maintainer's profile should be an error, not a silently ignored field.

The five `deny` values in `policy` are `const`, not `enum`. Do not turn them into options. If you have a use case that needs one relaxed, open an issue and describe it first — the answer may be a new autonomy level rather than a hole in the floor.

Adding a field means: `spec/*.schema.json`, the TypeScript type in `src/core/types.ts`, the mapping in `src/core/task.ts`, and — if a user should be able to fill it in — `web/index.html`.

## Writing an adapter

An adapter turns the rendered protocol into whatever format one assistant expects. Look at `src/commands/adapters.ts`; both existing adapters are ~30 lines because the protocol body is shared.

Hard rule: **adapters emit markdown only.** No scripts, no post-install steps, no dependencies. A skill package that can execute code is a supply chain the user cannot audit before installing it, and `test/cli.test.js` enforces this.

## Tests

`node:test`, no framework. Every test should be able to fail for a real reason — a test that only asserts a function returns something is noise.

Areas worth strengthening: more redaction cases from real logs, more prompt-injection phrasings, and adapter output for assistants not yet covered.

## Commits and PRs

Plain, imperative subject lines. Describe *why* in the body if it is not obvious. Small PRs get merged; large ones get questions.

By contributing you agree your work is licensed under the MIT License.
