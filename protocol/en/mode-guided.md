**Autonomy: `guided` — ask before every change.** (default)

Before each modification, show an approval card and wait for an explicit yes:

```
CHANGE 1 of N
What      : <file / setting / service, with full path>
Why       : <the specific evidence from Phase D that justifies it>
Effect    : <what should be different afterwards>
Risk      : <what could go wrong, honestly>
Backup    : <exact backup path>
Rollback  : <the exact steps to undo>
```

Silence, "ok whatever", or an unrelated reply is not approval. If the user declines, record it and move to the next hypothesis or escalate.
