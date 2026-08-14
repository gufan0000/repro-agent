/**
 * The drop-in packages.
 *
 * These are the only artifact a developer is told they can ship without changing anything,
 * so the things worth asserting are the ones that would silently make that untrue: a page
 * that quietly reverts to the global source route, a maintainer field left on screen for an
 * ordinary user, or an archive whose Chinese filenames arrive as mojibake.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { packages, zip } from '../tools/build-packages.mjs';

const built = packages();
const byId = Object.fromEntries(built.map((p) => [p.variant.id, p]));

/** Read an archive back out of its bytes, using the central directory as a reader would. */
function unzip(buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.notEqual(eocd, -1, 'no end-of-central-directory record');
  const count = buffer.readUInt16LE(eocd + 10);
  let at = buffer.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(at), 0x02014b50, 'bad central directory signature');
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const compressed = buffer.readUInt32LE(at + 20);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const local = buffer.readUInt32LE(at + 42);
    const name = buffer.subarray(at + 46, at + 46 + nameLength).toString('utf8');

    const bodyAt = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const body = buffer.subarray(bodyAt, bodyAt + compressed);
    out.push({ name, utf8: !!(flags & 0x0800), text: (method === 8 ? inflateRawSync(body) : body).toString('utf8') });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

test('both packages exist and hold a page, a user readme and a developer readme', () => {
  assert.deepEqual(built.map((p) => p.variant.id), ['zh-CN', 'en']);
  for (const { name, entries } of built) {
    assert.match(name, /^repro-agent-user-(zh-CN|en)-\d+\.\d+\.\d+\.zip$/);
    assert.equal(entries.length, 3, `${name} should hold exactly three files`);
    assert.equal(entries.filter(([f]) => f.endsWith('.html')).length, 1);
  }
});

test('the archive round-trips, with its filenames marked as UTF-8', () => {
  for (const { entries } of built) {
    const read = unzip(zip(entries));
    assert.deepEqual(read.map((e) => e.name), entries.map(([name]) => name));
    for (const entry of read) assert.equal(entry.utf8, true, `${entry.name} is not flagged UTF-8`);
    // Without the flag, 开始诊断.html is what Windows shows as 開å§‹è¯Šæ–­.html.
    assert.deepEqual(read.map((e) => e.text), entries.map(([, text]) => text));
  }
});

test('two builds of the same commit produce identical bytes', () => {
  for (const { entries } of built) {
    assert.deepEqual(zip(entries), zip(entries), 'the archive is not reproducible');
  }
});

test('the china package routes source access through the mirrors', () => {
  const [, page] = [null, byId['zh-CN'].entries[0][1]];
  const embedded = JSON.parse(page.match(/const EMBEDDED = (\{.*?\});/)[1]);
  assert.equal(embedded.defaults.region, 'china');
  assert.equal(embedded.defaults.language, 'zh-CN');
  assert.equal(embedded.profile, null, 'the drop-in package must not carry anybody else‘s profile');
  // Without this the page keeps the mirror, budget and source-route fields on screen, which
  // are a maintainer's vocabulary and not an answer any user of a shipped app can give.
  assert.equal(embedded.audience, 'user');

  const global = JSON.parse(byId.en.entries[0][1].match(/const EMBEDDED = (\{.*?\});/)[1]);
  assert.equal(global.defaults.region, 'global');
  assert.equal(global.defaults.language, 'en');
});

test('each package speaks one language to its user', () => {
  const zh = byId['zh-CN'].entries.find(([n]) => n.endsWith('使用说明.txt'))[1];
  const en = byId.en.entries.find(([n]) => n === 'README.txt')[1];
  assert.match(zh, /双击打开/);
  assert.equal(/[a-z]{4,}/.test(zh.replace(/https?:\/\/\S+|\.html|\.md/g, '')), false,
    'the Chinese readme still has English prose in it');
  assert.equal(/[一-鿿]/.test(en), false, 'the English readme still has Chinese in it');
});

test('the developer readme carries the block it tells developers to edit', () => {
  for (const { entries, variant } of built) {
    const dev = entries.find(([n]) => /开发者须知|FOR-DEVELOPERS/.test(n))[1];
    assert.ok(dev.includes('repro-project'), 'no mention of the block to fill in');
    assert.ok(dev.includes(variant.html), 'the developer readme names the wrong file');
    assert.ok(dev.includes('npx repro-agent init'), 'no route to the fully customised kit');
  }
});

test('the shipped page still cannot reach the network', () => {
  for (const { entries } of built) {
    const page = entries[0][1];
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'WebSocket', 'navigator.sendBeacon']) {
      assert.equal(page.includes(forbidden), false, `the page contains ${forbidden}`);
    }
    assert.match(page, /connect-src 'none'/);
  }
});
