import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../dist/core/schema.js';
import { TASK_SCHEMA, PROJECT_SCHEMA } from '../dist/core/schema-data.js';
import { buildTask, validateTask, validateProjectProfile } from '../dist/core/task.js';

const minimalTask = () => buildTask({ project: { name: 'Demo' }, problem: { summary: 'It crashes' } });

test('a freshly built task validates against the published schema', () => {
  assert.deepEqual(validateTask(minimalTask()), []);
});

test('every combination of the four option axes produces a valid task', () => {
  for (const language of ['en', 'zh-CN'])
    for (const region of ['global', 'china'])
      for (const autonomy of ['readonly', 'guided', 'auto-safe'])
        for (const budgetProfile of ['frugal', 'standard', 'deep']) {
          const task = buildTask({
            language,
            region,
            autonomy,
            budgetProfile,
            project: { name: 'Demo' },
            problem: { summary: 'x' },
          });
          assert.deepEqual(
            validateTask(task),
            [],
            `${language}/${region}/${autonomy}/${budgetProfile} should be valid`,
          );
        }
});

test('a missing required field is reported with its path', () => {
  const task = minimalTask();
  delete task.problem.summary;
  const errors = validateTask(task);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, 'problem.summary');
});

test('an unknown field is rejected rather than silently ignored', () => {
  const task = minimalTask();
  task.project.sudo = true;
  const errors = validateTask(task);
  assert.ok(errors.some((e) => e.path === 'project.sudo'));
});

test('an out-of-range enum value is rejected', () => {
  const task = minimalTask();
  task.options.autonomy = 'yolo';
  assert.ok(validateTask(task).some((e) => e.path === 'options.autonomy'));
});

test('a malformed commit hash is rejected', () => {
  const task = minimalTask();
  task.project.commit = 'not-a-hash';
  assert.ok(validateTask(task).some((e) => e.path === 'project.commit'));
  task.project.commit = 'abc1234';
  assert.deepEqual(validateTask(task), []);
});

test('a non-https mirror is rejected', () => {
  const task = minimalTask();
  task.project.mirrors = [{ url: 'http://mirror.example.com/repo' }];
  assert.ok(validateTask(task).some((e) => e.path.startsWith('project.mirrors')));
});

test('the four hard denials are schema constants, not defaults', () => {
  for (const key of [
    'allow_delete_files',
    'allow_network_egress_of_local_data',
    'allow_disable_security_software',
    'allow_read_or_upload_secrets',
    'allow_modify_unrelated_software',
  ]) {
    const task = minimalTask();
    task.policy[key] = 'ask';
    assert.ok(validateTask(task).some((e) => e.path === `policy.${key}`), `${key} must be pinned to deny`);
  }
});

test('read_only_first cannot be turned off', () => {
  const task = minimalTask();
  task.policy.read_only_first = false;
  assert.ok(validateTask(task).some((e) => e.path === 'policy.read_only_first'));
});

test('project profiles validate and reject junk', () => {
  const profile = {
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'Demo' },
  };
  assert.deepEqual(validateProjectProfile(profile), []);
  assert.ok(validateProjectProfile({ ...profile, protocol: 'something/else' }).length > 0);
  assert.ok(validateProjectProfile({ ...profile, project: {} }).length > 0);
});

test('the validator handles $ref, nested objects and array items', () => {
  const profile = {
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'Demo' },
    local_targets: { windows: { ports: [8080], log_paths: ['%APPDATA%\\Demo'] } },
  };
  assert.deepEqual(validateProjectProfile(profile), []);
  profile.local_targets.windows.ports = [99999];
  assert.ok(validateProjectProfile(profile).some((e) => e.path.includes('ports')));
  profile.local_targets.windows.ports = [8080];
  profile.local_targets.windows.unknown_key = [];
  assert.ok(validateProjectProfile(profile).some((e) => e.path.includes('unknown_key')));
});

test('both schemas are self-consistent draft-07 documents', () => {
  for (const schema of [TASK_SCHEMA, PROJECT_SCHEMA]) {
    assert.equal(typeof schema.$id, 'string');
    assert.equal(schema.type, 'object');
    assert.ok(Array.isArray(schema.required) && schema.required.length > 0);
    // Every `required` entry must actually be declared, or the schema lies about itself.
    for (const key of schema.required) {
      assert.ok(schema.properties[key], `${schema.title}: required "${key}" has no definition`);
    }
  }
});

test('the validator does not accept a wrong type just because a value is truthy', () => {
  assert.ok(validate({ type: 'integer' }, '5').length > 0);
  assert.ok(validate({ type: 'array', items: { type: 'string' } }, ['a', 1]).length > 0);
  assert.deepEqual(validate({ type: 'number' }, 5), []);
});
