/**
 * Real-browser tests for the offline page.
 *
 * The node suite can assert that the page *contains* the right code. It cannot catch a
 * maintainer default that never reaches the builder, a "clear" button that wipes project
 * facts, or a fixed bar covering the generate button on a phone. Every one of those
 * shipped in 0.1.x behind a green test run.
 *
 * Not part of `npm test`: this needs a browser binary. CI runs it as its own job.
 *   npx playwright install --with-deps chromium
 *   npm run test:browser
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'index.js');

const PROFILE = {
  protocol: 'repro-agent/project',
  protocol_version: '1.0',
  project: {
    name: 'FanTool',
    repository: 'https://github.com/example/fantool',
    mirrors: [
      { url: 'https://gitcode.com/example/fantool', kind: 'gitcode' },
      { url: 'https://gitee.com/example/fantool', kind: 'gitee' },
    ],
    issue_tracker: 'https://github.com/example/fantool/issues',
  },
  defaults: { language: 'en', region: 'china', autonomy: 'guided', budget_profile: 'frugal', agent_host: 'workbuddy' },
  environment: { supported_os: ['Windows'], runtimes: ['.NET 8 Desktop Runtime'] },
  local_targets: {
    any: { data_paths: ['profiles/'] },
    windows: { log_paths: ['%APPDATA%\\FanTool\\logs'], config_paths: ['%APPDATA%\\FanTool\\config.json'] },
  },
  policy_overrides: { allow_run_repository_scripts: 'deny' },
};

const dir = mkdtempSync(join(tmpdir(), 'repro-e2e-'));
const profilePath = join(dir, 'project.json');
writeFileSync(profilePath, JSON.stringify(PROFILE));
execFileSync(process.execPath, [cli, 'build', '--profile', profilePath, '--out', join(dir, 'kit')], { stdio: 'ignore' });
const pageUrl = pathToFileURL(join(dir, 'kit', 'fantool-support.html')).href;
const genericUrl = pathToFileURL(join(root, 'web', 'index.html')).href;

const browser = await chromium.launch();
test.after(async () => {
  await browser.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Open a page, recording every network attempt and console error it makes. */
