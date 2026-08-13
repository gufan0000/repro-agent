import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'index.js');

function run(args, options = {}) {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'repro-agent-'));
  test.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('help is printed when invoked with no arguments', () => {
  const out = run([]);
  assert.match(out, /repro-agent init/);
  assert.match(out, /repro-agent build/);
});

test('an unknown command fails loudly', () => {
  assert.throws(() => run(['frobnicate']), /Command failed/);
});

test('init writes a profile that validates', () => {
  const dir = sandbox();
  run(['init', '--dir', dir, '--name', 'FanTool', '--repo', 'https://github.com/gufan0000/fantool']);
  const path = join(dir, '.repro', 'project.json');
  assert.ok(existsSync(path));
  const profile = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(profile.project.name, 'FanTool');
  assert.equal(profile.project.issue_tracker, 'https://github.com/gufan0000/fantool/issues');
  assert.match(run(['validate', path]), /✓/);
});

test('init refuses to clobber an existing profile without --force', () => {
  const dir = sandbox();
  run(['init', '--dir', dir, '--name', 'A']);
  assert.throws(() => run(['init', '--dir', dir, '--name', 'B']), /Command failed/);
  run(['init', '--dir', dir, '--name', 'B', '--force']);
  assert.equal(JSON.parse(readFileSync(join(dir, '.repro', 'project.json'), 'utf8')).project.name, 'B');
});

test('task requires a summary', () => {
  assert.throws(() => run(['task', '--name', 'X']), /Command failed/);
});

