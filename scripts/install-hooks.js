import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cli, root, run } from './lib/process.js';
import { gitExecutable } from './lib/git.js';

await cli(() => {
  const current = spawnSync(gitExecutable, ['config', '--get', 'core.hooksPath'], { cwd: root, encoding: 'utf8' });
  if (current.error || ![0, 1].includes(current.status)) throw new Error('Cannot read Git hooks configuration.');
  if (current.stdout.trim() && current.stdout.trim() !== '.githooks') {
    throw new Error('An existing core.hooksPath is configured. Chain .githooks/pre-push from that hook; it has not been overwritten.');
  }
  chmodSync(join(root, '.githooks/pre-push'), 0o755);
  run(gitExecutable, ['config', '--local', 'core.hooksPath', '.githooks']);
  console.log('Pre-push gate installed for this clone. Tests, coverage and SonarQube are required.');
});
