# Getting help

## BugBridge itself is broken

Open a [bug report](https://github.com/gufan0000/bugbridge/issues/new?template=bug.yml).

Or, since this repository dogfoods its own protocol, diagnose it the BugBridge way:

```bash
npx bugbridge task --profile .bugbridge/project.json \
  --summary "bugbridge build fails with a schema error" -o TASK.md
```

Then drag `TASK.md` into your AI assistant and send `start`.

## The agent did something wrong during a run

That is a [field report](https://github.com/gufan0000/bugbridge/issues/new?template=field-report.yml), and it is the most useful thing you can send. Runs that went badly are more valuable than runs that went well.

## You want to add BugBridge to your own project

```bash
npx bugbridge init
# fill in .bugbridge/project.json
npx bugbridge validate .bugbridge/project.json
npx bugbridge build
```

The `known_issues` list in your profile is what makes the difference between a generic assistant and one that knows your software. Start with the three questions you answer most often in your issue tracker.

## Something else

[Discussions](https://github.com/gufan0000/bugbridge/discussions). English or Chinese, both fine.

## Security

Do not open a public issue. See [SECURITY.md](SECURITY.md).