test('task renders a file that validates and round-trips', () => {
  const dir = sandbox();
  const out = join(dir, 'TASK.md');
  run(['task', '--name', 'FanTool', '--summary', 'Import does nothing', '--os', 'Windows',
    '--version', '1.4.0', '--step', 'open app', '--step', 'click import', '-o', out]);
  const markdown = readFileSync(out, 'utf8');
  assert.match(markdown, /# Repro Agent Diagnostic Task/);
  const task = JSON.parse(markdown.match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(task.project.version, '1.4.0');
  assert.deepEqual(task.problem.reproduction_steps, ['open app', 'click import']);
  assert.match(run(['validate', out]), /✓/);
});

test('--version after a subcommand is the user\'s software version, not the tool\'s', () => {
  const dir = sandbox();
  const out = join(dir, 'T.md');
  run(['task', '--name', 'X', '--summary', 'y', '--version', '2.0.1', '-o', out]);
  assert.match(readFileSync(out, 'utf8'), /"version": "2\.0\.1"/);
  assert.match(run(['--version']), /^\d+\.\d+/);
});

test('an invalid choice is rejected with the list of valid ones', () => {
  assert.throws(() => run(['task', '--name', 'X', '--summary', 'y', '--autonomy', 'yolo']), (error) => {
    assert.match(error.stderr, /--autonomy must be one of: readonly, guided, auto-safe/);
    return true;
  });
});

test('a maintainer profile feeds project knowledge into the task', () => {
  const dir = sandbox();
  const profile = join(dir, 'profile.json');
  writeFileSync(profile, JSON.stringify({
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'FanTool', repository: 'https://github.com/o/r' },
    defaults: { language: 'zh-CN', region: 'china', autonomy: 'readonly' },
    local_targets: {
      any: { config_paths: ['~/.fantool/config.json'] },
      windows: { log_paths: ['%APPDATA%\\FanTool\\logs'] },
      macos: { log_paths: ['~/Library/Logs/FanTool'] },
    },
    diagnostic_hints: { known_issues: [{ symptom: 'import silently fails', cause: 'stale lockfile' }] },
  }));
  const out = join(dir, 'TASK.md');
  run(['task', '--profile', profile, '--summary', 'broken', '--os', 'Windows', '-o', out]);
  const task = JSON.parse(readFileSync(out, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);

  assert.equal(task.language, 'zh-CN');
  assert.equal(task.options.region, 'china');
  assert.equal(task.options.autonomy, 'readonly');
  assert.deepEqual(task.local_targets.config_paths, ['~/.fantool/config.json']);
  assert.deepEqual(task.local_targets.log_paths, ['%APPDATA%\\FanTool\\logs']);
  assert.ok(!JSON.stringify(task.local_targets).includes('Library/Logs'), 'macOS paths must not leak into a Windows task');
  assert.equal(task.diagnostic_hints.known_issues[0].cause, 'stale lockfile');
});

test('a maintainer profile can tighten the policy but never loosen it', () => {
  const dir = sandbox();
  const profile = join(dir, 'profile.json');
  writeFileSync(profile, JSON.stringify({
    protocol: 'repro-agent/project',
    protocol_version: '1.0',
    project: { name: 'Locked' },
    policy_overrides: { allow_modify_target_app_files: 'deny', allow_install_dependencies: 'deny' },
  }));
  const out = join(dir, 'TASK.md');
  run(['task', '--profile', profile, '--summary', 'x', '--autonomy', 'auto-safe', '-o', out]);
  const task = JSON.parse(readFileSync(out, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.equal(task.policy.allow_modify_target_app_files, 'deny');
  assert.equal(task.policy.allow_install_dependencies, 'deny');
  assert.equal(task.policy.allow_delete_files, 'deny');
});

test('validate reports a malformed profile instead of accepting it', () => {
  const dir = sandbox();
  const bad = join(dir, 'bad.json');
  writeFileSync(bad, JSON.stringify({ protocol: 'repro-agent/project', protocol_version: '1.0', project: {} }));
  assert.throws(() => run(['validate', bad]), (error) => {
    assert.match(error.stderr, /project\.name: is required/);
    return true;
  });
});

test('build produces an offline page plus both adapters', () => {
  const dir = sandbox();
  run(['init', '--dir', dir, '--name', 'Fan Tool', '--repo', 'https://github.com/o/r']);
  const outDir = join(dir, 'kit');
  run(['build', '--profile', join(dir, '.repro', 'project.json'), '--out', outDir]);

  const page = join(outDir, 'fan-tool-support.html');
  assert.ok(existsSync(page));
  const html = readFileSync(page, 'utf8');
  assert.match(html, /"name": ?"Fan Tool"|"name":"Fan Tool"/);
  assert.ok(!html.includes('fetch('), 'the built page must stay offline');

  const agents = readFileSync(join(outDir, 'REPRO_AGENTS.md'), 'utf8');
  assert.match(agents, /Repro Agent diagnostic mode/);
  assert.match(agents, /Fan Tool/);
  assert.equal(agents.match(/\{\{[A-Z_]+\}\}/g), null);

  const skill = readFileSync(join(outDir, 'repro-agent', 'SKILL.md'), 'utf8');
  assert.ok(skill.startsWith('---\nname: repro-agent\n'), 'skill needs frontmatter');
  assert.match(skill, /description: .+/);
  assert.equal(skill.match(/\{\{[A-Z_]+\}\}/g), null);
});

test('the WorkBuddy skill package contains no executable code', () => {
  const dir = sandbox();
  run(['adapters', 'workbuddy', '--out', dir]);
  const skill = readFileSync(join(dir, 'repro-agent', 'SKILL.md'), 'utf8');
  // A skill that can run code is a supply-chain risk the user cannot audit before installing.
  for (const pattern of [/```(?:bash|sh|powershell|python|js|javascript)\n/, /<script/i]) {
    assert.doesNotMatch(skill, pattern, 'the skill must be pure markdown instructions');
  }
});

test('redact cleans a file end to end', () => {
  const dir = sandbox();
  const input = join(dir, 'report.md');
  const output = join(dir, 'clean.md');
  writeFileSync(input, 'token=ghp_0123456789abcdefghijABCDEFGHIJ0123\npath C:\\Users\\gufan\\app.log\nerror 0x80070005\n');
  run(['redact', input, '-o', output]);
  const cleaned = readFileSync(output, 'utf8');
  assert.doesNotMatch(cleaned, /ghp_/);
  assert.match(cleaned, /C:\\Users\\<USER>\\app\.log/);
  assert.match(cleaned, /0x80070005/, 'error codes must survive');
});

test('-o creates the directory it was told to write into', () => {
  const dir = sandbox();
  // Users type paths like reports/2026-08/task.md. Failing with ENOENT on a path
  // the user just supplied is not a useful answer.
  const out = join(dir, 'reports', '2026-08', 'REPRO_TASK.md');
  run(['task', '--name', 'X', '--summary', 'y', '-o', out]);
  assert.ok(existsSync(out));

  const redacted = join(dir, 'nested', 'again', 'clean.md');
  const input = join(dir, 'in.md');
  writeFileSync(input, 'token=ghp_0123456789abcdefghijABCDEFGHIJ0123\n');
  run(['redact', input, '-o', redacted]);
  assert.ok(existsSync(redacted));
});
