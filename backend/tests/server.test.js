import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { serverOptions, startServer } from '../server.js';

test('native startup stays on loopback; container binding and ports are explicit and validated', () => {
  assert.deepEqual(serverOptions({}), { port: 4173, host: '127.0.0.1' });
  assert.deepEqual(serverOptions({ PORT: '5000', BIND_HOST: '0.0.0.0' }), { port: 5000, host: '0.0.0.0' });
  for (const PORT of ['0', '80', '65536', '4173.5', 'bad']) assert.throws(() => serverOptions({ PORT }), /PORT/);
  for (const BIND_HOST of ['example.com', '192.168.1.2', '::']) assert.throws(() => serverOptions({ BIND_HOST }), /BIND_HOST/);
});

test('startup enables refresh, hides internal errors and closes on either termination signal', () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const lifecycle = new EventEmitter(); const server = new EventEmitter(); const logs = [];
    let closed = false; let exitCode;
    lifecycle.exit = code => { exitCode = code; };
    server.close = callback => { closed = true; callback(); };
    server.listen = (port, host, ready) => { assert.equal(port, 4173); assert.equal(host, '127.0.0.1'); ready(); };
    const result = startServer({ env: {}, lifecycle, logger: { log: value => logs.push(value), error: value => logs.push(value) },
      factory: options => { assert.equal(options.autoRefreshMs, 60000); return server; } });
    assert.equal(result, server);
    server.emit('error', { code: 'EADDRINUSE', message: 'PRIVATE-DETAIL' });
    assert.equal(lifecycle.exitCode, 1); assert.match(logs.at(-1), /busy/);
    server.emit('error', { code: 'EACCES', message: 'PRIVATE-DETAIL' });
    assert.equal(logs.at(-1), 'Server could not start.'); assert.doesNotMatch(logs.join(' '), /PRIVATE/);
    lifecycle.emit(signal); assert.equal(closed, true); assert.equal(exitCode, 0);
  }
});
