export const PRIORITIES = ['low', 'normal', 'high'];

/**
 * Imports tasks from the plain-text format: one `title|priority` per line.
 *
 * Lines whose priority is not recognised are skipped rather than aborting the
 * whole import, so that one bad row in a long file does not lose the rest.
 */
export function importTasks(raw, store, config, log) {
  const lines = raw.split('\n');
  let added = 0;
  let skipped = 0;

  for (const entry of lines) {
    if (entry.trim() === '') continue;

    const parts = entry.split('|');
    const title = parts[0];
    const priority = parts.length > 1 ? parts[1] : config.defaultPriority;

    if (!PRIORITIES.includes(priority)) {
      skipped++;
      log.debug(`skipped row with unrecognised priority: ${entry}`);
      continue;
    }

    store.add({ title, priority });
    added++;
  }

  log.info(`import finished: added=${added} skipped=${skipped}`);
  return { added, skipped };
}
