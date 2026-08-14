// Build the drop-in packages a developer ships with their software without adapting anything.
//
// There are two, because "which mirror do we try first" and "what language is the readme in"
// are not the same question for a user in Shenzhen and a user in Berlin, and asking either of
// them to pick is asking them to know something they do not.
//
//   node tools/build-packages.mjs [outDir]
//
// The archive is written here rather than shelled out to `zip`, for three reasons: the tool is
// not installed everywhere, its handling of non-ASCII entry names depends on a flag most
// callers forget, and driving it from CI would make the checksums depend on the build clock.
// Everything below is stored with a fixed timestamp, so the same commit always produces the
// same bytes.

import { deflateRawSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embedProfile } from '../dist/commands/build.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ? process.argv[2] : join(root, 'out');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const page = readFileSync(join(root, 'web', 'index.html'), 'utf8');

const VARIANTS = [
  {
    id: 'zh-CN',
    // `china` orders the source routes so GitCode and Gitee are tried before GitHub. It is
    // the single setting that decides whether the assistant can read any source at all on a
    // network where github.com times out.
    defaults: { language: 'zh-CN', region: 'china', autonomy: 'guided', budget_profile: 'standard', agent_host: 'generic' },
    html: '开始诊断.html',
    files: { '使用说明.txt': userReadmeZh, '开发者须知.txt': devReadmeZh },
  },
  {
    id: 'en',
    defaults: { language: 'en', region: 'global', autonomy: 'guided', budget_profile: 'standard', agent_host: 'generic' },
    html: 'Start diagnosis.html',
    files: { 'README.txt': userReadmeEn, 'FOR-DEVELOPERS.txt': devReadmeEn },
  },
];

/** Every package, as `[filename, contents]` pairs — the shape the tests assert on. */
export function packages() {
  return VARIANTS.map((variant) => {
    const entries = [[variant.html, embedProfile(page, undefined, variant.defaults)]];
    for (const [name, body] of Object.entries(variant.files)) entries.push([name, body(variant)]);
    return { name: `repro-agent-user-${variant.id}-${version}.zip`, variant, entries };
  });
}

function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const { name, entries } of packages()) {
    const archive = zip(entries);
    writeFileSync(join(outDir, name), archive);
    console.log(`${name}  ${archive.length.toLocaleString()} bytes  (${entries.map((e) => e[0]).join(', ')})`);
  }
}

// ---------------------------------------------------------------------------- readme text

function userReadmeZh() {
  return [
    '出问题了？三步就好',
    '==================',
    '',
    '1. 双击打开「开始诊断.html」',
    '   它就在这个文件夹里，用浏览器打开，不需要安装任何东西。',
    '',
    '2. 用一句话说清楚哪里不对',
    '   不知道的地方留空，或者选「不清楚」。',
    '   不需要你去找日志、版本号或任何技术信息。',
    '',
    '3. 把它生成的文件拖进你的 AI 助手，然后发送：开始',
    '',
    '助手会在你这台电脑上检查，找出原因。能安全修好的，它会先解释清楚、',
    '先备份、再问过你才动手。修不好的话，它会写一份带证据的报告，',
    '你把报告贴到软件的反馈渠道就行。',
    '',
    '几件你可以放心的事',
    '------------------',
    '· 这个页面从不联网，你填写的任何内容都不会离开这台电脑。',
    '· 删除文件、关闭安全软件、读取密码和密钥，都是被禁止的。',
    '· 报告会自动去掉密钥、邮箱和带你用户名的路径。',
    '· 生成的是纯文本文件，发出去之前你可以自己先看一眼。',
    '',
    '这套流程是开源的：https://github.com/gufan0000/repro-agent',
    '',
  ].join('\r\n');
}

function userReadmeEn() {
  return [
    'Something broken? Three steps.',
    '==============================',
    '',
    '1. Double-click "Start diagnosis.html"',
    '   It is in this folder. It opens in your browser. Nothing to install.',
    '',
    '2. Say what went wrong, in one sentence.',
    '   Leave anything you do not know blank, or answer "Not sure".',
    '   You are not expected to find logs, versions or anything technical.',
    '',
    '3. Drag the file it produces into your AI assistant and send: start',
    '',
    'The assistant looks around your machine and works out the cause. If it can fix it',
    'safely it explains the change, backs things up, and asks you first. If it cannot,',
    'it writes a report with the evidence in it — paste that wherever you were going to',
    'report the problem.',
    '',
    'What this cannot do to your computer',
    '------------------------------------',
    '* This page never connects to the internet. Nothing you type leaves this machine.',
    '* Deleting files, disabling security software and reading secrets are all forbidden.',
    '* The report has keys, tokens, email addresses and your home path stripped out.',
    '* It is a plain text file. Read it before you share it if you want to.',
    '',
    'The protocol behind this is open source: https://github.com/gufan0000/repro-agent',
    '',
  ].join('\r\n');
}

