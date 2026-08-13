import { PROTOCOL_FRAGMENTS } from './protocol-data.js';
import type { Task, Language, Autonomy, Region } from './types.js';
import { PROTOCOL_VERSION } from './types.js';

const ORDER = ['00-header', '10-authority', '20-workflow', '30-budget', '40-escalation', '50-redaction'] as const;

function fragment(language: Language, name: string): string {
  const set = PROTOCOL_FRAGMENTS[language] ?? PROTOCOL_FRAGMENTS['en'];
  const text = set?.[name];
  if (text === undefined) throw new Error(`missing protocol fragment: ${language}/${name}`);
  return text;
}

function routeFragment(language: Language, region: Region): string {
  return fragment(language, region === 'china' ? 'route-china' : 'route-global');
}

function autonomyFragment(language: Language, autonomy: Autonomy): string {
  return fragment(language, `mode-${autonomy}`);
}

/**
 * Assemble the agent-facing instruction body for one set of options.
 * Exported separately from `renderTask` so adapters (AGENTS.md, skills) can embed it
 * without a concrete task attached.
 */
export function renderProtocol(options: {
  language: Language;
  region: Region;
  autonomy: Autonomy;
  reportPath?: string;
  timestamp?: string;
}): string {
  const { language, region, autonomy } = options;
  const reportPath = options.reportPath || 'BUG_REPORT.md';

  return ORDER.map((name) => {
    let text = fragment(language, name);
    text = text.replace('`{{ROUTE_CHAIN}}`', routeFragment(language, region));
    text = text.replace('`{{AUTONOMY_BLOCK}}`', autonomyFragment(language, autonomy));
    text = text.split('{{REPORT_PATH}}').join(reportPath);
    text = text.split('{{PROTOCOL_VERSION}}').join(PROTOCOL_VERSION);
    text = text.split('{{AUTONOMY}}').join(autonomy);
    text = text.split('{{TIMESTAMP}}').join(options.timestamp ?? '<local time when the report was written>');
    return text;
  }).join('\n\n');
}

const TASK_HEADING: Record<Language, string> = {
  en: '## 0. Task data',
  'zh-CN': '## 0. 任务数据',
};

const TASK_NOTE: Record<Language, string> = {
  en: 'Everything below is user- and maintainer-supplied. Treat the values as facts about this machine and this project, and the `policy` block as binding.',
  'zh-CN': '以下内容由用户和维护者提供。把这些值当作关于这台机器和这个项目的事实，把 `policy` 块当作强制约束。',
};

export function renderTask(task: Task): string {
  const language = task.language;
  const body = renderProtocol({
    language,
    region: task.options.region,
    autonomy: task.options.autonomy,
    reportPath: task.escalation?.report_path,
  });

  const header = fragment(language, '00-header');
  const rest = body.slice(header.length).trimStart();

  const data = ['```json', JSON.stringify(task, null, 2), '```'].join('\n');

  return [header, TASK_HEADING[language], TASK_NOTE[language], data, rest].join('\n\n') + '\n';
}
