import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApp } from './http/app.js';
export { createApp } from './http/app.js';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
  const server = createApp({ autoRefreshMs: 300000 });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy.` : 'Server could not start.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`EkoCuvar: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
