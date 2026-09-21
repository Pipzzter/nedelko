import test from 'node:test';
import assert from 'node:assert/strict';
import { sonarClient, assertQualityPolicy, configureProject } from '../lib/sonar.js';

const standard = [{ metric: 'new_coverage', op: 'LT', error: '80' },
  { metric: 'new_violations', op: 'GT', error: '0' },
  { metric: 'new_duplicated_lines_density', op: 'GT', error: '3' },
  { metric: 'new_security_hotspots_reviewed', op: 'LT', error: '100' }];
const policy = [{ metric: 'line_coverage', op: 'LT', error: '91' },
  ...standard.map(c => c.metric === 'new_coverage' ? { ...c, error: '91' } : c)];

test('Sonar credentials are required, loopback-only, sent in headers and never copied into errors', async () => {
  assert.throws(() => sonarClient({}), /SONAR_TOKEN/);
  for (const host of ['https://example.com', 'http://user:pass@localhost:9000', 'http://localhost:9000/private', 'http://localhost:9000/?token=secret']) {
    assert.throws(() => sonarClient({ SONAR_TOKEN: 'fixture', SONAR_HOST_URL: host }), /loopback/);
  }
  const request = sonarClient({ SONAR_TOKEN: 'PRIVATE-TOKEN' }, async (url, options) => {
    assert.equal(url.hostname, '127.0.0.1'); assert.equal(options.headers.Authorization, 'Bearer PRIVATE-TOKEN');
    assert.equal(options.redirect, 'error'); assert.doesNotMatch(url.href, /PRIVATE/);
    return Response.json({ private: 'PRIVATE-BODY' }, { status: 403 });
  });
  await assert.rejects(request('qualitygates/show'), error => /HTTP 403/.test(error.message) && !/PRIVATE/.test(error.message));
});

test('Sonar policy rejects missing or weakened server coverage conditions', async () => {
  const request = conditions => async (path, params) => path.endsWith('get_by_project') ? { qualityGate: { name: 'Nedelko' } } : { conditions: params.name === 'Sonar way' ? standard : conditions };
  await assertQualityPolicy(request(policy));
  for (const rule of policy) {
    await assert.rejects(assertQualityPolicy(request(policy.filter(c => c.metric !== rule.metric))), /gate must enforce/);
    for (const replacement of [{ ...rule, error: String(Number(rule.error) + (rule.op === 'LT' ? -1 : 1)) }, { ...rule, op: rule.op === 'LT' ? 'GT' : 'LT' }]) {
      await assert.rejects(assertQualityPolicy(request(policy.map(c => c.metric === rule.metric ? replacement : c))), /gate must enforce/);
    }
  }
  await assert.rejects(assertQualityPolicy(async () => ({ qualityGate: { name: 'Sonar way' } })), /Nedelko/);
});

test('Sonar setup creates a private project once, copies the standard gate and reconciles thresholds on repeat', async () => {
  let project = false; let gate = false; const writes = []; const conditions = [];
  const request = async (path, params, method = 'GET') => {
    if (method === 'POST') writes.push({ path, params });
    if (path === 'qualitygates/show' && params.name === 'Sonar way') return { conditions: standard };
    if (path === 'components/show' && !project || path === 'qualitygates/show' && !gate) throw { status: 404 };
    if (path === 'projects/create') { project = true; assert.equal(params.visibility, 'private'); }
    if (path === 'qualitygates/copy') {
      assert.deepEqual(params, { sourceName: 'Sonar way', name: 'Nedelko' }); gate = true;
      conditions.push(...standard.map((rule, i) => ({ ...rule, id: String(i) })));
    }
    if (path === 'qualitygates/show') return { conditions };
    if (path === 'qualitygates/create_condition') conditions.push({ id: 'overall', metric: params.metric, op: params.op, error: params.error });
    if (path === 'qualitygates/update_condition') Object.assign(conditions.find(condition => condition.id === params.id), params);
    if (path === 'qualitygates/get_by_project') return { qualityGate: { name: 'Nedelko' } };
    return {};
  };
  await configureProject(request); await configureProject(request);
  assert.equal(writes.filter(call => call.path === 'projects/create').length, 1);
  assert.equal(writes.filter(call => call.path === 'qualitygates/copy').length, 1);
  assert.equal(writes.filter(call => call.path === 'qualitygates/create_condition').length, 1);
  assert.ok(conditions.filter(c => c.metric.includes('coverage')).every(condition => condition.error === '91'));
  conditions.splice(conditions.findIndex(c => c.metric === 'new_violations'), 1);
  await configureProject(request);
  assert.equal(conditions.find(c => c.metric === 'new_violations').error, '0');
  assert.deepEqual(writes.at(-1), { path: 'qualitygates/select', params: { gateName: 'Nedelko', projectKey: 'nedelko' } });
  await assert.rejects(configureProject(async () => { throw Object.assign(new Error('forbidden'), { status: 403 }); }), /forbidden/);
});