async function open(url, viewport = { width: 1100, height: 900 }) {
  const context = await browser.newContext({ viewport, locale: 'en-US' });
  const requests = [];
  const consoleErrors = [];
  context.on('request', (r) => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(url);
  return { page, context, requests, consoleErrors };
}

/** Fill in the wizard the way a user would and return the task it produced. */
async function generate(page, { summary, category = 2, frequency = 0 } = {}) {
  await page.fill('#summary', summary);
  await page.locator('#categoryTiles button').nth(category).click();
  await page.locator('#frequencyPills button').nth(frequency).click();
  await page.click('#btnPreview');
  const raw = await page.locator('#rawTask').textContent();
  return JSON.parse(raw.match(/```json\n([\s\S]*?)\n```/)[1]);
}

test('the page reaches the network zero times and logs no errors', async () => {
  const { page, context, requests, consoleErrors } = await open(pageUrl);
  await generate(page, { summary: 'clicking import does nothing' });
  assert.deepEqual(requests, [], `the page made network requests: ${requests.join(', ')}`);
  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join(' | ')}`);
  await context.close();
});

test('a user sees exactly one required text box and no project fields', async () => {
  const { page, context } = await open(pageUrl);

  const visible = await page.evaluate(() =>
    [...document.querySelectorAll('input,textarea,select')]
      .filter((el) => el.checkVisibility())
      .map((el) => el.id));
  assert.deepEqual(visible, ['summary'], `unexpected inputs on first view: ${visible.join(', ')}`);

  // The repository, mirrors and issue tracker are the maintainer's facts. A user who can
  // edit them can produce a task that looks valid and points at the wrong project.
  const html = await page.content();
  for (const id of ['#repo', '#projectName', '#mirror', '#issues']) {
    assert.equal(await page.locator(id).count() && await page.locator(id).isVisible(), false,
      `${id} must not be editable when a maintainer profile is embedded`);
  }
  assert.ok(html.includes('FanTool'), 'the project should still be named on the page');
  await context.close();
});

test('the page and the CLI produce the same task for the same answers', async () => {
  const { page, context } = await open(pageUrl);
  const fromPage = await generate(page, { summary: 'clicking import does nothing' });

  const out = join(dir, 'cli.md');
  execFileSync(process.execPath, [cli, 'task', '--profile', profilePath,
    '--summary', '[A feature does nothing] clicking import does nothing',
    '--os', 'Windows', '-o', out], { stdio: 'ignore' });
  const fromCli = JSON.parse(readFileSync(out, 'utf8').match(/```json\n([\s\S]*?)\n```/)[1]);

  // task_id and created_at are expected to differ; frequency is a wizard-only answer.
  for (const task of [fromPage, fromCli]) {
    delete task.task_id;
    delete task.created_at;
    delete task.problem.frequency;
  }
  assert.deepEqual(fromPage, fromCli);
  await context.close();
});

test('maintainer settings survive the trip through the page', async () => {
  const { page, context } = await open(pageUrl);
  const task = await generate(page, { summary: 'clicking import does nothing' });

  assert.equal(task.policy.allow_run_repository_scripts, 'deny', 'maintainer denial was dropped');
  assert.equal(task.options.budget_profile, 'frugal', 'maintainer budget was dropped');
  assert.equal(task.options.agent_host, 'workbuddy', 'maintainer agent host was dropped');
  assert.equal(task.options.region, 'china', 'maintainer region was dropped');
  assert.equal(task.budget.max_active_hypotheses, 2);
  assert.equal(task.project.mirrors.length, 2, 'a mirror was dropped');
  assert.equal(task.project.mirrors[0].kind, 'gitcode', 'mirror kind was dropped');
  assert.deepEqual(task.environment.runtimes, ['.NET 8 Desktop Runtime'], 'runtimes were dropped');

  // supported_os is a single platform, so the question is answered for the user.
  assert.equal(task.environment.os, 'Windows');
  assert.deepEqual(task.local_targets.log_paths, ['%APPDATA%\\FanTool\\logs']);
  assert.equal(await page.locator('#osWrap').isVisible(), false, 'a single-platform project must not ask');
  await context.close();
});

test('nothing can be downloaded until the task passes the real schema', async () => {
  const { page, context } = await open(pageUrl);
  await page.click('#btnGenerate');
  assert.equal(await page.locator('#result').isVisible(), false, 'an empty form produced a result');
  assert.match(await page.locator('#errors').textContent(), /\S/, 'no error was shown');
  await context.close();
});

test('the download is a real file with the task in it', async () => {
  const { page, context } = await open(pageUrl);
  await page.fill('#summary', 'clicking import does nothing');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btnGenerate')]);
  assert.match(download.suggestedFilename(), /REPRO_TASK\.md$/);
  const saved = join(dir, 'downloaded.md');
  await download.saveAs(saved);
  assert.match(readFileSync(saved, 'utf8'), /# Repro Agent Diagnostic Task/);

  // The CLI must accept what the page produced. This is the loop closing.
  execFileSync(process.execPath, [cli, 'validate', saved], { stdio: 'ignore' });
  await context.close();
});

test('a phone can reach the generate button', async () => {
  const { page, context } = await open(pageUrl, { width: 390, height: 780 });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, 'the page scrolls sideways on a 390px screen');

  const covered = await page.evaluate(() => {
    const btn = document.getElementById('btnGenerate');
    btn.scrollIntoView({ block: 'center' });
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === null || !btn.contains(hit) ? (hit && hit.tagName) || 'nothing' : false;
  });
  assert.equal(covered, false, `the generate button is covered by ${covered}`);
  await context.close();
});

test('without a maintainer profile the page asks for the project instead', async () => {
  const { page, context } = await open(genericUrl);
  assert.equal(await page.locator('#repo').isVisible(), true, 'helper mode must ask for a repository');

  await page.click('#btnGenerate');
  assert.match(await page.locator('#errors').textContent(), /\S/, 'a summary alone should not be enough here');

  await page.fill('#repo', 'https://github.com/gufan0000/repro-agent');
  const task = await generate(page, { summary: 'import reports success but imports nothing' });
  assert.equal(task.project.name, 'repro-agent', 'the name should be inferred from the URL');
  assert.equal(task.project.repository, 'https://github.com/gufan0000/repro-agent');
  await context.close();
});
