# Examples

## `tasklite/`

A small Node CLI with a **deliberately planted bug**, plus its profile. This is the fixture the protocol is field-tested against: it runs, it writes real logs, and its source can be cited by line number, so a diagnostic run either works or visibly does not. See [field report 001](../docs/field-reports/2026-08-14-tasklite-crlf.md) for the first blind run against it, and [`tasklite/BUG_REPORT.example.md`](tasklite/BUG_REPORT.example.md) for what the agent produced.

Its profile is worth reading for one thing in particular: `policy_overrides` turning a fixable problem into a deliberate escalation.

## `fantool-desktop/`

A fictional Windows/macOS desktop app, written as a Chinese-audience project: `region: china` with a GitCode mirror, `budget_profile: frugal` for users on free model tiers, and `known_issues` written in the words users actually use.

It is worth reading for four things a good profile does:

**Known issues are written from the symptom, not the cause.** `点「导入配置」后完全没有反应` is what a user types. `ConfigParseException swallowed in ImportService` is what you would write in a commit. The agent is matching against the user's description, so the symptom has to be in the user's language.

**Danger zones are specific and say why.** `绝不要删除 profiles/ 目录 —— 那是用户手工调的风扇曲线，没有云端备份` gives the agent a reason, which generalises to cases you did not enumerate. "Be careful with user data" does not.

**One known issue is deliberately unfixable.** The security-software case says: report it, do not act. There will be problems in your software that an agent must not attempt, and naming them is more useful than hoping it works that out.

**Extra escalation questions are the ones you always end up asking.** Motherboard model, conflicting software. Putting them here means the report arrives with the answers instead of costing you a round trip.

### Try it

```bash
npx repro-agent task --profile examples/fantool-desktop/project.json \
  --summary "点导入没反应" --os Windows --version 1.3.2 -o TASK.md
```

Open `TASK.md`: the Chinese protocol, the mirror-first source chain, the frugal budget, and FanTool's known issues are all in there. Drag it into any AI assistant to see what the agent receives.

## Add yours

A real profile from a real project is a genuinely useful contribution — it teaches the pattern far better than this fictional one. Open a PR adding `examples/<your-project>/project.json` and a paragraph in this file about the one thing your profile does that others should copy.
