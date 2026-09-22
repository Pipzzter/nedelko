import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { httpFixture } from './http-fixture.js';

test('in-memory HTTP preserves request parsing, Unicode, cookies and streamed binary responses', async t => {
  const payload = Buffer.from('Здраво, kindergarten!');
  let received;
  const server = createServer(async (req, res) => {
    assert.ok(req instanceof IncomingMessage);
    assert.ok(res instanceof ServerResponse);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
    res.writeHead(201, { 'Content-Type': 'application/octet-stream', 'Set-Cookie': ['first=1; HttpOnly', 'second=2'] });
    res.write(payload.subarray(0, 3));
    res.end(payload.subarray(3));
  });
  const { base, fetch, transport } = await httpFixture(t, server, { memory: true });
  const response = await fetch(`${base}/echo?lang=mk`, {
    method: 'POST', headers: { Cookie: 'session=fixture', 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Здраво' })
  });
  assert.equal(transport, 'memory');
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.deepEqual(response.headers.getSetCookie(), ['first=1; HttpOnly', 'second=2']);
  const copy = response.clone();
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), payload);
  assert.equal(await copy.text(), payload.toString());
  assert.equal(received.method, 'POST');
  assert.equal(received.url, '/echo?lang=mk');
  assert.equal(received.headers.host, '127.0.0.1');
  assert.equal(received.headers.cookie, 'session=fixture');
  assert.deepEqual(JSON.parse(received.body), { text: 'Здраво' });
});

test('aborting an in-memory request closes the unfinished server response', { timeout: 2000 }, async t => {
  const server = createServer();
  const { base, fetch } = await httpFixture(t, server, { memory: true });
  const started = once(server, 'request');
  const controller = new AbortController();
  const pending = fetch(base, { signal: controller.signal });
  const [, response] = await started;
  const closed = once(response, 'close');
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await closed;
  assert.equal(response.destroyed, true);
  assert.equal(response.writableFinished, false);
});

test('in-memory requests cannot leave their fixture and pre-aborted requests never reach the server', async t => {
  let calls = 0;
  const server = createServer((_req, res) => { calls++; res.end(); });
  const { base, fetch } = await httpFixture(t, server, { memory: true });
  for (const url of ['https://example.com', 'http://127.0.0.1:4173', 'http://localhost']) {
    await assert.rejects(fetch(url), /must target this fixture/);
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetch(base, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('only listener permission errors select the fallback and every setup closes its server', async t => {
  for (const code of ['EPERM', 'EACCES', 'EADDRINUSE']) {
    let closes = 0;
    await t.test(code, async child => {
      const server = createServer((_req, res) => { res.writeHead(204); res.end(); });
      server.on('close', () => { closes++; });
      child.mock.method(server, 'listen', () => {
        queueMicrotask(() => server.emit('error', Object.assign(new Error(code), { code })));
        return server;
      });
      if (code === 'EADDRINUSE') {
        await assert.rejects(httpFixture(child, server), { code });
      } else {
        const { base, fetch, transport } = await httpFixture(child, server);
        assert.equal(transport, 'memory');
        const response = await fetch(base);
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
      }
    });
    assert.equal(closes, 1, `${code} cleanup`);
  }
});
