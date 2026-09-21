import { cli, run } from '../scripts/lib/process.js';
import { sonarClient, configureProject } from './lib/sonar.js';

await cli(async () => {
  const request = sonarClient();
  run('docker', ['compose', '-f', 'static-analysis/compose.yaml', 'up', '-d', '--wait', '--wait-timeout', '360', 'sonarqube']);
  await configureProject(request);
  console.log('Private EkoCuvar project configured: Sonar way checks, >= 91% overall lines and new-code coverage.');
});
