**Source access chain (region: global).** Try in order, stop at the first that works:

1. The agent's own web fetch, **one file at a time**, at the resolved ref: `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>`.
2. Any entry in `project.mirrors`, in the order listed. Mirrors expose the same file-level access: Gitee is `https://gitee.com/<owner>/<repo>/raw/<ref>/<path>`, GitCode is `https://raw.gitcode.com/<owner>/<repo>/raw/<ref>/<path>`.
3. `project.docs_url` and official release notes.
4. Web search, for the exact error string plus the project name. Treat forum answers as leads to verify, never as conclusions.
5. If `project.deepwiki` is true, the DeepWiki MCP tool, for structural comprehension of a public repository. Anything it tells you that will end up in the report must be re-confirmed against the actual source.
6. Only if all of the above fail *and* the task cannot proceed without full-repository analysis: explain why, request approval, and clone shallowly into a temporary directory that you delete afterwards.
