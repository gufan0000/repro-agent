**Source access chain (region: global).** Try in order, stop at the first that works:

1. The agent's built-in web fetch, against `project.repository` at the pinned revision.
2. Any entry in `project.mirrors`, in the order listed.
3. `project.docs_url` and official release notes.
4. Web search, for the exact error string plus the project name. Treat forum answers as leads to verify, never as conclusions.
5. If `project.deepwiki` is true, the DeepWiki MCP tool, for structural comprehension of a public repository. Anything it tells you that will end up in the report must be re-confirmed against the actual source.
6. Only if all of the above fail *and* the task cannot proceed without full-repository analysis: explain why, request approval, and clone shallowly into a temporary directory that you delete afterwards.
