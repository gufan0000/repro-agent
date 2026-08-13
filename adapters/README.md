# Adapters

Generated from `protocol/**` by `tools/build-adapters.mjs`. **Do not edit these files** — CI regenerates them and fails on a diff.

These are the *generic* versions, with no project profile baked in. They work as-is: an agent that reads one of them will follow the protocol using local evidence and public documentation. To get a version that knows your software, run `npx repro-agent build` with your own profile.

| File | Where it goes |
|---|---|
| `generic/AGENTS.md` | Commit at your repository root as `AGENTS.md`, or hand the file directly to a user's assistant. Read by Claude Code, Cursor, Codex, Cline, and most others. |
| `generic/AGENTS.zh-CN.md` | Same, Chinese, with the `china` source-access chain. |
| `workbuddy/repro-agent/SKILL.md` | Zip the `repro-agent/` folder and upload it as a skill in WorkBuddy or OpenClaw. |
| `workbuddy/repro-agent/SKILL.zh-CN.md` | Same, Chinese. Rename to `SKILL.md` inside the package before zipping. |

Every one of these is **pure markdown**. No scripts, no dependencies, no post-install steps — a skill package that can execute code is a supply chain you cannot audit before installing it, and a test enforces this.

## Writing a new one

`src/commands/adapters.ts`. Both existing adapters are about thirty lines, because the protocol body is shared via `renderProtocol()`. An adapter's job is only to wrap that body in whatever envelope a particular host expects — frontmatter, a filename convention, a directory layout.
