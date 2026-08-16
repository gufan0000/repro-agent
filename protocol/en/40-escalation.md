## 4. The bug report — this is the deliverable

When you cannot fix the problem, the report **is** the result. Write it to `{{REPORT_PATH}}` in the user's working folder, and also print it in the conversation so the user can copy it.

Optimise it for one reader: a maintainer who has never seen this machine, has ten minutes, and will close the issue if they cannot reproduce it. Every section below is required. Write `Unknown` where you do not know — never fill a gap with a plausible guess.

```markdown
# <one-line symptom, specific enough to search for>

**Reported via Repro Agent** · protocol {{PROTOCOL_VERSION}} · autonomy `{{AUTONOMY}}` · {{TIMESTAMP}}

## Summary
Two or three sentences. What breaks, when, and how reliably.

## Environment
| Field | Value |
|---|---|
| Software version | |
| Build / commit | |
| Install source | (official installer / package manager / built from source / unknown) |
| OS and version | |
| Architecture | |
| Relevant runtimes | |
| Locale | |

## Reproduction
1. …
2. …

**Frequency:** always / often / sometimes / once
**First seen:** …
**Changed shortly before:** (update, new hardware, config change, none known)

## Expected vs actual
- **Expected:** …
- **Actual:** …

## Evidence

### Log excerpts
Smallest excerpt that shows the failure, with file and timestamp. Redacted per section 5.

### Local state
Only facts you verified yourself: process running or not, port bound or not, file present with size and mtime, permissions, exit code. No speculation in this subsection.

### Source references
| Claim | Source | Revision |
|---|---|---|
| … | `path/file.ext:120-134` | `v1.2.3` / `abc1234` |

If you read no source at all, do not simply assert that it was unreachable. Replace the table
with the routes you actually tried and what each one returned, so the maintainer can tell the
difference between a blocked network and a skipped step:

| Route tried | Result |
|---|---|
| `raw.githubusercontent.com/<owner>/<repo>/v1.2.3/src/import.js` | 404 |
| mirror `raw.gitcode.com/<owner>/<repo>/raw/v1.2.3/src/import.js` | connection timed out |

Then write: `Source not reachable; conclusions below are unverified against code.` Having no
local clone is not a reason to write that line — see section 2, Phase B.

## Suspected root cause
One paragraph, with a confidence level: `high` / `medium` / `low` / `unknown`. If low or unknown, say what evidence would raise it.

## Ruled out
| Hypothesis | How it was ruled out |
|---|---|

This section is what saves the maintainer the most time. Do not skip it.

## What was tried
Every change made during this session, with backup path and rollback status. `None` if read-only.

## What the maintainer could check next
Two or three concrete suggestions: a specific function, a missing guard, a log line worth adding, an instrumented build worth sending.

## Suggested triage
Severity: blocker / major / minor · Area: … · Likely a: bug / regression / config issue / environment issue / documentation gap
```

If `escalation.extra_questions` is non-empty, append an **Additional information requested by the maintainers** section answering each one. Answer from the evidence you gathered wherever you can. Where the answer is something only the user knows and they are not available, write `Unknown` and state what you did observe that bears on it. A guessed answer here is worse than no answer, because the maintainer will act on it.

Finish by telling the user, in plain language, exactly what to do with the file: which issue tracker to open, that the file is already redacted, and that they should still skim it before posting.
