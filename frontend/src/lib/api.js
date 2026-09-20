export async function api(path, body) {
  let response;
  try { response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    // Generation includes environmental requests and up to three minutes for OpenAI.
    signal: AbortSignal.timeout(path === '/week/generate' ? 240000 : ['/week/day/suggest', '/week/change/suggest'].includes(path) ? 120000 : 60000) }); }
  catch (error) {
    const code = path === '/week/generate' && error?.name === 'TimeoutError' ? 'generation_timeout' : 'network_error';
    throw Object.assign(new Error(code), { code });
  }
  let result; try { result = await response.json(); } catch { throw Object.assign(new Error('unexpected_error'), { code: 'unexpected_error' }); }
  if (!response.ok) throw Object.assign(new Error(result.error), { code: result.error, status: response.status,
    generationIssue: result.generationIssue, generationError: result.generationError });
  return result;
}
