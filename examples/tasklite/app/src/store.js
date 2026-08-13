import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './paths.js';

export function createStore(config, log) {
  const file = join(dataDir(), config.dataFile);
  let tasks = [];

  try {
    tasks = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(tasks)) tasks = [];
  } catch {
    log?.debug(`no task file at ${file}, starting empty`);
  }

  return {
    file,
    all: () => tasks,
    add(task) {
      tasks.push({ id: tasks.length + 1, done: false, ...task });
    },
    save() {
      mkdirSync(dataDir(), { recursive: true });
      writeFileSync(file, JSON.stringify(tasks, null, 2), 'utf8');
      log?.info(`saved ${tasks.length} tasks to ${file}`);
    },
  };
}
