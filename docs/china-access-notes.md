# Notes on source access from mainland China

**Researched 2026-08-14. Product policies change; treat every claim here as dated, and re-check before relying on it.**

These notes explain why `region: china` orders its fallback chain the way it does. They are background, not guarantees — the protocol deliberately never promises reachability.

## The problem

A user in mainland China reports a bug. The agent's first instinct is to read the project's source on GitHub to find out how the feature is supposed to work. That fetch may time out, may partially succeed, or may work fine — it varies by carrier, province, time of day, and which GitHub domain is involved (`github.com`, `raw.githubusercontent.com` and `objects.githubusercontent.com` do not behave identically).

The failure mode that matters is not "the fetch failed". It is the agent concluding *"GitHub is inaccessible, so I cannot help you"* and stopping — with the user's logs, config and installed build sitting right there, unexamined.

## Why mirrors come first

GitCode supports pull-mirroring a GitHub or Gitee repository, keeping branches, tags and commit metadata in sync.

A mirror is preferred over a coin-flip fetch, but it has one specific hazard the protocol calls out: **a mirror that lags is worse than no mirror**, because it silently describes different code. That is why the instruction is to confirm the target tag or commit exists on the mirror before reading from it, rather than just reading whatever `main` happens to be.

## Why the direct fetch is still attempted, after the mirrors

Some agent hosts perform web fetches server-side rather than from the user's machine, in which case the user's local connectivity is irrelevant. Tencent's CodeBuddy release notes describe a WebFetch implementation that races a local fetch against a remote API. WorkBuddy is part of the same product family.

What this does **not** establish: that any given host, version, or GitHub domain will succeed on any given network. No vendor documents that, and it would be irresponsible to write it into a protocol as though they had.

So the chain tries it, and treats the result as an observation rather than a prediction. The protocol's exact wording is: *"Try it; do not assume either way."*

## Why DeepWiki is last and conditional

DeepWiki offers a remote MCP endpoint for structural comprehension of public repositories — currently free, unauthenticated, and public-repos-only.

It is useful for orienting in an unfamiliar codebase and unsuitable as a source of record: it is an index of the repository, not the repository. The protocol therefore gates it behind an explicit `deepwiki: true` in the maintainer's profile, and requires anything load-bearing to be re-confirmed against actual source before it reaches the bug report.

## Why cloning is last, and requires approval

A shallow clone of a reachable mirror will usually work. It is last anyway, because it is the most expensive option in every dimension that matters to this project's users: bandwidth, disk, time, and the size of the blast radius if something in that repository is hostile. The protocol requires the agent to explain why the previous five routes were insufficient before asking.

## What happens when everything fails

The protocol does not permit giving up. The agent continues on local evidence — logs, config, process state, file timestamps — and marks every conclusion that lacks source confirmation as **unverified** in the report. An unverified-but-honest report is still a useful report; a maintainer can confirm the source side in thirty seconds because they have the source.

## Not verified in the field

Nobody has yet run the `china` chain across a representative set of mainland carriers, provinces, agent hosts and models. Until someone has, this document is reasoning from vendor documentation, not measurement.

If you are on such a network, a [field report](https://github.com/gufan0000/bugbridge/issues/new?template=field-report.yml) about which route actually worked is the single most useful thing you can contribute.

## Sources consulted

- WorkBuddy product guide, working modes and permission modes, skills, MCP configuration — `codebuddy.cn/docs/workbuddy/`
- CodeBuddy Code release notes describing the WebFetch local/remote race — `codebuddy.cn/docs/cli/release-notes/`
- GitCode repository mirroring documentation — `docs.gitcode.com`
- DeepWiki MCP documentation — `docs.devin.ai/work-with-devin/deepwiki-mcp`

Links are omitted deliberately: vendor documentation URLs churn, and a dead link in a repository is worse than a search term. The paths above are stable enough to find.
