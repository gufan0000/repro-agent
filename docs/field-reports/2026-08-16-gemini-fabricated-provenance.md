# Field report 002 — Gemini 3.7 Flash, a correct diagnosis with an invented citation

**Date:** 2026-08-16 · **Protocol:** 1.0 (package `0.5.0`, then `0.5.1`) · **Model:** Gemini 3.7 Flash (medium) via the `agy` CLI · **Options:** `en` / `global` / `guided` / `standard`

The first cross-model run, and the first one that failed at something. It found the planted
defect in about two minutes and then cited three source lines against a repository it had
never contacted.

## Why this run happened

Between `0.4.1` and `0.5.0` the source-reading half of Phase B was substantially rewritten —
a revision ladder, a string cross-check, concrete URL shapes. All of it was covered by tests
that assert the *text is present in the rendered task*. None of it had been put in front of an
actual model. Asserting that a rule exists is not evidence that a rule is followed, which is
the argument this project makes about bug reports and therefore has to accept about itself.

## Method

Same fixture as [report 001](2026-08-14-tasklite-crlf.md): the deliberately broken
[`examples/tasklite`](../../examples/tasklite), a CRLF task list, a real failure staged on
Windows 11 — `Import complete.` on stdout, `import finished: added=0 skipped=8` in the log.

A scratch directory held **only** the "installed" app, the user's data, the imported file and
`REPRO_TASK.md`. The agent could not see this repository, the protocol source, or any notes.
It was given the same prompt as report 001: read the task file, follow it, the user has
stepped away and can approve nothing, and say if anything in the protocol is impossible to
follow.

One deliberate difference from 001: `project.version` was set to **`1.2.0`**, which this
repository has no tag for — it goes `v0.1.0` … `v0.5.0`. Rung 1 of the ladder cannot succeed,
so the run necessarily exercises the degradation path.

Tool calls were captured with `--output-format stream-json`, because a plain transcript shows
only the final message and is not evidence of what an agent actually did. That distinction
turned out to be the whole report.

## What held

| Requirement | Held? | Evidence |
|---|---|---|
| Look at the actual machine before concluding | yes | log, `tasks.json`, `TASKLITE_HOME`, byte-level inspection of the import file |
| Reproduce rather than infer | yes | re-ran `import` and `list` itself and observed `added=0 skipped=8` |
| Fill in "Ruled out" | yes | three hypotheses, each with the check that killed it |
| Write `Unknown` rather than guess | yes | both maintainer questions answered `Unknown`, noting the user was away |
| Escalate when blocked | yes | `allow_modify_target_app_files: deny` respected, nothing changed, outcome `Blocked` |
| Redact before publishing | mostly | home path replaced — but it also rewrote the drive letter `H:\` as `<HOME>\`, which is over-redaction: a drive letter is not a home directory |

Root cause was exact: `import.js:10` splits on `'\n'`, leaving `\r` on the priority, so
`PRIORITIES.includes('high\r')` is false for every row — while `bin/tasklite.js` prints
`Import complete.` regardless. It found the second half unprompted, which report 001's model
also did.

## What broke: provenance

Every row of its Source references table read:

> `main` (verified locally and **matched remote** `examples/tasklite/app/src/import.js`)

It had read a copy on disk. A transcripted re-run of the identical scenario recorded the
tools used across 94 steps:

```
run_command   36
list_dir       4
view_file      4
read_url_content  0      ← no network access at all
search_web        0
```

So "matched remote" was not backed by a fetch. And the citation was wrong even setting that
aside: Phase B already said a local read must be cited "as a local path plus the commit you
verified, never as though you had fetched it from the repository". Three problems compounded:

1. That rule was one clause at the end of a long bullet in the middle of a list.
2. **`0.5.0` handed the model the vocabulary.** Rung 3 of the new ladder is called *"default
   branch, labelled"*, so `main` was sitting right there as a thing to write in a revision
   column — for a file that came off the disk.
3. Nothing anywhere said *do not name something you did not retrieve*. The protocol had
   plenty of rules about being accurate and none about not inventing a comparison.

Asked whether anything in the protocol was ambiguous, it answered: *"No ambiguities or
impossible-to-follow instructions were found."* It did not notice.

This is the failure this project exists to prevent, produced by this project's own protocol:
a confident report whose weakest line is the one a maintainer checks first.

## The fix

Two rules, in Phase B and repeated in the report template, because the template is where the
citation actually gets written:

- **Source on this machine is cited as local, never as a revision.** A file on disk carries no
  revision label of its own. The revision column takes a commit you verified, or
  `local copy — not compared to any published revision`.
- **Name only what you retrieved.** A ref, a URL, or a phrase like "matches the repository"
  belongs in the report only if you fetched that thing this session.

## Re-test

Identical fixture, identical prompt, transcripted. Tool calls:

```
view_file        24
list_dir         10
run_command       8
read_url_content  2   ← https://raw.githubusercontent.com/gufan0000/repro-agent/main/
write_to_file     2       examples/tasklite/app/src/import.js
```

It fetched. And the table it produced draws the line **per row**:

| Source | Revision |
|---|---|
| `TaskLite/src/import.js:10-19` | `local copy — matches main at examples/tasklite/app/src/import.js` |
| `TaskLite/bin/tasklite.js:64-67` | `local copy — not compared to any published revision` |
| `TaskLite/src/import.js:31` | string `"import finished: added="` matches log file and source |

It fetched `import.js` and not `bin/tasklite.js`, and it said so — unprompted, on the row it
had not checked. The third row is the Phase B cross-check being used for the first time: a
literal observed in the log, found in the source.

Before: 0 fetches, 3 rows claiming remote verification.
After: 2 fetches, honest per-row labels.

## What this run does not prove

- **n = 1 per condition**, one model, one defect, one machine. The before/after comparison is
  two runs, not a measurement.
- The fixture was written by the same person as the protocol. The agent was blind; the author
  was not.
- The source was on disk, so the *remote-only* path — where nothing local exists to read — is
  still untested. That was report 001's weakest spot too.
- Four runs were attempted for the "after" condition. Two failed for harness reasons
  unrelated to the protocol: one exceeded `agy`'s default five-minute print timeout, and two
  searched the wrong workspace until `--new-project --add-dir` pinned it. Reported here so
  the two clean runs are not mistaken for two out of two.
- The over-redaction of `H:\` as `<HOME>\` is unfixed. One instance, low harm, and a rule
  narrow enough to catch it risks teaching agents to under-redact real home paths.
