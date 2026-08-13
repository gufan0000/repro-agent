#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createLogger } from '../src/log.js';
import { loadConfig } from '../src/config.js';
import { createStore } from '../src/store.js';
import { importTasks } from '../src/import.js';
import { dataDir } from '../src/paths.js';

const VERSION = '1.2.0';

function main(argv) {
  const [command, ...rest] = argv;

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return 0;
  }

  const bootLog = createLogger('info');
  const config = loadConfig(bootLog);
  const log = createLogger(config.logLevel);
  const store = createStore(config, log);

  switch (command) {
    case 'add': {
      const title = rest.join(' ');
      if (!title) {
        console.error('usage: tasklite add <title>');
        return 2;
      }
      store.add({ title, priority: config.defaultPriority });
      store.save();
      console.log(`Added: ${title}`);
      return 0;
    }

    case 'list': {
      const tasks = store.all();
      if (tasks.length === 0) {
        console.log('No tasks.');
        return 0;
      }
      for (const task of tasks) {
        console.log(`${String(task.id).padStart(3)}. [${task.priority}] ${task.title}`);
      }
      return 0;
    }

    case 'import': {
      const file = rest[0];
      if (!file) {
        console.error('usage: tasklite import <file>');
        return 2;
      }
      let raw;
      try {
        raw = readFileSync(file, 'utf8');
      } catch (err) {
        console.error(`Cannot read ${file}: ${err.message}`);
        log.error(`import failed to read ${file}: ${err.message}`);
        return 1;
      }
      log.info(`import started: ${file}`);
      importTasks(raw, store, config, log);
      store.save();
      console.log('Import complete.');
      return 0;
    }

    case 'where': {
      console.log(dataDir());
      return 0;
    }

    default:
      console.log('tasklite <add|list|import|where> [args]');
      return command ? 2 : 0;
  }
}

process.exit(main(process.argv.slice(2)));