function devReadmeZh(variant) {
  return [
    '给开发者：这个包怎么用',
    '======================',
    '',
    `版本 ${version} · 中文 / 中国大陆网络环境`,
    '',
    '你可以什么都不改，直接把这个文件夹随你的软件一起分发——放进安装包、',
    '压缩包，或者挂在下载页上都行。不需要写配置，不需要跑任何命令。',
    '',
    '想让它更好用？（推荐，两分钟）',
    '------------------------------',
    `用文本编辑器打开「${variant.html}」，最顶上有一段 repro-project 配置块，`,
    '把它填成你自己的：',
    '',
    '  {',
    '    "name": "你的软件名",',
    '    "repository": "https://github.com/你/你的仓库",',
    '    "mirror": "https://gitcode.com/你/你的仓库",',
    '    "issue_tracker": "https://github.com/你/你的仓库/issues"',
    '  }',
    '',
    '填了以后，页面就不再问用户「哪个软件出问题了」，助手也知道该去哪里读',
    '用户装的那个版本的源码——这一条对能不能定位到问题影响最大。',
    '地址必须以 https:// 开头；写错了页面会当场提示，不会静默失效。',
    '',
    '这个配置块只能设置上面四项。它无法放宽助手在用户机器上的权限，',
    '也无法关掉任何一条安全限制。',
    '',
    '可以直接抄进你 README 或反馈指引的一段话',
    '----------------------------------------',
    '',
    '  ## 遇到问题？',
    '',
    `  提 issue 之前，先打开 \`${variant.html}\`，按提示描述一下问题，`,
    '  把它生成的文件交给你的 AI 助手。多数问题它当场就能解决；',
    '  解决不了的话，它会生成一份带复现证据的报告，请把那份报告贴进 issue。',
    '',
    '想要更深的定制',
    '--------------',
    '日志和配置文件在哪、有哪些已知问题、哪些目录绝对不能碰——这些需要一个',
    '项目配置文件：',
    '',
    '  npx repro-agent init',
    '  npx repro-agent build',
    '',
    '生成的页面会把这些信息全部嵌进去，用户看到的表单会更短、诊断也更准。',
    '文档：https://github.com/gufan0000/repro-agent',
    '',
    '这个文件是写给你看的。随包发出去或者删掉，都可以。',
    '',
  ].join('\r\n');
}

function devReadmeEn(variant) {
  return [
    'For the developer shipping this',
    '===============================',
    '',
    `Version ${version} · English / global network routing`,
    '',
    'Ship this folder exactly as it is, alongside your software — in the installer, in',
    'the archive, or as a download on your site. No configuration, no commands to run.',
    '',
    'Two minutes to make it better (recommended)',
    '-------------------------------------------',
    `Open "${variant.html}" in a text editor. The repro-project block at the very top is`,
    'the only thing to change:',
    '',
    '  {',
    '    "name": "Your software",',
    '    "repository": "https://github.com/you/your-repo",',
    '    "mirror": "",',
    '    "issue_tracker": "https://github.com/you/your-repo/issues"',
    '  }',
    '',
    'With those filled in the page stops asking your users which software broke, and the',
    'assistant knows where to read your source at the version they actually installed —',
    'the single thing that most affects whether it finds the cause.',
    'Every address must start with https://. A malformed one is reported on the page',
    'rather than silently ignored.',
    '',
    'That block can set those four values and nothing else. It cannot widen what the',
    "assistant may do on the user's machine, and it cannot relax any safety rule.",
    '',
    'Text you can paste into your README or issue template',
    '-----------------------------------------------------',
    '',
    '  ## Something not working?',
    '',
    `  Before opening an issue, open \`${variant.html}\`, describe the problem, and hand`,
    '  the file it produces to your AI assistant. Most problems are solved on the spot.',
    '  If yours is not, it writes a report with reproduction evidence — paste that here.',
    '',
    'Going further',
    '-------------',
    'Where your logs and config live, what already breaks, what must never be touched —',
    'that needs a project profile:',
    '',
    '  npx repro-agent init',
    '  npx repro-agent build',
    '',
    'The page it builds has all of that embedded: a shorter form for the user, and a',
    'much better-informed assistant. Docs: https://github.com/gufan0000/repro-agent',
    '',
    'This file is for you. Ship it or delete it, either is fine.',
    '',
  ].join('\r\n');
}

// ---------------------------------------------------------------------------- zip writer

/** 2020-01-01 00:00:00 in DOS date/time, so two builds of one commit are byte-identical. */
const DOS_TIME = 0;
const DOS_DATE = ((2020 - 1980) << 9) | (1 << 5) | 1;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Write a zip archive from `[name, contents]` pairs.
 *
 * Entry names are UTF-8 with the language-encoding flag set, which is what stops a Chinese
 * filename from arriving as mojibake in Windows Explorer.
 */
export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, contents] of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const raw = Buffer.from(contents, 'utf8');
    const deflated = deflateRawSync(raw, { level: 9 });
    // Storing is only smaller for content deflate cannot help with; prefer whichever wins.
    const stored = deflated.length >= raw.length;
    const body = stored ? raw : deflated;
    const flags = 0x0800; // bit 11: the name is UTF-8

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4); // version needed
    header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(stored ? 0 : 8, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc32(raw), 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    locals.push(header, nameBytes, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += 30 + nameBytes.length + body.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

if (process.argv[1] && process.argv[1].endsWith('build-packages.mjs')) main();
