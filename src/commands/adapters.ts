import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Args } from '../index.js';
import { renderProtocol } from '../core/render.js';
import { str, pick, loadProfile, LANGUAGES, REGIONS, AUTONOMIES } from './shared.js';
import { PROTOCOL_VERSION, type Autonomy, type Language, type ProjectProfile, type Region } from '../core/types.js';

interface AdapterContext {
  language: Language;
  region: Region;
  autonomy: Autonomy;
  profile?: ProjectProfile;
}

const T = {
  en: {
    agentsTitle: 'Repro Agent diagnostic mode',
    agentsIntro: (name: string) =>
      `This file makes any AI agent a competent first-line diagnostician for **${name}** on an end user's machine.\n\nIt activates when the user hands you a Repro Agent task file, or simply says that ${name} is broken and asks for help. Outside of that, ignore it.`,
    profileHeading: 'Project profile',
    profileNote:
      'The JSON below is this project\'s Repro Agent profile. Treat it as maintainer-supplied fact: it tells you where this software keeps its files, what is already known to break, and what you must never touch.',
    noProfile:
      'No project profile was supplied. Ask the user for the software name and version, then follow the protocol using local evidence and whatever public documentation you can reach.',
    skillDescription: (name: string) =>
      `Diagnose a problem with ${name} on this computer, fix it if it is safely fixable, and otherwise produce a bug report the maintainers can act on. Use when the user reports that ${name} is broken, crashing, or behaving unexpectedly.`,
  },
  'zh-CN': {
    agentsTitle: 'Repro Agent 诊断模式',
    agentsIntro: (name: string) =>
      `本文件让任意 AI 助手成为用户电脑上 **${name}** 的一线诊断专家。\n\n当用户递来 Repro Agent 任务文件，或者直接说 ${name} 出问题了求助时，启用本文件。其他情况下忽略它。`,
    profileHeading: '项目档案',
    profileNote:
      '下面的 JSON 是本项目的 Repro Agent 档案。请把它当作维护者提供的事实：它告诉你这个软件的文件放在哪里、已知哪些地方会出问题、以及你绝对不能碰什么。',
    noProfile:
      '未提供项目档案。请向用户询问软件名称和版本，然后依据本机证据和可访问的公开文档，按协议执行。',
    skillDescription: (name: string) =>
      `诊断本机上 ${name} 的问题，能安全修复就修复，修不好则产出一份维护者可以直接处理的 bug 报告。当用户反馈 ${name} 无法使用、崩溃或行为异常时使用。`,
  },
} as const;

function profileBlock(context: AdapterContext): string {
  const t = T[context.language];
  if (!context.profile) return `> ${t.noProfile}\n`;
  return [
    `## ${t.profileHeading}`,
    '',
    t.profileNote,
    '',
    '```json',
    JSON.stringify(context.profile, null, 2),
    '```',
    '',
  ].join('\n');
}

export function renderAgentsMd(context: AdapterContext): string {
  const t = T[context.language];
  const name = context.profile?.project.name ?? 'this software';
  return [
    `# ${t.agentsTitle}`,
    '',
    t.agentsIntro(name),
    '',
    profileBlock(context),
    '---',
    '',
    renderProtocol({ language: context.language, region: context.region, autonomy: context.autonomy }),
    '',
  ].join('\n');
}

export function renderWorkbuddySkill(context: AdapterContext): string {
  const t = T[context.language];
  const name = context.profile?.project.name ?? 'the target software';
  // Pure markdown, no scripts and no dependencies: a skill package that can execute code is
  // a supply-chain risk the user has no way to audit before installing it.
  const frontmatter = [
    '---',
    'name: repro-agent',
    `description: ${t.skillDescription(name).replace(/\n/g, ' ')}`,
    `version: ${PROTOCOL_VERSION}`,
    'license: MIT',
    '---',
    '',
  ].join('\n');
  return (
    frontmatter +
    [
      `# Repro Agent Doctor`,
      '',
      t.agentsIntro(name),
      '',
      profileBlock(context),
      '---',
      '',
      renderProtocol({ language: context.language, region: context.region, autonomy: context.autonomy }),
      '',
    ].join('\n')
  );
}

export function cmdAdapters(args: Args): number {
  const which = args._[1] ?? 'all';
  if (!['generic', 'workbuddy', 'all'].includes(which)) {
    process.stderr.write(`unknown adapter: ${which} (expected generic, workbuddy or all)\n`);
    return 1;
  }

  const profilePath = str(args, 'profile');
  const profile = profilePath ? loadProfile(profilePath) : undefined;
  const context: AdapterContext = {
    language: pick(args, 'lang', LANGUAGES, profile?.defaults?.language ?? 'en'),
    region: pick(args, 'region', REGIONS, profile?.defaults?.region ?? 'global'),
    autonomy: pick(args, 'autonomy', AUTONOMIES, profile?.defaults?.autonomy ?? 'guided'),
    profile,
  };

  const outDir = resolve(str(args, 'out', '.'));
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];

  if (which === 'generic' || which === 'all') {
    const path = join(outDir, 'REPRO_AGENTS.md');
    writeFileSync(path, renderAgentsMd(context), 'utf8');
    written.push(path);
  }
  if (which === 'workbuddy' || which === 'all') {
    const dir = join(outDir, 'repro-agent');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'SKILL.md');
    writeFileSync(path, renderWorkbuddySkill(context), 'utf8');
    written.push(path);
  }

  process.stdout.write(`${written.map((p) => `wrote ${p}`).join('\n')}\n`);
  return 0;
}
