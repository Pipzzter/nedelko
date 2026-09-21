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
  if (!gate.conditions?.some(c => c.metric === 'line_coverage' && c.op === 'LT' && Number(c.error) >= 91)) {
    throw new Error('SonarQube must enforce overall line coverage >= 91%. Run npm run sonar:configure.');
  }
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
  for (const metric of ['line_coverage', 'new_coverage']) {
    const existing = gate.conditions.find(condition => condition.metric === metric);
    await request(`qualitygates/${existing ? 'update_condition' : 'create_condition'}`,
      { ...(existing ? { id: existing.id } : { gateName: GATE }), metric, op: 'LT', error: '91' }, 'POST');
  }
  await request('qualitygates/select', { gateName: GATE, projectKey: PROJECT }, 'POST');
  await assertQualityPolicy(request);
}
