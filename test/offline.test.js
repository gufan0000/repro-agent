import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'web', 'index.html'), 'utf8');

/**
 * The offline page is the one artifact a non-technical user actually opens, often after
 * being told "this uploads nothing". These tests are what makes that claim checkable.
 */

test('the page declares a content security policy that forbids network access', () => {
  const match = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(match, 'no CSP meta tag');
  const csp = match[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test('the page makes no network calls', () => {
  for (const api of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator.sendBeacon', 'importScripts']) {
    assert.ok(!html.includes(api), `web/index.html references ${api}`);
  }
});

test('the page loads no external resources', () => {
  const urls = html.match(/(?:src|href)\s*=\s*["'](?!#)([^"']+)["']/g) ?? [];
  assert.deepEqual(urls, [], `external references found: ${urls.join(', ')}`);
  assert.ok(!/@import|url\(\s*['"]?https?:/i.test(html), 'CSS pulls in a remote resource');
});

test('the page stores nothing on the machine beyond the file the user downloads', () => {
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
    assert.ok(!html.includes(api), `web/index.html uses ${api}`);
  }
});

test('the protocol text is embedded, not fetched', () => {
  const start = html.indexOf('/* REPRO:PROTOCOL:START */');
  const end = html.indexOf('/* REPRO:PROTOCOL:END */');
  assert.ok(start !== -1 && end > start, 'protocol markers missing');
  const block = html.slice(start, end);
  assert.match(block, /const PROTOCOL = \{/);
  for (const fragment of ['00-header', '10-authority', '20-workflow', 'route-china', 'mode-auto-safe']) {
    assert.ok(block.includes(fragment), `embedded protocol is missing ${fragment}`);
  }
  assert.ok(block.includes('zh-CN') && block.includes('"en"'), 'both languages must be embedded');
});

test('the profile markers are present so `repro-agent build` can prefill the page', () => {
  const start = html.indexOf('/* REPRO:PROFILE:START */');
  const end = html.indexOf('/* REPRO:PROFILE:END */');
  assert.ok(start !== -1 && end > start, 'profile markers missing');
  assert.match(html.slice(start, end), /const EMBEDDED =/);
});

test('the embedded protocol JSON is syntactically valid JavaScript', async () => {
  const block = html.slice(
    html.indexOf('/* REPRO:PROTOCOL:START */') + '/* REPRO:PROTOCOL:START */'.length,
    html.indexOf('/* REPRO:PROTOCOL:END */'),
  );
  const { runInNewContext } = await import('node:vm');
  const protocol = runInNewContext(`${block}; PROTOCOL`);
  assert.ok(protocol.en['00-header'].startsWith('# Repro Agent'));
  assert.ok(protocol['zh-CN']['00-header'].startsWith('# Repro Agent'));
});

test('the embedded protocol matches protocol/ on disk', async () => {
  const { PROTOCOL_FRAGMENTS } = await import('../dist/core/protocol-data.js');
  const block = html.slice(
    html.indexOf('/* REPRO:PROTOCOL:START */') + '/* REPRO:PROTOCOL:START */'.length,
    html.indexOf('/* REPRO:PROTOCOL:END */'),
  );
  const { runInNewContext } = await import('node:vm');
  const embedded = runInNewContext(`${block}; PROTOCOL`);
  // Compared as JSON: objects from another VM realm have a different Object.prototype,
  // which deepStrictEqual treats as a mismatch even when the contents are identical.
  assert.equal(JSON.stringify(embedded), JSON.stringify(PROTOCOL_FRAGMENTS));
});

test('the page is bilingual', () => {
  assert.ok(html.includes("'zh-CN': {"), 'no Chinese UI strings');
  assert.match(html, /data-lang="zh-CN"/);
  assert.match(html, /data-lang="en"/);
});

test('build-time profile embedding produces a page that still parses', async () => {
  const { embedProfile } = await import('../dist/commands/build.js');
  const profile = {
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'Demo </script> <b>', repository: 'https://github.com/o/r' },
  };
  const built = embedProfile(html, profile, { language: 'zh-CN', region: 'china', autonomy: 'guided' });
  // A `</script>` inside the payload would end the script tag early and break the page.
  const start = built.indexOf('/* REPRO:PROFILE:START */') + '/* REPRO:PROFILE:START */'.length;
  const block = built.slice(start, built.indexOf('/* REPRO:PROFILE:END */'));
  assert.ok(!block.includes('</script>'), 'raw </script> leaked into the embedded payload');
  const { runInNewContext } = await import('node:vm');
  const embedded = runInNewContext(`${block}; EMBEDDED`);
  assert.equal(embedded.profile.project.name, 'Demo </script> <b>');
  assert.equal(embedded.defaults.region, 'china');
});
