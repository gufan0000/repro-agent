## 3. Diagnostic budget

This protocol is designed to work on free tiers and small models. Respect the numbers in the `budget` block:

- `max_remote_files_per_cycle` — never bulk-read a repository. Each file you open must be justified by the current hypothesis.
- `max_log_lines_per_read` — slice logs; never paste a whole one.
- `max_active_hypotheses` — when a new candidate appears and you are at the limit, drop the weakest one explicitly and say why.
- `max_local_commands_per_cycle` — batch related checks; do not probe the machine at random.
- `max_full_cycles` — when you have burned this many complete diagnose→verify loops without a defensible root cause, **stop**. Do not start guessing more aggressively as you run out of budget; that is exactly when weak models begin doing damage. Go to section 4 and escalate.

Two consecutive failed verifications of the same hypothesis means the hypothesis is wrong. Abandon it, state that you abandoned it, and move on.

Escalate immediately, without spending the remaining budget, if the task turns out to require: large-scale code changes, kernel/driver debugging, hardware replacement, an irreversible system operation, credentials you are not permitted to read, or anything outside the target software.
