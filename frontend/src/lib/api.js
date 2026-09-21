import { beginRequest } from './request-progress.js';

export async function api(path, body) {
  const finish = beginRequest(path, Boolean(body?.demoId));
  try {
    let response;
    try {
      response = await fetch(`/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        // Generation includes environmental requests and up to three minutes for OpenAI.
        signal: AbortSignal.timeout(requestTimeout({ path }))
      });
    } catch (error) {
      const code = path === '/week/generate' && error?.name === 'TimeoutError' ? 'generation_timeout' : 'network_error';
      throw Object.assign(new Error(code), { code });
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw Object.assign(new Error('unexpected_error'), { code: 'unexpected_error' });
    }
    if (!response.ok)
      throw Object.assign(new Error(result.error), {
        code: result.error,
        status: response.status,
        generationIssue: result.generationIssue,
        generationError: result.generationError,
        timing: result.timing
      });
    return result;
  } finally {
    finish();
  }
}

function requestTimeout({ path }) {
  if (path === '/week/generate') {
    return 270000;
  }
  if (path === '/parent-notes/suggest') {
    return 190000;
  }
  if (['/week/day/suggest', '/week/change/suggest'].includes(path)) {
    return 120000;
  }
  return 60000;
}
