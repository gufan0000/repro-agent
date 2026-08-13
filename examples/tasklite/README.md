# TaskLite — the field-test fixture

A small, real, deliberately broken Node CLI. It exists so this protocol can be *tested*
rather than described.

> **The bug in `app/` is intentional. Please do not fix it.**
> `src/import.js` splits on `'\n'` and matches the priority field exactly, so a file with
> Windows CRLF line endings has every row silently skipped while the CLI still prints
> `Import complete.` That is the defect a diagnosing agent is supposed to find.

## Why a fixture at all

The other example here, [`fantool-desktop`](../fantool-desktop), is a fictional profile:
useful for showing what a good `project.json` looks like, useless for finding out whether
an agent actually follows the protocol. TaskLite runs, breaks, writes real logs, and has
source you can cite by line number — so a run against it either works or visibly does not.

The first such run is written up in
[field report 001](../../docs/field-reports/2026-08-14-tasklite-crlf.md). It found five
real holes in the protocol, all of which have since been closed. The report the agent
produced is committed verbatim as [`BUG_REPORT.example.md`](BUG_REPORT.example.md) — worth
reading if you want to know what this project means by "a report a maintainer can act on".

## Reproduce the failure

```bash
node app/bin/tasklite.js add "Buy milk"
printf 'Renew domain|high\r\nPay invoice|high\r\nBook dentist|normal\r\n' > my-tasks.txt
node app/bin/tasklite.js import my-tasks.txt   # says "Import complete."
node app/bin/tasklite.js list                  # only "Buy milk"
```

The only trace is in the log: `import finished: added=0 skipped=8`. Run
`node app/bin/tasklite.js where` to find the data directory it uses — `%APPDATA%\TaskLite`
on Windows, `~/Library/Application Support/TaskLite` on macOS, `~/.config/tasklite`
elsewhere. Set `TASKLITE_HOME` to point it somewhere disposable.

## Run the protocol against it yourself

```bash
npx repro-agent task --profile examples/tasklite/project.json \
  --summary "Import said it worked but none of my tasks are there" \
  --os Windows --version 1.2.0 -o REPRO_TASK.md
```

Hand `REPRO_TASK.md` to any assistant that can read your files and say `start`.

Two caveats if you are doing this to evaluate a model. The bug is documented on this page
now, so an agent that can read this file is no longer blind — point it at the app only.
And the interesting question is not whether it finds the CRLF issue; it is whether it
cites source at the installed revision, fills in "Ruled out", writes `Unknown` instead of
guessing, and stops at the boundaries. A model can reach the right answer while breaking
every rule that makes the answer trustworthy.

## What the profile demonstrates

`policy_overrides` doing real work: `allow_modify_target_app_files: "deny"` is what turns
this from a fix into an escalation. The correct repair is a one-line source change, and
patching a user's installed copy would be silently lost on the next upgrade while making
their next bug report misleading. Denying it is how the maintainer says so — and in field
report 001 the agent respected it, reported the cause, and changed nothing.
