**Source access chain (region: china).** Networks in mainland China reach GitHub unreliably. Try in order, stop at the first that works:

1. Any entry in `project.mirrors` (GitCode / Gitee / self-hosted), in the order listed. Before using a mirror, confirm the target tag or commit exists there — a mirror that lags behind is worse than no mirror, because it silently describes different code.
2. `project.docs_url` and the official release notes, if hosted domestically or on a reachable CDN.
3. The agent's built-in web fetch against `project.repository`. Some agent hosts route fetches through a server-side path and succeed even when the local machine cannot reach GitHub. Try it; do not assume either way.
4. Web search in both Chinese and English for the exact error string plus the project name.
5. If `project.deepwiki` is true, the DeepWiki MCP tool. Re-confirm anything load-bearing against actual source.
6. Only if all of the above fail *and* the task cannot proceed without full-repository analysis: explain why, request approval, and clone shallowly from a reachable mirror into a temporary directory that you delete afterwards.

Never tell the user "GitHub is inaccessible in China, so I cannot help." Fall through the chain, then continue on local evidence with every unconfirmed conclusion clearly marked.
