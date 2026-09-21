import { readFile } from 'node:fs/promises';
import { cli, run, root } from '../scripts/lib/process.js';
import { sonarClient, assertQualityPolicy } from './lib/sonar.js';

await cli(async () => {
  process.chdir(root);
  const request = sonarClient();
  const summary = JSON.parse(await readFile('coverage/summary.json', 'utf8').catch(() => { throw new Error('Run npm run test:coverage successfully before analysis.'); }));
  if (!summary.passed || summary.minimumLines < 91) throw new Error('Passing coverage >= 91% is required before analysis.');
  run('docker', ['compose', '-f', 'static-analysis/compose.yaml', 'up', '-d', '--wait', '--wait-timeout', '360', 'sonarqube']);
  await assertQualityPolicy(request);
  run('docker', ['compose', '-f', 'static-analysis/compose.yaml', '--profile', 'analysis', 'run', '--rm', '--no-deps', 'sonar-scanner']);
});
