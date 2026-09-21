import { readFileSync } from 'node:fs';
import { cli, root, run } from './lib/process.js';
import { pushedCommits, assertPushMatchesHead } from './lib/push.js';
import { gitExecutable } from './lib/git.js';

await cli(() => {
  process.chdir(root);
  const git = args => run(gitExecutable, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const prePush = process.argv.includes('--pre-push');
  const commits = prePush ? pushedCommits(readFileSync(0, 'utf8')) : null;
  if (commits && !commits.length) { console.log('No source refs to push (deletion only).'); return; }
  const head = git(['rev-parse', 'HEAD']);
  const checkTree = () => {
    if (git(['rev-parse', 'HEAD']) !== head) throw new Error('HEAD changed during verification. Run the gate again.');
    if (prePush) assertPushMatchesHead(commits, head, git(['status', '--porcelain', '--untracked-files=normal']),
      commit => git(['rev-parse', '--verify', `${commit}^{commit}`]));
  };
  checkTree();
  if (!process.env.SONAR_TOKEN?.trim()) throw new Error('SONAR_TOKEN is required. Follow docs/development/quality-gates.md; analysis is never skipped.');
  for (const script of ['scripts/check.js', 'scripts/check-docs.js']) run(process.execPath, [script]);
  run(process.execPath, ['scripts/test.js', '--coverage']);
  checkTree();
  run(process.execPath, ['static-analysis/sonar.js']);
  checkTree();
  console.log('Local gate passed: syntax, documentation, tests, coverage and SonarQube.');
});
