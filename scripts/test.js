import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { files } from './lib/files.js';
import { checkCoverage, relativeLcov, MINIMUM_LINES } from './lib/coverage.js';
import { cli, root, run } from './lib/process.js';

await cli(async () => {
  process.chdir(root);
  const coverage = process.argv.includes('--coverage');
  const tests = (await Promise.all(['backend/tests', 'frontend/tests', 'scripts/tests', 'static-analysis/tests'].map(files))).flat().filter(path => path.endsWith('.test.js'));
  const args = ['--test'];
  if (coverage) {
    await mkdir('coverage', { recursive: true });
    await rm('coverage/lcov.info', { force: true });
    await rm('coverage/summary.json', { force: true });
    args.push('--experimental-test-coverage', '--test-coverage-include=backend/**/*.js',
      '--test-coverage-include=frontend/src/**/*.js', '--test-coverage-exclude=backend/tests/**',
      '--test-reporter=spec', '--test-reporter-destination=stdout',
      '--test-reporter=lcov', '--test-reporter-destination=coverage/lcov.info');
  }
  // Never load .env: provider calls in tests must use injected, synthetic fixtures.
  run(process.execPath, [...args, ...tests]);
  if (!coverage) return;
  const lcov = relativeLcov(await readFile('coverage/lcov.info', 'utf8'), root);
  await writeFile('coverage/lcov.info', lcov);
  const sources = (await Promise.all(['backend', 'frontend/src'].map(files))).flat()
    .filter(path => path.endsWith('.js') && !path.replaceAll('\\', '/').startsWith('backend/tests/'));
  const result = checkCoverage(lcov, sources, root);
  await writeFile('coverage/summary.json', JSON.stringify({ minimumLines: MINIMUM_LINES, ...result }, null, 2) + '\n');
  for (const group of result.groups) console.log(`${group.scope} ${group.percent.toFixed(2)}% lines (${group.hit}/${group.found}); required ${MINIMUM_LINES}%.`);
  if (!result.passed) throw new Error('Line coverage gate failed. See coverage/lcov.info and coverage/summary.json.');
});
