# `tasklite import` silently drops every row when the source file has Windows (CRLF) line endings

**Reported via Repro Agent** · protocol 1.0 · autonomy `guided` · 2026-08-14 (local time)

## Summary
`tasklite import <file>` prints "Import complete." even when it added zero tasks. If the
imported text file uses CRLF (`\r\n`) line endings — the Windows-native default, e.g. from
Notepad — every `title|priority` row is silently skipped because the trailing `\r` is left
attached to the priority field and never matches the app's fixed priority list. No error is
shown to the user; the only trace is a debug-suppressed-by-default log line.

## Environment
| Field | Value |
|---|---|
| Software version | 1.2.0 (`--version` output, matches `package.json`) |
| Build / commit | `2079bad7003022f80e963e23110ba341204c8294` (local checkout of `gufan0000/repro-agent`) |
| Install source | Example fixture inside the `repro-agent` repository (`examples/tasklite/app`), run via `node bin/tasklite.js`; not an installer or package-manager install |
| OS and version | Windows 11 Pro (build 10.0.26200) |
| Architecture | Unknown (not checked — not relevant to this bug) |
| Relevant runtimes | Node.js v24.14.0 (repo requires >= 18) |
| Locale | Unknown — not checked |

## Reproduction
1. Create a plain-text file using Windows/CRLF line endings, with lines in the documented
   `title|priority` format, e.g.:
   ```
   Renew domain|high
   Pay invoice 4471|high
   Book dentist|normal
   ```
2. Run `tasklite import <file>`.
3. The CLI prints `Import complete.` with no warning or error.
4. Run `tasklite list` — the imported rows are not present; only tasks added before the
   import (if any) remain.

**Frequency:** Always, for any import file whose line endings are CRLF and whose rows use
the `title|priority` form (100% of rows skipped in the observed case: 8/8).
**First seen:** 2026-08-13 (only occurrence observed on this machine).
**Changed shortly before:** None known — no `config.json` exists on this machine (defaults
in use), and there is no evidence of a recent update or config change.

## Expected vs actual
- **Expected:** All 8 well-formed rows (valid titles, valid `low`/`normal`/`high` priorities)
  are imported, and `Import complete.` reflects that.
- **Actual:** 0 of 8 rows were imported. `Import complete.` was printed regardless. The task
  list after import contained only the one task that existed before the import ran.

## Evidence

### Log excerpts
From `<HOME>\AppData\Roaming\TaskLite\logs\tasklite-2026-08-13.log`:
```
2026-08-13T18:07:43.617Z [INFO] saved 1 tasks to <HOME>\AppData\Roaming\TaskLite\tasks.json
2026-08-13T18:07:56.017Z [INFO] import started: <HOME>/Desktop/my-tasks.txt
2026-08-13T18:07:56.018Z [INFO] import finished: added=0 skipped=8
2026-08-13T18:07:56.019Z [INFO] saved 1 tasks to <HOME>\AppData\Roaming\TaskLite\tasks.json
```
Note: the per-row reason (`skipped row with unrecognised priority: …`) is logged at `debug`
level (`import.js:23`), but the default `logLevel` is `info` (`config.js:7`), so that detail
never reaches the log file unless the user has manually set `"logLevel": "debug"` in a
`config.json` that, on this machine, does not exist.

### Local state
- `<HOME>\AppData\Roaming\TaskLite\tasks.json` — present, 93 bytes, contains exactly one
  task (`Buy milk`, `normal`), i.e. the task added *before* the import, none of the imported
  rows.
- `<HOME>\AppData\Roaming\TaskLite\config.json` — **not present** (confirmed: read attempt
  returned "No such file or directory"). The app therefore runs on built-in defaults
  (`dataFile: tasks.json`, `defaultPriority: normal`, `logLevel: info`).
- `TASKLITE_HOME` environment variable — **not set**, so the default per-OS data directory
  is in use. Confirmed identical target directory via `tasklite where` and via the log's
  `saved … to` lines.
- The source import file (`<HOME>\Desktop\my-tasks.txt`, 173 bytes, 8 non-empty lines) was
  read and its raw bytes confirmed to use `\r\n` line endings on every line.
- Replaying the app's exact parsing logic (same split/match rules as `import.js`) against
  that file, read-only, reproduced `added=0 skipped=8` exactly, with every priority field
  arriving as e.g. `"high\r"` instead of `"high"`. Re-running the same replay with a
  CRLF-tolerant split (`/\r?\n/`) and a `.trim()` on the priority field produced
  `added=8 skipped=0` against the identical, unmodified file content.

### Source references
| Claim | Source | Revision |
|---|---|---|
| Import splits the input on `'\n'` only | `examples/tasklite/app/src/import.js:10` | commit `2079bad7`, v1.2.0 |
| A row's priority is accepted only via exact string match against `['low','normal','high']`, with no trimming | `examples/tasklite/app/src/import.js:1,17-21` | commit `2079bad7`, v1.2.0 |
| Unrecognised-priority rows are counted as skipped and logged at `debug` level only, never abort the run | `examples/tasklite/app/src/import.js:21-25,31` | commit `2079bad7`, v1.2.0 |
| `Import complete.` is printed unconditionally after `importTasks()` returns, regardless of `added`/`skipped` counts | `examples/tasklite/app/bin/tasklite.js:63-67` | commit `2079bad7`, v1.2.0 |
| Default `logLevel` is `info`; `debug` messages are filtered out unless `config.json` overrides it | `examples/tasklite/app/src/config.js:4-8`, `examples/tasklite/app/src/log.js:5,12,18` | commit `2079bad7`, v1.2.0 |
| CLI version string | `examples/tasklite/app/bin/tasklite.js:9`, confirmed live via `tasklite --version` → `1.2.0` | commit `2079bad7`, v1.2.0 |

