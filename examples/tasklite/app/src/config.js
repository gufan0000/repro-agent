import { readFileSync } from 'node:fs';
import { configPath } from './paths.js';

export const DEFAULT_CONFIG = {
  dataFile: 'tasks.json',
  defaultPriority: 'normal',
  logLevel: 'info',
};

/**
 * Reads config.json, falling back to defaults when it cannot be read.
 *
 * The fallback is deliberate: a broken config should not stop someone from
 * using the app. It is logged, not shown, because the CLI only prints what
 * the user asked for.
 */
export function loadConfig(log) {
  let raw;
  try {
    raw = readFileSync(configPath(), 'utf8');
  } catch {
    log?.debug(`config not found at ${configPath()}, using defaults`);
    return { ...DEFAULT_CONFIG };
  }

  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (err) {
    log?.warn(`config.json could not be parsed (${err.message}); falling back to defaults`);
    return { ...DEFAULT_CONFIG };
  }
}
