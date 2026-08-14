// The illustrated walkthrough that ships inside the Chinese package.
//
// Screenshots are inlined as data URIs for the same reason the diagnostic page is one file:
// this gets opened by double-clicking it out of a folder somebody downloaded, possibly with
// no network, and a tutorial with broken images is worse than no tutorial.
//
// The screenshots are of WorkBuddy because that is what was to hand. Nothing in the protocol
// is WorkBuddy-specific, and the page says so at the top rather than leaving a reader with
// Claude Code or Cursor wondering whether they are in the wrong document.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = join(root, 'docs', 'tutorial', 'workbuddy');

function shot(file) {
  const bytes = readFileSync(join(shotDir, file));
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

/** Steps that carry a screenshot, then the ones that do not yet. */
const STEPS = [
  {
    shot: '01.png',
    title: '你收到的文件夹长这样',
    body: [
      '开发者给你的包里通常是三样东西：一个 AI 助手的安装包、一个「开始诊断」网页，还有一份说明。',
      '如果你电脑上已经有在用的 AI 助手，前面几步可以跳过，直接看第 6 步。',
    ],
  },
  {
    shot: '02.png',
    title: '装助手：选「仅为我安装」',
    body: ['不需要管理员权限，也不会影响这台电脑上的其他人。'],
  },
  {
    shot: '03.png',
    title: '安装位置保持默认',
    body: ['直接点「下一步」。这里不需要你做任何判断。'],
  },
  {
    shot: '04.png',
    title: '装完了，让它直接启动',
    body: ['「运行 WorkBuddy」保持勾选，点「完成」。'],
  },
  {
    shot: '05.png',
    title: '登录一次',
    body: ['点「登录」，按它的提示走完。这一步是助手自己的账号，和你要排查的问题无关。'],
  },
  {
    shot: '06.png',
    title: '看到这个界面就说明助手准备好了',
    body: [
      '中间那个大输入框，一会儿要用。先放着不管，回到你收到的文件夹里。',
    ],
  },
  {
    shot: '07.png',
    title: '双击「开始诊断.html」，说清楚哪里不对',
    body: [
      '先选一个最接近的问题类型，选不准没关系；再用一句话说明情况，像图里这样「无法安装，报错组件缺失」就够了。',
      '频率、什么时候开始、什么系统——不知道就选「不清楚」，不会因此变差。',
      '权限建议保持「每次修改前先问我」。填完点「生成并下载」。',
    ],
    note: '这个网页从不联网。你填的任何内容都不会离开这台电脑。',
  },
  {
    shot: '08.png',
    title: '把下载到的文件拖进助手',
    body: [
      '刚才下载的是一个 `.md` 文件，一般在浏览器的「下载」文件夹里。把它直接拖进输入框，像图里这样。',
      '如果你有报错的截图，也一起拖进去。',
    ],
  },
  {
    title: '输入「开始」，发送',
    body: [
      '就这两个字。权限那一栏保持「默认权限」，不用改。',
      '接下来助手会自己读那个文件，知道该查什么、能做什么、不能做什么。',
    ],
    pending: true,
  },
  {
    title: '接下来会发生什么',
    body: [
      '**它先看，不动手。** 读日志、读配置、对着这个软件的源码核对，确认问题到底出在哪。',
      '**要改任何东西之前，它会先问你。** 说清楚原因、风险和备份放在哪，等你点头才动手。',
      '**修好了**，它会顺便告诉你怎么撤销。',
      '**修不好**，它会生成一份 `BUG_REPORT.md`：版本、复现步骤、日志、已经排除掉的可能性都在里面。把这份文件发给开发者就行，不用你改——密钥、邮箱和带你用户名的路径已经自动去掉了。',
    ],
    pending: true,
  },
];

const FAQ = [
  ['一定要装 WorkBuddy 吗？',
    '不用。任何能读取你电脑上文件的 AI 助手都可以——Claude Code、Cursor、豆包、ChatGPT 桌面版都行。步骤完全一样：把下载到的 .md 文件交给它，然后说「开始」。'],
  ['会把我的东西传出去吗？',
    '「开始诊断.html」从不联网，你在上面填的内容只存在于这台电脑。助手本身要联网（它需要读软件的源码），但规则明确禁止它把你本机的数据发到任何地方。'],
  ['双击 html 打不开怎么办？',
    '右键点它 → 打开方式 → 挑任意一个浏览器（Edge、Chrome 都行）。'],
  ['生成的 .md 文件跑哪去了？',
    '在浏览器的「下载」文件夹里，文件名以 `REPRO_TASK.md` 结尾。'],
  ['助手让我关掉杀毒软件，或者要删文件，怎么办？',
    '拒绝它。删除文件、关闭安全软件、读取密码和密钥、把本机数据发出去——这四件事在任何情况下都是禁止的。它要是提了，说明它没有照着规则走，别照做。'],
];

/** Inline markdown: `code` and **bold**, on text that is already escaped. */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function renderTutorial() {
  const steps = STEPS.map((step, i) => {
    const image = step.shot ? `<img src="${shot(step.shot)}" alt="">` : '';
    const note = step.note ? `<p class="note">${inline(step.note)}</p>` : '';
    const pending = step.pending
      ? '<p class="pending">这一步暂时还没有配图，照着文字做就行。</p>'
      : '';
    return `<section class="step">
  <h2><span class="num">${i + 1}</span>${escapeHtml(step.title)}</h2>
  ${step.body.map((line) => `<p>${inline(line)}</p>`).join('\n  ')}
  ${note}${image}${pending}
</section>`;
  }).join('\n\n');

  const faq = FAQ.map(([q, a]) => `<details><summary>${escapeHtml(q)}</summary><p>${inline(a)}</p></details>`).join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>图文教程 · 出问题了怎么办</title>
<style>
:root{--bg:#f5f7fb;--panel:#fff;--text:#141b2d;--muted:#5d6b82;--line:#dfe5ee;--soft:#f0f4f9;--accent:#2f5fe0;--warn:#8a5a00;--shadow:0 10px 32px rgba(24,40,72,.09)}
@media (prefers-color-scheme:dark){:root{--bg:#0e131c;--panel:#151c28;--text:#e6ecf6;--muted:#93a1b8;--line:#26303f;--soft:#1b2432;--accent:#6f95ff;--warn:#e0aa4a;--shadow:0 10px 32px rgba(0,0,0,.35)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15.5px/1.7 system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
.wrap{max-width:820px;margin:auto;padding:0 16px 72px}
header{background:linear-gradient(135deg,#132a63,#2f5fe0);color:#fff;padding:28px 0 26px;margin-bottom:20px}
header .wrap{padding-bottom:0}
h1{margin:0 0 8px;font-size:26px;letter-spacing:-.02em}
header p{margin:0;opacity:.93;max-width:640px}
.step{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:20px 20px 22px;margin-bottom:16px}
.step h2{margin:0 0 10px;font-size:18px;display:flex;align-items:center;gap:11px}
.num{flex:none;width:27px;height:27px;border-radius:50%;background:var(--accent);color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center}
.step p{margin:0 0 9px}
img{display:block;width:100%;height:auto;margin-top:13px;border:1px solid var(--line);border-radius:10px}
code{background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:1px 5px;font:13px ui-monospace,SFMono-Regular,Consolas,monospace}
.note{border-radius:10px;padding:10px 13px;font-size:13.5px;border:1px solid var(--line);background:var(--soft);color:var(--muted);margin-top:12px}
.pending{color:var(--muted);font-size:13.5px;margin-top:10px}
h3{margin:30px 0 12px;font-size:19px}
details{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin-bottom:9px}
summary{cursor:pointer;font-weight:600}
details p{margin:9px 0 0;color:var(--muted)}
footer{color:var(--muted);font-size:13px;text-align:center;padding:26px 16px 0}
</style>
</head>
<body>
<header><div class="wrap">
  <h1>出问题了怎么办</h1>
  <p>下面用 WorkBuddy 演示一遍完整流程。换成 Claude Code、Cursor、豆包或者任何能读取你电脑上文件的 AI 助手，步骤都一样。</p>
</div></header>

<div class="wrap">
${steps}

<h3>常见问题</h3>
${faq}

<footer>这份教程和「开始诊断.html」一样，完全离线，不联网。<br>流程本身是开源的：https://github.com/gufan0000/repro-agent</footer>
</div>
</body>
</html>
`;
}

/** Fails the build rather than shipping a tutorial with holes in it. */
export function expectedShots() {
  return readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort();
}
