import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logDir } from './paths.js';

const LEVELS = ['debug', 'info', 'warn', 'error'];

function line(level, message) {
  return `${new Date().toISOString()} [${level.toUpperCase()}] ${message}\n`;
}

export function createLogger(level = 'info') {
  const threshold = LEVELS.indexOf(level) === -1 ? 1 : LEVELS.indexOf(level);
  const dir = logDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `tasklite-${new Date().toISOString().slice(0, 10)}.log`);

  const write = (lvl, message) => {
    if (LEVELS.indexOf(lvl) < threshold) return;
    try {
      appendFileSync(file, line(lvl, message), 'utf8');
    } catch {
      // Logging must never take the app down.
    }
  };

  return {
    file,
    debug: (m) => write('debug', m),
    info: (m) => write('info', m),
    warn: (m) => write('warn', m),
    error: (m) => write('error', m),
  };
}
