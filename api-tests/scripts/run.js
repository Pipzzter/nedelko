import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/http/app.js';
import { openStore } from '../../backend/storage/database.js';
import { getConditions } from '../../backend/services/conditions.js';

const localPath = path => fileURLToPath(new URL(path, import.meta.url));

function localUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('base-url must be a loopback HTTP origin, for example http://127.0.0.1:4173');
  }
  return url.origin;
}

async function startIsolatedServer() {
  const server = createApp({
    store: openStore(':memory:'),
    conditionsProvider: options => {
      if (options.mode !== 'demo') throw new Error('This API suite only uses synthetic demo conditions.');
      return getConditions(options);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

function runCollection(baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      localPath('../node_modules/postman-cli/bin/postman.js'),
      'collection', 'run', localPath('../postman/nedelko.postman_collection.json'),
      '--environment', localPath('../postman/local.postman_environment.json'),
      '--env-var', `baseUrl=${baseUrl}`,
      '--reporters', 'cli', '--no-report-events',
      '--timeout', '120000', '--timeout-request', '10000', '--timeout-script', '5000',
      '--ignore-redirects', '--bail'
    ], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error('Postman API run failed. See the CLI output above.'));
    });
  });
}

let server;
try {
  const { values } = parseArgs({ options: { local: { type: 'boolean' }, 'base-url': { type: 'string' } } });
  if (values['base-url'] && !values.local) throw new Error('Use --local with --base-url to test a running app.');
  const environment = JSON.parse(await readFile(localPath('../postman/local.postman_environment.json'), 'utf8'));
  let baseUrl = environment.values.find(variable => variable.key === 'baseUrl').value;
  if (values.local) baseUrl = localUrl(values['base-url'] || baseUrl);
  else {
    server = await startIsolatedServer();
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }
  console.log(values.local ? `Testing running app at ${baseUrl}` : 'Testing an isolated app with in-memory SQLite and synthetic demos.');
  await runCollection(baseUrl);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  });
}
