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

test('every task tells the agent how to read one file over the web', () => {
  // Seen in the wild: an agent wrote "cannot access the source (repository not cloned)" and
  // fell back to local evidence, on a task that carried a public GitHub URL. Three things
  // had told it not to download the repository and only one abstract line had told it to
  // fetch files, so it took the exit. Both routes now carry the actual URL shape.
  for (const language of LANGUAGES) {
    for (const region of ['global', 'china']) {
      const body = renderProtocol({ language, region, autonomy: 'guided' });
      assert.ok(body.includes('raw.githubusercontent.com/<owner>/<repo>/'),
        `${language}/${region}: no concrete way to fetch a single file`);
      assert.ok(body.includes('raw.gitcode.com/') && body.includes('gitee.com/'),
        `${language}/${region}: mirrors are named but not reachable per file`);
    }
  }
});

test('the revision ladder has all three rungs and never dead-ends', () => {
  // `3.3.1.0` 404s where `v3.3.1.0` succeeds, and the build that was actually crashing in
  // the report behind this had no tag at all. An agent that can only read an exact match
  // stops at the first of those and reports the source as unreachable.
  // Both regions: the first cut of this put the lookup recipe in route-global only, so every
  // china task — and the whole zh-CN adapter, which is built as china — shipped without it.
  const RUNGS = {
    en: ['A version string is usually not a tag', '**Bracket.**', 'Default branch, labelled'],
    'zh-CN': ['版本号通常不是 tag', '**夹逼。**', '默认分支，但要打标'],
  };
  for (const language of LANGUAGES) {
    for (const region of ['global', 'china']) {
      const body = renderProtocol({ language, region, autonomy: 'guided' });
      for (const rung of RUNGS[language]) {
        assert.ok(body.includes(rung), `${language}/${region}: missing rung — ${rung}`);
      }
      assert.ok(body.includes('/git/trees/'), `${language}/${region}: no way to list files at a ref`);
      // Every rung must beat reading nothing, or an agent will still pick nothing.
      const beatsNothing = language === 'zh-CN' ? '每一级都好过什么都不读' : 'Every rung beats reading nothing';
      assert.ok(body.includes(beatsNothing), `${language}/${region}: the ladder still permits giving up`);
    }
  }
});

test('the source can be tied to this machine without knowing the revision', () => {
  // The strongest citation available, and the protocol had no word for it: a literal seen in
  // a local log that also appears in the source proves that code is in the running build.
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const crossCheck = language === 'zh-CN' ? '跟你取的是哪个版本无关' : 'whatever revision you fetched';
    const absent = language === 'zh-CN' ? '找不到' : 'is **absent** from the source';
    assert.ok(body.includes(crossCheck), `${language}: no way to confirm source against this machine`);
    assert.ok(body.includes(absent), `${language}: a missing literal is not treated as a finding`);
  }
});

test('a citation may not name anything the agent did not retrieve', () => {
  // Blind run 002: Gemini 3.7 Flash diagnosed the planted defect correctly, then cited every
  // source line as `main (verified locally and matched remote …)` — off a local copy, with
  // zero network calls in the whole session. Correct answer, invented provenance.
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const localRule = language === 'zh-CN' ? '本地拷贝 —— 未与任何已发布版本比对' : 'local copy — not compared to any published revision';
    const onlyRetrieved = language === 'zh-CN' ? '只写你真取回来过的东西' : 'Name only what you retrieved';
    assert.ok(body.includes(localRule), `${language}: no label for a local read`);
    assert.ok(body.includes(onlyRetrieved), `${language}: nothing forbids naming an unfetched ref`);
    // The report template has to repeat it: that is where the citation is actually written.
    const fabricated = language === 'zh-CN' ? '那是伪造出处' : 'is a fabricated citation';
    assert.ok(body.includes(fabricated), `${language}: the report template still invites it`);
  }
});

test('reading only the default branch is not enough to modify the machine', () => {
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const gate = language === 'zh-CN' ? '足够写一份报告，不足以改动任何东西' : 'enough to write a report; it is not enough to change anything';
    assert.ok(body.includes(gate), `${language}: Phase D lets an unconfirmed main read authorise a change`);
  }
});

test('an http status is never mistaken for an unreachable source', () => {
  for (const language of LANGUAGES) {
    for (const region of ['global', 'china']) {
      const body = renderProtocol({ language, region, autonomy: 'guided' });
      assert.ok(body.includes('404'), `${language}/${region}: a 404 is not addressed`);
      assert.ok(body.includes('403'), `${language}/${region}: an API rate limit is not addressed`);
    }
  }
});

test('an approval the policy allows is asked for, not recorded as a limitation', () => {
  // Same shape as the clone bug: the agent hit a capability it did not have and treated it
  // as a wall, when `allow_admin_privileges` was `ask` and the check it skipped was the one
  // it had itself named as the best remaining evidence.
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const rule = language === 'zh-CN' ? '不叫「条件限制」' : 'is not a limitation';
    assert.ok(body.includes(rule), `${language}: a requestable check can still be silently skipped`);
  }
});

test('a missing clone is explicitly not an excuse for skipping the source', () => {
  for (const language of LANGUAGES) {
    const body = renderProtocol({ language, region: 'global', autonomy: 'guided' });
    const excuse = language === 'zh-CN' ? '没有本地 clone 不构成跳过本阶段的理由' : 'Not having a local clone is not a reason to skip this phase';
    assert.ok(body.includes(excuse), `${language}: the clone excuse is not closed off`);
    // The report template used to hand the agent the sentence it needed to give up.
    assert.equal(body.includes('Source not reachable from this machine'), false);
    assert.equal(body.includes('本机无法访问源码，以下结论未经代码核实'), false);
    const evidence = language === 'zh-CN' ? '试过的路线' : 'Route tried';
    assert.ok(body.includes(evidence), `${language}: unreachable source can still be claimed without evidence`);
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