## Suspected root cause
**Confidence: high.** `import.js` tokenises the input file with `raw.split('\n')` (line 10)
instead of a CRLF-tolerant split, and then matches the priority field with a strict
`PRIORITIES.includes(priority)` (line 21) with no trimming. On a file saved with Windows
line endings, every line except possibly the last ends in `\r`, so the extracted priority
string is `"high\r"`/`"normal\r"`/`"low\r"` rather than `"high"`/`"normal"`/`"low"`, which
never matches, so every such row is counted as skipped. Because `Import complete.` is
printed unconditionally and the per-row skip reason is only logged at `debug` level (which
is off by default), the user gets no visible indication that anything went wrong — the
command reports success while importing nothing. This was directly confirmed by replaying
the exact parsing rule against the user's real file and reproducing the exact `added=0
skipped=8` figure recorded in the app's own log, and by showing the discrepancy disappears
with a CRLF-tolerant split.

## Ruled out
| Hypothesis | How it was ruled out |
|---|---|
| Import wrote to a different data directory than `list`/`add` read from (e.g. via `TASKLITE_HOME`) | `TASKLITE_HOME` is unset; the log's `saved … to` path is identical before and after the import, and matches the live output of `tasklite where`; `tasks.json` exists at exactly that path. |
| `config.json` is corrupt or misconfigured (e.g. an invalid `defaultPriority`) | `config.json` does not exist on this machine at all, so the app is running on its documented defaults; `defaultPriority` (`normal`) is a valid value and is not even the code path exercised here, since every row in the file included an explicit `\|priority` field. |
| The priorities in the source file are simply misspelled or use different casing | The raw file bytes show exactly `high`, `normal`, `low` (correct spelling/casing) immediately followed by `\r` — confirmed by dumping the file with `JSON.stringify`, not just visual inspection. |
| Import silently failed to read the file at all | The log shows `import started: …` followed by `import finished: added=0 skipped=8`, i.e. the file was read and parsed; the failure is in per-row validation, not file access. |

## What was tried
`None` — this was a read-only diagnostic session. No file under the TaskLite install
directory, the TaskLite data directory, or the user's import file was modified. The only
artifact written was a disposable Node.js script in the agent's own scratch folder
(`H:\tmp\fieldtest\_verify_sim.mjs`) used to replay the app's parsing logic in memory against
a copy read from the real file; it performed no writes to any application or user file and
can be deleted at any time.

No fix was applied because:
- Editing `import.js` is disallowed by this task's policy (`allow_modify_target_app_files:
  deny`), which cannot be relaxed without a direct instruction from the user.
- The one available non-source workaround — re-saving the user's `my-tasks.txt` with Unix
  (`LF`) line endings before re-importing — modifies the user's data file and requires
  explicit per-change approval under this protocol's `guided` autonomy. The user was not
  available to approve it during this session, so it was not performed. See the assistant's
  chat message for the exact approval that would have been requested.

## What the maintainer could check next
- `examples/tasklite/app/src/import.js:10` — split on `/\r?\n/` instead of `'\n'`, and/or
  `.trim()` each field before matching, so CRLF-terminated files (the Windows default) parse
  correctly.
- `examples/tasklite/app/bin/tasklite.js:63-67` — consider making `Import complete.` reflect
  the actual counts (e.g. `Import complete: 8 added, 0 skipped.`) so a 100%-skip run is
  visible without reading the log.
- `examples/tasklite/app/src/import.js:23` — the per-row skip reason is only logged at
  `debug`, which is off by default; consider logging a rolled-up warning at `info` when
  `skipped > 0`, since that is currently the only self-service signal a user has.
- There is no automated test covering `import.js` with CRLF input (no test files exist under
  `examples/tasklite/`) — worth adding one, since this is a plausible everyday case for
  Windows users pasting from Notepad, Excel, or exported text.

## Suggested triage
Severity: major · Area: `examples/tasklite/app/src/import.js` (plain-text import parser) ·
Likely a: bug

## Additional information requested by the maintainers
- **Which program produced the file you were importing (Excel, Notepad, an export from
  another app)?** Unknown — the user was unavailable to answer during this session. Evidence
  available: the file uses CRLF (`\r\n`) line endings, which is consistent with (but not
  proof of) Notepad or another native Windows editor, or an export that preserves Windows
  line endings; this should be confirmed with the user directly.
- **Did this ever work on an earlier version of TaskLite?** Unknown — the user was
  unavailable to answer. The repository's `CHANGELOG.md` has no entries mentioning TaskLite,
  `import`, or line-ending handling, so no evidence either way was found in the source
  history that was reachable from this machine.

## Redaction
The following categories were redacted from this report: the user's home directory and
Windows account name (replaced with `<HOME>` / `<USER>`). No API keys, tokens, passwords,
connection strings, email addresses, public IPs, MAC addresses, machine names, or license
keys were present in any of the evidence collected, so no other redaction categories apply.
