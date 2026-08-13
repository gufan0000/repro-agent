import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Args } from '../index.js';
import { assetPath } from '../core/paths.js';
import { renderAgentsMd, renderWorkbuddySkill } from './adapters.js';
import { str, pick, loadProfile, LANGUAGES, REGIONS, AUTONOMIES } from './shared.js';
import type { ProjectProfile } from '../core/types.js';

const PROFILE_START = '/* BUGBRIDGE:PROFILE:START */';
const PROFILE_END = '/* BUGBRIDGE:PROFILE:END */';

/**
 * Embed the maintainer's profile directly into the offline page.
 *
 * The result must remain a single file the user can open from a USB stick with no network:
 * the page's CSP forbids `connect-src`, so the profile cannot be fetched at runtime and has
 * to be inlined at build time.
 */
export function embedProfile(html: string, profile: ProjectProfile | undefined, defaults: {
  language: string;
  region: string;
  autonomy: string;
}): string {
  const start = html.indexOf(PROFILE_START);
  const end = html.indexOf(PROFILE_END);
  if (start === -1 || end === -1) {
    throw new Error('web/index.html is missing the BUGBRIDGE:PROFILE markers');
  }
  const payload = JSON.stringify({ profile: profile ?? null, defaults }).replace(
    /[<\u2028\u2029]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  return html.slice(0, start + PROFILE_START.length) + `\nconst EMBEDDED = ${payload};\n` + html.slice(end);
}

export function cmdBuild(args: Args): number {
  const profilePath = str(args, 'profile') || '.bugbridge/project.json';
  let profile: ProjectProfile | undefined;
  try {
    profile = loadProfile(profilePath);
  } catch (error) {
    if (args.flags['profile']) throw error;
    process.stderr.write(
      `note: no profile at ${profilePath}; building a generic kit. Run \`bugbridge init\` first for a project-specific one.\n`,
    );
  }

  const language = pick(args, 'lang', LANGUAGES, profile?.defaults?.language ?? 'en');
  const region = pick(args, 'region', REGIONS, profile?.defaults?.region ?? 'global');
  const autonomy = pick(args, 'autonomy', AUTONOMIES, profile?.defaults?.autonomy ?? 'guided');

  const outDir = resolve(str(args, 'out', 'bugbridge-support'));
  mkdirSync(outDir, { recursive: true });

  const html = readFileSync(assetPath('web', 'index.html'), 'utf8');
  const built = embedProfile(html, profile, { language, region, autonomy });
  const htmlName = profile ? `${slug(profile.project.name)}-support.html` : 'bugbridge-support.html';
  writeFileSync(join(outDir, htmlName), built, 'utf8');

  const context = { language, region, autonomy, profile };
  writeFileSync(join(outDir, 'BUGBRIDGE_AGENTS.md'), renderAgentsMd(context), 'utf8');
  mkdirSync(join(outDir, 'bugbridge-doctor'), { recursive: true });
  writeFileSync(join(outDir, 'bugbridge-doctor', 'SKILL.md'), renderWorkbuddySkill(context), 'utf8');
  writeFileSync(join(outDir, 'README.md'), kitReadme(htmlName, language, profile), 'utf8');

  process.stdout.write(
    [
      `Built support kit in ${outDir}`,
      `  ${htmlName}                — give this to users; opens offline, no install`,
      `  BUGBRIDGE_AGENTS.md        — drop into a repo as AGENTS.md, or hand to any agent`,
      `  bugbridge-doctor/SKILL.md  — WorkBuddy / OpenClaw skill package (pure markdown)`,
      `  README.md                  — what to tell your users`,
      '',
      'Attach the HTML file to a GitHub release, or publish the folder with GitHub Pages.',
      '',
    ].join('\n'),
  );
  return 0;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

function kitReadme(htmlName: string, language: string, profile: ProjectProfile | undefined): string {
  const name = profile?.project.name ?? 'this software';
  if (language === 'zh-CN') {
    return [
      `# ${name} 自助诊断包`,
      '',
      '## 给用户',
      '',
      `1. 下载 \`${htmlName}\`，双击用浏览器打开（不联网，不上传任何内容）。`,
      '2. 填写遇到的问题，点「生成」，下载得到的 `.md` 文件。',
      '3. 把这个 `.md` 拖进你的 AI 助手，发送「开始」。',
      '4. 助手会先诊断、尝试修复；修不好会生成一份 `BUG_REPORT.md`，把它贴到 issue 里即可。',
      '',
      '## 给维护者',
      '',
      '- `BUGBRIDGE_AGENTS.md`：放进仓库当 `AGENTS.md`，或直接发给用户的 agent。',
      '- `bugbridge-doctor/SKILL.md`：WorkBuddy / OpenClaw 技能包，纯 Markdown，无脚本无依赖。',
      '- 重新生成：`npx bugbridge build --profile .bugbridge/project.json`',
      '',
    ].join('\n');
  }
  return [
    `# ${name} — self-diagnosis kit`,
    '',
    '## For users',
    '',
    `1. Download \`${htmlName}\` and open it in a browser. It runs entirely offline and uploads nothing.`,
    '2. Describe what went wrong, press Generate, and download the `.md` file.',
    '3. Drag that `.md` into your AI assistant and send `start`.',
    '4. It will diagnose and, where safe, fix the problem. If it cannot, it writes a `BUG_REPORT.md` for you to paste into an issue.',
    '',
    '## For maintainers',
    '',
    '- `BUGBRIDGE_AGENTS.md` — commit as `AGENTS.md`, or hand directly to a user\'s agent.',
    '- `bugbridge-doctor/SKILL.md` — WorkBuddy / OpenClaw skill package. Pure markdown, no scripts, no dependencies.',
    '- Rebuild with `npx bugbridge build --profile .bugbridge/project.json`.',
    '',
  ].join('\n');
}
