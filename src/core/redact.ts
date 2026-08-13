/**
 * Redaction for text that is about to be posted in public.
 *
 * Two design rules, both learned the hard way:
 *
 *  1. Preserve diagnostic signal. Stack frames, error codes, module names, version
 *     strings, loopback and private addresses all stay. A report stripped of those is
 *     worthless to a maintainer, so an over-aggressive redactor just makes people turn
 *     it off.
 *  2. Keep the shape, drop the content. `key=<redacted:token>` tells a maintainer that a
 *     key was present without exposing it.
 *
 * This runs on the user's own machine and never phones home. It is a safety net for the
 * agent, not a substitute for the agent following the protocol's redaction rules.
 */

export interface RedactionRule {
  id: string;
  description: string;
  pattern: RegExp;
  replace: (match: string, ...groups: string[]) => string;
}

export interface RedactionResult {
  text: string;
  counts: Record<string, number>;
  categories: string[];
}

const PRIVATE_IPV4 =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.0\.0\.0|255\.255\.255\.255)/;

export const RULES: RedactionRule[] = [
  {
    id: 'private-key',
    description: 'PEM private key blocks',
    pattern: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,
    replace: () => '<redacted:private-key>',
  },
  {
    id: 'github-token',
    description: 'GitHub personal access / app tokens',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g,
    replace: () => '<redacted:token>',
  },
  {
    id: 'openai-token',
    description: 'OpenAI-style and Anthropic-style API keys',
    pattern: /\b(?:sk|pk)-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}\b/g,
    replace: () => '<redacted:token>',
  },
  {
    id: 'aws-access-key',
    description: 'AWS access key IDs',
    pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16}\b/g,
    replace: () => '<redacted:token>',
  },
  {
    id: 'jwt',
    description: 'JSON Web Tokens',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: () => '<redacted:token>',
  },
  {
    id: 'bearer',
    description: 'Authorization headers',
    pattern: /\b(Authorization\s*[:=]\s*)(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replace: (_m, prefix) => `${prefix}<redacted:token>`,
  },
  {
    id: 'connection-string',
    description: 'URLs carrying credentials',
    pattern: /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/:@]+):([^\s/@]+)@/gi,
    replace: (_m, scheme, user) => `${scheme}${user}:<redacted:secret>@`,
  },
  {
    id: 'assigned-secret',
    description: 'key=value pairs whose key names a secret',
    // The negative lookahead keeps redaction idempotent: running it twice must not
    // rewrite `<redacted:token>` into `<redacted:16-chars>`.
    pattern:
      /\b((?:api[_-]?key|apikey|secret|password|passwd|pwd|token|auth|credential|private[_-]?key|client[_-]?secret|access[_-]?key|session[_-]?id)\s*["']?\s*[:=]\s*["']?)(?!<redacted:)([^\s"',;&}]{4,})/gi,
    replace: (_m, key, value) => `${key}<redacted:${describe(value)}>`,
  },
  {
    id: 'email',
    description: 'Email addresses',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: () => '<redacted:email>',
  },
  {
    id: 'windows-home',
    description: 'Windows user profile paths',
    pattern: /\b([A-Za-z]:\\Users\\)([^\\/:*?"<>|\r\n]+)/g,
    replace: (_m, prefix) => `${prefix}<USER>`,
  },
  {
    id: 'unix-home',
    description: 'macOS and Linux home directories',
    pattern: /(\/(?:home|Users)\/)([A-Za-z0-9._-]+)/g,
    replace: (_m, prefix) => `${prefix}<USER>`,
  },
  {
    id: 'mac-address',
    description: 'MAC addresses',
    pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    replace: () => '<redacted:id>',
  },
  {
    id: 'public-ipv4',
    description: 'Public IPv4 addresses (private and loopback ranges are kept)',
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replace: (match) => {
      const octets = match.split('.').map(Number);
      if (octets.some((o) => o > 255)) return match; // version string, not an address
      return PRIVATE_IPV4.test(match) ? match : '<redacted:host>';
    },
  },
];

function describe(value: string): string {
  if (/^[0-9a-f]+$/i.test(value)) return `${value.length}-char-hex`;
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length % 4 === 0) return `${value.length}-char-base64`;
  return `${value.length}-chars`;
}

export interface RedactOptions {
  /** Extra literal strings to remove, e.g. the machine's hostname or the user's account name. */
  extraLiterals?: string[];
  /** Rule ids to skip. Use sparingly and say so in the report. */
  disable?: string[];
}

export function redact(text: string, options: RedactOptions = {}): RedactionResult {
  const disabled = new Set(options.disable ?? []);
  const counts: Record<string, number> = {};
  let output = text;

  for (const rule of RULES) {
    if (disabled.has(rule.id)) continue;
    let hits = 0;
    output = output.replace(rule.pattern, (...args) => {
      const match = args[0] as string;
      const groups = args.slice(1, -2) as string[];
      const replacement = rule.replace(match, ...groups);
      if (replacement !== match) hits += 1;
      return replacement;
    });
    if (hits > 0) counts[rule.id] = hits;
  }

  for (const literal of options.extraLiterals ?? []) {
    if (literal.length < 3) continue;
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'gi');
    let hits = 0;
    output = output.replace(pattern, () => {
      hits += 1;
      return '<redacted:custom>';
    });
    if (hits > 0) counts['custom'] = (counts['custom'] ?? 0) + hits;
  }

  return { text: output, counts, categories: Object.keys(counts) };
}

/** A human-readable trailer for the bottom of a bug report. */
export function redactionSummary(result: RedactionResult, language: 'en' | 'zh-CN' = 'en'): string {
  if (result.categories.length === 0) {
    return language === 'zh-CN'
      ? '_脱敏检查：未发现需要脱敏的内容。发布前仍请自行确认。_'
      : '_Redaction: nothing matched. Please still skim this before posting._';
  }
  const detail = result.categories.map((id) => `${id} ×${result.counts[id]}`).join(', ');
  return language === 'zh-CN'
    ? `_脱敏检查：已替换 ${detail}。发布前仍请自行确认。_`
    : `_Redaction: replaced ${detail}. Please still skim this before posting._`;
}
