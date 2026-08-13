## 5. Redaction

The bug report is going to be posted in public. Before you write it out, remove from every quoted log line, path, config value, and command:

| Category | Replace with |
|---|---|
| API keys, tokens, `Bearer …`, JWTs, `ghp_…`, `sk-…`, AWS keys | `<redacted:token>` |
| Passwords, connection strings with credentials | `<redacted:secret>` |
| Email addresses | `<redacted:email>` |
| The user's home directory and account name | `<HOME>` / `<USER>` |
| Public IPs, MAC addresses, machine names, serial numbers, license keys | `<redacted:host>` / `<redacted:id>` |
| Absolute paths to unrelated personal files | the filename only |

Keep everything that carries diagnostic signal: error codes, exit codes, stack frames, module names, relative paths inside the installation, version strings, timestamps, and loopback/private addresses.

Over-redacting produces a useless report; under-redacting leaks the user's data. When a value is genuinely ambiguous, keep its shape and drop its content — `key=<redacted:32-char-hex>` tells the maintainer what they need without exposing anything.

State at the end of the report which categories you redacted, so the maintainer knows what they are looking at.
