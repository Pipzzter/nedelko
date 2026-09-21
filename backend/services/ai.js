import { requestSignal, assertRequestActive } from './request-context.js';

export function aiStatus() { return { configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-6-astra' }; }

async function responseJson(response) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('response-too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function structuredResponse({ instructions, input, schema, name, fetcher = fetch, maxOutputTokens = 3000, timeoutMs = 25000, reasoningEffort }) {
  assertRequestActive();
  if (!process.env.OPENAI_API_KEY) throw new Error('missing-key');
  const model = aiStatus().model;
  // Only attach reasoning controls to the model families whose support is verified.
  const supportsReasoning = /^gpt-(?:5\.6-(?:sol|terra|luna)|6-astra)(?:-\d{4}-\d{2}-\d{2})?$/.test(model);
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(requestSignal() ? [requestSignal()] : [])]);
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, store: false, instructions, input,
      ...(reasoningEffort && supportsReasoning ? { reasoning: { effort: reasoningEffort } } : {}),
      max_output_tokens: maxOutputTokens, text: { format: { type: 'json_schema', name, strict: true, schema } } }),
  });
  if (!response.ok) {
    let providerCode = null; let providerType = null;
    try { const detail = (await responseJson(response)).error; providerCode = detail?.code ?? null; providerType = detail?.type ?? null; } catch {}
    const error = new Error(`openai-${response.status}`);
    error.providerStatus = response.status; error.providerCode = providerCode; error.providerType = providerType;
    error.providerRequestId = response.headers.get('x-request-id');
    throw error;
  }
  const result = await responseJson(response);
  assertRequestActive();
  if (result.status !== 'completed') throw Object.assign(new Error('incomplete-response'), { code: 'ai_incomplete' });
  if (result.output?.some(item => item.content?.some(part => part.type === 'refusal'))) {
    throw Object.assign(new Error('refused-response'), { code: 'ai_refused' });
  }
  const output = result.output?.filter((item) => item.type === 'message').flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text').map((item) => item.text).join('');
  if (!output || output.length > 120000) throw Object.assign(new Error('invalid-output'), { code: 'ai_invalid_output' });
  let value;
  try { value = JSON.parse(output); } catch { throw Object.assign(new Error('invalid-json'), { code: 'ai_invalid_output' }); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('invalid-object'), { code: 'ai_invalid_output' });
  return { value, usage: result.usage ? { input: result.usage.input_tokens, output: result.usage.output_tokens } : null };
}
