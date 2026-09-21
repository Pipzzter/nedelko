import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './http/app.js';
export { createApp } from './http/app.js';

export function serverOptions(env = process.env) {
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
  const host = env.BIND_HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('BIND_HOST must be 127.0.0.1 or 0.0.0.0 (container only)');
  return { port, host };
}

export function startServer({ env = process.env, factory = createApp, lifecycle = process, logger = console } = {}) {
  const { port, host } = serverOptions(env);
  const server = factory({ autoRefreshMs: 60000 });
  server.on('error', error => { logger.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy.` : 'Server could not start.'); lifecycle.exitCode = 1; });
  server.listen(port, host, () => logger.log(`EkoCuvar: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) lifecycle.on(signal, () => server.close(() => lifecycle.exit(0)));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) startServer();
