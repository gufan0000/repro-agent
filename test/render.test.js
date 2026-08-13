import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTask, validateTask } from '../dist/core/task.js';
import { renderTask, renderProtocol } from '../dist/core/render.js';
import { PROTOCOL_FRAGMENTS } from '../dist/core/protocol-data.js';

const LANGUAGES = ['en', 'zh-CN'];
const REGIONS = ['global', 'china'];
const AUTONOMIES = ['readonly', 'guided', 'auto-safe'];

test('no placeholder survives rendering, in any combination', () => {
  for (const language of LANGUAGES)
    for (const region of REGIONS)
      for (const autonomy of AUTONOMIES) {
        const body = renderProtocol({ language, region, autonomy });
        const leftovers = body.match(/\{\{[A-Z_]+\}\}/g);
        assert.equal(leftovers, null, `${language}/${region}/${autonomy} left ${leftovers}`);
      }
});

test('the region choice selects the matching source-access chain', () => {
  const china = renderProtocol({ language: 'en', region: 'china', autonomy: 'guided' });
  const global = renderProtocol({ language: 'en', region: 'global', autonomy: 'guided' });
  assert.match(china, /region: china/);
  assert.match(china, /mainland China/i);
  assert.doesNotMatch(china, /region: global/);
  assert.match(global, /region: global/);
  assert.doesNotMatch(global, /region: china/);
});

test('the autonomy choice selects exactly one permission block', () => {
  for (const autonomy of AUTONOMIES) {
    const body = renderProtocol({ language: 'en', region: 'global', autonomy });
    assert.match(body, new RegExp(`Autonomy: \`${autonomy}\``));
    for (const other of AUTONOMIES.filter((a) => a !== autonomy)) {
      assert.doesNotMatch(body, new RegExp(`Autonomy: \`${other}\``), `${autonomy} leaked ${other}`);
    }
  }
});

test('readonly mode forbids modification in both the prose and the policy', () => {
  const body = renderProtocol({ language: 'en', region: 'global', autonomy: 'readonly' });
  assert.match(body, /must not modify a single file/);
  const task = buildTask({ autonomy: 'readonly', project: { name: 'D' }, problem: { summary: 'x' } });
  assert.equal(task.policy.allow_modify_target_app_files, 'deny');
  assert.equal(task.policy.allow_install_dependencies, 'deny');
  assert.equal(task.policy.allow_admin_privileges, 'deny');
  assert.equal(task.policy.allow_run_repository_scripts, 'deny');
});

test('the report path chosen by the maintainer reaches the escalation section', () => {
  const body = renderProtocol({ language: 'en', region: 'global', autonomy: 'guided', reportPath: 'ISSUE.md' });
  assert.match(body, /Write it to `ISSUE\.md`/);
  assert.doesNotMatch(body, /BUG_REPORT\.md/);
});

test('a rendered task carries a task JSON block that parses and validates', () => {
  for (const language of LANGUAGES) {
    const task = buildTask({
      language,
      project: { name: 'Demo', repository: 'https://github.com/o/r' },
      problem: { summary: 'It crashes on launch', reproduction_steps: ['open it'] },
    });
    const markdown = renderTask(task);
    const match = markdown.match(/```json\n([\s\S]*?)\n```/);
    assert.ok(match, 'task markdown must embed a json block');
    const parsed = JSON.parse(match[1]);
    assert.deepEqual(validateTask(parsed), []);
    assert.deepEqual(parsed, task);
  }
});

test('the header appears once, at the top, and is not duplicated by the body', () => {
  const task = buildTask({ project: { name: 'Demo' }, problem: { summary: 'x' } });
  const markdown = renderTask(task);
  assert.ok(markdown.startsWith('# Repro Agent Diagnostic Task'));
  assert.equal(markdown.split('# Repro Agent Diagnostic Task').length - 1, 1);
});

test('sections appear in protocol order', () => {
  const markdown = renderTask(buildTask({ project: { name: 'D' }, problem: { summary: 'x' } }));
  const order = ['## 0. Task data', '## 1. Authority', '## 2. Workflow', '## 3. Diagnostic budget', '## 4. The bug report', '## 5. Redaction'];
  let cursor = -1;
  for (const heading of order) {
    const index = markdown.indexOf(heading);
    assert.ok(index > cursor, `${heading} is out of order or missing`);
    cursor = index;
  }
});

test('the injection defence is present in every language', () => {
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const fragment = PROTOCOL_FRAGMENTS[language]['10-authority'];
    assert.ok(body.includes(fragment), 'the authority section must be included verbatim');
    assert.ok(fragment.length > 400, 'the authority section must not be a stub');
  }
});

test('both languages ship every fragment the renderer needs', () => {
  const names = Object.keys(PROTOCOL_FRAGMENTS.en).sort();
  for (const language of LANGUAGES) {
    assert.deepEqual(Object.keys(PROTOCOL_FRAGMENTS[language]).sort(), names, `${language} fragment set differs`);
    for (const [name, body] of Object.entries(PROTOCOL_FRAGMENTS[language])) {
      assert.ok(body.trim().length > 80, `${language}/${name} looks empty`);
    }
  }
});

test('an unknown language falls back to English rather than throwing', () => {
  const body = renderProtocol({ language: 'de', region: 'global', autonomy: 'guided' });
  assert.match(body, /# Repro Agent Diagnostic Task/);
});
