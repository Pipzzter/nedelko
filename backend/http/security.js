import { invalid } from '../domain/settings.js';
export function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
export async function jsonBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) throw invalid('json_required', 415);
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length; if (size > 128000) throw invalid('body_too_large', 413); chunks.push(chunk);
  }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw invalid('invalid_json'); }
}
export function rateLimiter() {
  const buckets = new Map();
  return (key, maximum = 160, period = 60000) => {
    const now = Date.now();
    if (buckets.size > 1000) for (const [k, b] of buckets) if (now >= b.until) buckets.delete(k);
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.until) bucket = { count: 0, until: now + period };
    buckets.set(key, bucket); if (++bucket.count > maximum) throw invalid('rate_limited', 429);
  };
}
