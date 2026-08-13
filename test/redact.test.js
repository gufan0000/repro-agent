import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactionSummary } from '../dist/core/redact.js';

test('secrets are removed', () => {
  const cases = [
    ['token=ghp_0123456789abcdefghijABCDEFGHIJ0123', /ghp_/],
    ['key: sk-proj-abcdefghijklmnop0123456789', /sk-proj/],
    ['aws AKIAIOSFODNN7EXAMPLE here', /AKIA/],
    ['Authorization: Bearer abc.def.ghijklmnop', /Bearer abc/],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk', /eyJhbGciOi/],
    ['postgres://admin:hunter2@db.internal:5432/app', /hunter2/],
    ['password = "correct horse battery"', /correct horse/],
    ['api_key: 0123456789abcdef0123456789abcdef', /0123456789abcdef0123456789abcdef/],
    ['contact bob.smith@example.com for help', /bob\.smith@/],
  ];
  for (const [input, leak] of cases) {
    const { text } = redact(input);
    assert.doesNotMatch(text, leak, `leaked from: ${input}`);
    assert.match(text, /<redacted:/, `nothing redacted in: ${input}`);
  }
});

test('a PEM private key block is removed whole', () => {
  const input = 'before\n-----BEGIN RSA PRIVATE KEY-----\nMIIEow…\nlines\n-----END RSA PRIVATE KEY-----\nafter';
  const { text } = redact(input);
  assert.equal(text, 'before\n<redacted:private-key>\nafter');
});

test('home directories are anonymised but the rest of the path survives', () => {
  assert.equal(
    redact('C:\\Users\\gufan\\AppData\\Roaming\\App\\config.json').text,
    'C:\\Users\\<USER>\\AppData\\Roaming\\App\\config.json',
  );
  assert.equal(redact('/home/gufan/.config/app/log').text, '/home/<USER>/.config/app/log');
  assert.equal(redact('/Users/gufan/Library/Logs/App').text, '/Users/<USER>/Library/Logs/App');
});

test('diagnostic signal is preserved', () => {
  const log = [
    '2026-08-14T09:12:03Z ERROR [importer] exit code 3221225477',
    '  at ImportService.parse (src/import/service.ts:214:11)',
    'connecting to 127.0.0.1:5432 and 192.168.1.20',
    'version 1.4.0-beta.2 build abc1234',
  ].join('\n');
  const { text, categories } = redact(log);
  assert.equal(text, log, 'nothing in a clean log should be touched');
  assert.deepEqual(categories, []);
});

test('private and loopback addresses stay, public ones go', () => {
  const { text } = redact('local 10.0.0.5, lan 192.168.0.1, loop 127.0.0.1, remote 203.0.113.42');
  assert.match(text, /10\.0\.0\.5/);
  assert.match(text, /192\.168\.0\.1/);
  assert.match(text, /127\.0\.0\.1/);
  assert.doesNotMatch(text, /203\.0\.113\.42/);
});

test('a version string is not mistaken for an IP address', () => {
  const input = 'app 1.4.0.2231 and schema 300.1.400.2';
  assert.equal(redact(input).text, input);
});

test('a redacted secret keeps its shape so the maintainer knows what was there', () => {
  const { text } = redact('api_key=0123456789abcdef0123456789abcdef');
  assert.match(text, /<redacted:32-char-hex>/);
});

test('extra literals let a user strip their own hostname or account name', () => {
  const { text, counts } = redact('machine WIN-GUFAN-01 crashed', { extraLiterals: ['WIN-GUFAN-01'] });
  assert.equal(text, 'machine <redacted:custom> crashed');
  assert.equal(counts.custom, 1);
});

test('a rule can be disabled deliberately', () => {
  const input = 'ping 203.0.113.42';
  assert.equal(redact(input, { disable: ['public-ipv4'] }).text, input);
});

test('redaction is idempotent', () => {
  const input = 'token=ghp_0123456789abcdefghijABCDEFGHIJ0123 mail a@b.com ip 203.0.113.9';
  const once = redact(input).text;
  assert.equal(redact(once).text, once);
});

test('the summary reports what was removed, in both languages', () => {
  const result = redact('mail a@b.com');
  assert.match(redactionSummary(result, 'en'), /email ×1/);
  assert.match(redactionSummary(result, 'zh-CN'), /email ×1/);
  const clean = redact('nothing here');
  assert.match(redactionSummary(clean, 'en'), /nothing matched/);
  assert.match(redactionSummary(clean, 'zh-CN'), /未发现/);
});
