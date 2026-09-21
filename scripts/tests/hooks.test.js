import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, readFile, rm } from 'node:fs/promises';
import { tmpdir, devNull } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gitExecutable } from '../lib/git.js';

test('hook installation ignores PATH executables and preserves an existing custom hook', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ekocuvar-hooks-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_SYSTEM: devNull };
  const git = args => spawnSync(gitExecutable, args, { cwd: directory, env, encoding: 'utf8' });
  assert.equal(git(['init', '--quiet']).status, 0);
  for (const child of ['scripts/lib', '.githooks', 'untrusted']) await mkdir(join(directory, child), { recursive: true });
  for (const file of ['install-hooks.js', 'lib/process.js', 'lib/git.js']) {
    await copyFile(new URL('../' + file, import.meta.url), join(directory, 'scripts', file));
  }
  await writeFile(join(directory, 'package.json'), '{"type":"module"}\n');
  await writeFile(join(directory, '.githooks/pre-push'), '#!/bin/sh\nexit 0\n');
  const marker = join(directory, 'untrusted-ran');
  await writeFile(join(directory, 'untrusted/git'), '#!/bin/sh\nprintf unsafe > untrusted-ran\nexit 97\n', { mode: 0o755 });
  const install = () => spawnSync(process.execPath, ['scripts/install-hooks.js'], {
    cwd: directory, env: { ...env, PATH: join(directory, 'untrusted') }, encoding: 'utf8'
  });
  const installed = install();
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.equal(git(['config', '--local', 'core.hooksPath', 'custom-hooks']).status, 0);
  const refused = install();
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /existing core.hooksPath/);
  assert.equal(git(['config', '--get', 'core.hooksPath']).stdout.trim(), 'custom-hooks');
});
