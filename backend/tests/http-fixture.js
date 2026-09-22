import { once } from 'node:events';
import { Agent, request } from 'node:http';
import { duplexPair, Readable } from 'node:stream';

const nativeFetch = globalThis.fetch;

// Keep real loopback HTTP where available. Restricted test environments can run
// the same HTTP parsers, app handlers and SQLite assertions over paired streams.
// This fallback does not test OS port binding or TCP connectivity.
export async function httpFixture(t, server, { memory = false } = {}) {
  const sockets = new Set();
  let agent;
  const close = async () => {
    agent?.destroy();
    const closed = [...sockets].map(socket => once(socket, 'close'));
    for (const socket of sockets) socket.destroy();
    await Promise.all(closed);
    await new Promise((resolve, reject) => {
      server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
      server.closeAllConnections();
    });
  };
  t.after(close);
  if (!memory) {
    try {
      const listening = once(server, 'listening');
      server.listen(0, '127.0.0.1');
      await listening;
      return { base: `http://127.0.0.1:${server.address().port}`, fetch: nativeFetch, transport: 'tcp' };
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code)) throw error;
      t.diagnostic(`Loopback listener blocked (${error.code}); running HTTP assertions over in-memory streams.`);
    }
  }

  const base = 'http://127.0.0.1';
  agent = new Agent({ keepAlive: false });
  agent.createConnection = () => {
    const [client, socket] = duplexPair();
    socket.remoteAddress = '127.0.0.1';
    for (const [end, peer] of [[client, socket], [socket, client]]) {
      sockets.add(end);
      end.once('close', () => { sockets.delete(end); peer.destroy(); });
    }
    server.emit('connection', socket);
    return client;
  };
  // Initialize Node's HTTP connection tracking and the application's lifecycle.
  server.emit('listening');
  return {
    base, transport: 'memory',
    async fetch(input, options) {
      const outgoing = new Request(input, options);
      if (new URL(outgoing.url).origin !== base) throw new Error('Test requests must target this fixture.');
      outgoing.signal.throwIfAborted();
      const body = outgoing.body ? Buffer.from(await outgoing.arrayBuffer()) : undefined;
      const headers = Object.fromEntries(outgoing.headers);
      if (body) headers['content-length'] = String(body.length);
      return new Promise((resolve, reject) => {
        const req = request(outgoing.url, { agent, method: outgoing.method, headers, signal: outgoing.signal }, response => {
          const responseHeaders = new Headers();
          for (let i = 0; i < response.rawHeaders.length; i += 2) responseHeaders.append(response.rawHeaders[i], response.rawHeaders[i + 1]);
          const noBody = outgoing.method === 'HEAD' || [204, 205, 304].includes(response.statusCode);
          if (noBody) response.resume();
          resolve(new Response(noBody ? null : Readable.toWeb(response), {
            status: response.statusCode, statusText: response.statusMessage, headers: responseHeaders
          }));
        });
        req.once('error', reject);
        req.end(body);
      });
    }
  };
}
