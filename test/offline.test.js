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
  // It now arrives inside the inlined core rather than as a separate block, so assert on
  // the text itself: several fragments in both languages, and no loader that could fetch it.
  for (const fragment of ['00-header', '10-authority', '20-workflow', 'route-china', 'mode-auto-safe']) {
    assert.ok(html.includes(fragment), `the page is missing protocol fragment ${fragment}`);
  }
  assert.ok(html.includes('# Repro Agent Diagnostic Task'), 'English protocol header missing');
  assert.ok(html.includes('# Repro Agent 诊断任务'), 'Chinese protocol header missing');
});

test('the profile markers are present so `repro-agent build` can prefill the page', () => {
  const start = html.indexOf('/* REPRO:PROFILE:START */');
  const end = html.indexOf('/* REPRO:PROFILE:END */');
  assert.ok(start !== -1 && end > start, 'profile markers missing');
  assert.match(html.slice(start, end), /const EMBEDDED =/);
});

test('the page runs the real task builder, not a copy of it', async () => {
  // The page used to carry a hand-written buildTask that had drifted from the CLI: it
  // ignored policy_overrides and fell back to the standard budget. Nothing may reimplement
  // the core, so the page must expose the genuine article and it must behave identically.
  const { runInNewContext } = await import('node:vm');
  const start = html.indexOf('/* REPRO:CORE:START */') + '/* REPRO:CORE:START */'.length;
  const bundled = html.slice(start, html.indexOf('/* REPRO:CORE:END */'));
  const sandbox = {};
  sandbox.globalThis = sandbox;
  runInNewContext(bundled, sandbox);

  const core = sandbox.ReproCore;
  assert.ok(core, 'the page does not expose ReproCore');
  for (const fn of ['buildTask', 'validateTask', 'renderTask', 'formatErrors']) {
    assert.equal(typeof core[fn], 'function', `ReproCore.${fn} is missing`);
  }

  const { buildTask } = await import('../dist/core/task.js');
  const input = {
    profile: {
      protocol: 'repro-agent/project',
      protocol_version: '1.0',
      project: { name: 'FanTool', repository: 'https://github.com/o/r' },
      defaults: { budget_profile: 'frugal', agent_host: 'workbuddy', region: 'china' },
      policy_overrides: { allow_run_repository_scripts: 'deny' },
    },
    problem: { summary: 'nothing happens' },
    taskId: 'fixed-id',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(JSON.stringify(core.buildTask(input)), JSON.stringify(buildTask(input)));
});

test('the page honours a maintainer policy override, like the CLI does', async () => {
  const { runInNewContext } = await import('node:vm');
  const start = html.indexOf('/* REPRO:CORE:START */') + '/* REPRO:CORE:START */'.length;
  const sandbox = {};
  sandbox.globalThis = sandbox;
  runInNewContext(html.slice(start, html.indexOf('/* REPRO:CORE:END */')), sandbox);

  const task = sandbox.ReproCore.buildTask({
    profile: {
      protocol: 'repro-agent/project',
      protocol_version: '1.0',
      project: { name: 'FanTool' },
      defaults: { budget_profile: 'frugal' },
      policy_overrides: { allow_run_repository_scripts: 'deny' },
    },
    problem: { summary: 'nothing happens' },
  });
  assert.equal(task.policy.allow_run_repository_scripts, 'deny', 'a maintainer denial was lost');
  assert.equal(task.options.budget_profile, 'frugal', 'the maintainer budget was lost');
  assert.equal(task.budget.max_active_hypotheses, 2, 'frugal budget values were not applied');
  assert.equal(sandbox.ReproCore.validateTask(task).length, 0, 'the page can build an invalid task');
});

test('the page is bilingual', () => {
  assert.ok(html.includes("'zh-CN': {"), 'no Chinese UI strings');
  assert.ok(html.includes('中文'), 'no Chinese language switch');
  assert.ok(html.includes('English'), 'no English language switch');
});

test('build-time profile embedding produces a page that still parses', async () => {
  const { embedProfile } = await import('../dist/commands/build.js');
  const profile = {
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'Demo </script> <b>', repository: 'https://github.com/o/r' },
  };
  const built = embedProfile(html, profile, {
    language: 'zh-CN', region: 'china', autonomy: 'guided', budget_profile: 'frugal', agent_host: 'workbuddy',
  });
  // A `</script>` inside the payload would end the script tag early and break the page.
  const start = built.indexOf('/* REPRO:PROFILE:START */') + '/* REPRO:PROFILE:START */'.length;
  const block = built.slice(start, built.indexOf('/* REPRO:PROFILE:END */'));
  assert.ok(!block.includes('</script>'), 'raw </script> leaked into the embedded payload');
  const { runInNewContext } = await import('node:vm');
  const embedded = runInNewContext(`${block}; EMBEDDED`);
  assert.equal(embedded.profile.project.name, 'Demo </script> <b>');
  assert.equal(embedded.defaults.region, 'china');
  // These two were the ones the page silently ignored before.
  assert.equal(embedded.defaults.budget_profile, 'frugal');
  assert.equal(embedded.defaults.agent_host, 'workbuddy');
});
