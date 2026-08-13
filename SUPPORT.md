# Getting help

## Repro Agent itself is broken

Open a [bug report](https://github.com/gufan0000/repro-agent/issues/new?template=bug.yml).

Or, since this repository dogfoods its own protocol, diagnose it the Repro Agent way:

```bash
npx repro-agent task --profile .repro/project.json \
  --summary "repro-agent build fails with a schema error" -o TASK.md
```

Then drag `TASK.md` into your AI assistant and send `start`.

## The agent did something wrong during a run

That is a [field report](https://github.com/gufan0000/repro-agent/issues/new?template=field-report.yml), and it is the most useful thing you can send. Runs that went badly are more valuable than runs that went well.

## You want to add Repro Agent to your own project

```bash
npx repro-agent init
# fill in .repro/project.json
npx repro-agent validate .repro/project.json
npx repro-agent build
```

The `known_issues` list in your profile is what makes the difference between a generic assistant and one that knows your software. Start with the three questions you answer most often in your issue tracker.

## Something else

[Discussions](https://github.com/gufan0000/repro-agent/discussions). English or Chinese, both fine.

## Security

Do not open a public issue. See [SECURITY.md](SECURITY.md).
