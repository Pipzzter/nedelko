import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
let failed = false; let count = 0;
for (const directory of ['backend', 'frontend', 'scripts']) for (const file of await files(directory)) {
  if (!file.endsWith('.js')) continue;
  count++;
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) { failed = true; console.error(result.stderr); }
}
console.log(`${count} JavaScript files checked.`); process.exitCode = failed ? 1 : 0;
