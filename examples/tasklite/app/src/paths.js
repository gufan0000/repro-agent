import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Where TaskLite keeps config, tasks and logs.
 * TASKLITE_HOME overrides it, which is how the test fixtures and portable
 * installs point at a directory that is not the real user profile.
 */
export function dataDir() {
  if (process.env.TASKLITE_HOME) return process.env.TASKLITE_HOME;
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'TaskLite');
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'TaskLite');
  }
  return join(homedir(), '.config', 'tasklite');
}

export function configPath() {
  return join(dataDir(), 'config.json');
}

export function logDir() {
  return join(dataDir(), 'logs');
}
