export const PROJECT = 'nedelko';
export const GATE = 'Nedelko';

export function sonarClient(env = process.env, fetcher = fetch) {
  if (!env.SONAR_TOKEN?.trim()) throw new Error('SONAR_TOKEN is required; SonarQube analysis cannot be skipped.');
  const base = new URL(env.SONAR_HOST_URL || 'http://127.0.0.1:9000');
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('SONAR_HOST_URL must be a loopback HTTP origin.');
  }
  return async (path, parameters = {}, method = 'GET') => {
    const query = new URLSearchParams(parameters); const url = new URL(`/api/${path}`, base);
    if (method === 'GET') url.search = query.toString();
    const response = await fetcher(url, { method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${env.SONAR_TOKEN}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      ...(method === 'POST' ? { body: query.toString() } : {}) });
    if (!response.ok) throw Object.assign(new Error(`SonarQube ${path} failed (HTTP ${response.status}). Check setup and token permissions.`), { status: response.status });
    return response.status === 204 ? {} : response.json();
  };
}

export async function assertQualityPolicy(request) {
  const { qualityGate } = await request('qualitygates/get_by_project', { project: PROJECT });
  if (qualityGate?.name !== GATE) throw new Error('Project must use the Nedelko quality gate. Run npm run sonar:configure.');
  const gate = await request('qualitygates/show', { name: GATE });
  for (const condition of await requiredConditions(request)) {
    if (!gate.conditions?.some(existing => meetsCondition(existing, condition)))
      throw new Error(`SonarQube gate must enforce ${condition.metric} ${condition.op === 'LT' ? '>=' : '<='} ${condition.error}. Run npm run sonar:configure.`);
  }
}

function meetsCondition(existing, required) {
  if (existing.metric !== required.metric || existing.op !== required.op || !Number.isFinite(Number(existing.error))) return false;
  return required.op === 'LT' ? Number(existing.error) >= Number(required.error) : Number(existing.error) <= Number(required.error);
}

async function requiredConditions(request) {
  const standard = await request('qualitygates/show', { name: 'Sonar way' });
  if (!Array.isArray(standard.conditions) || !standard.conditions.length || standard.conditions.some(c =>
    !c.metric || !['LT', 'GT'].includes(c.op) || !Number.isFinite(Number(c.error))))
    throw new Error('Cannot verify inherited Sonar way conditions.');
  return [
    ...['line_coverage', 'new_coverage'].map(metric => ({ metric, op: 'LT', error: '91' })),
    ...standard.conditions.filter(c => !['line_coverage', 'new_coverage'].includes(c.metric))
  ];
}

export async function configureProject(request) {
  try { await request('components/show', { component: PROJECT }); }
  catch (error) {
    if (error.status !== 404) throw error;
    await request('projects/create', { project: PROJECT, name: 'Nedelko', visibility: 'private' }, 'POST');
  }
  let gate;
  try { gate = await request('qualitygates/show', { name: GATE }); }
  catch (error) {
    if (error.status !== 404) throw error;
    await request('qualitygates/copy', { sourceName: 'Sonar way', name: GATE }, 'POST');
    gate = await request('qualitygates/show', { name: GATE });
  }
  for (const { metric, op, error } of await requiredConditions(request)) {
    const existing = gate.conditions.find(condition => condition.metric === metric);
    if (existing && meetsCondition(existing, { metric, op, error })) continue;
    await request(`qualitygates/${existing ? 'update_condition' : 'create_condition'}`,
      { ...(existing ? { id: existing.id } : { gateName: GATE }), metric, op, error }, 'POST');
  }
  await request('qualitygates/select', { gateName: GATE, projectKey: PROJECT }, 'POST');
  await assertQualityPolicy(request);
}
