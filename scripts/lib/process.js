import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function isMain(url) {
  return !!process.argv[1] && url === pathToFileURL(resolve(process.argv[1])).href;
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 900000, ...options });
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`${command} failed${result.status === null ? '' : ' (exit ' + result.status + ')'}.`);
  }
  return result.stdout?.trim();
}
export function cli(task) {
  return Promise.resolve()
    .then(task)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
