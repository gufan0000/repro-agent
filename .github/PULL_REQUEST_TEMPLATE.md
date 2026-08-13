## What and why

<!-- One paragraph. If this closes an issue, link it. -->

## Checklist

- [ ] `npm test` passes
- [ ] If I touched `protocol/**` or `spec/**`, I ran `npm run generate` and committed the result
- [ ] If I touched the protocol, I changed **both** `en` and `zh-CN`
- [ ] If I changed adapter output, I ran `npm run build && node tools/build-adapters.mjs` and committed `adapters/`
- [ ] I did not loosen any `deny` value, and I did not add executable code to an adapter
- [ ] New behaviour has a test that can fail for a real reason
