import type { APIRoute } from 'astro';
import { scanUrl } from '../../lib/scanner/index';
import { checkRateLimit } from '../../lib/security/rate-limiter';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  // Parse request body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'invalid_request', message: 'Request body must be valid JSON with a "url" field.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const url = body.url?.trim();
  if (!url) {
    return new Response(
      JSON.stringify({ error: 'missing_url', message: 'Please provide a URL to scan.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const runtime = locals as { runtime?: { env?: { RATE_LIMIT_KV?: KVNamespace } } };
  const kv = runtime.runtime?.env?.RATE_LIMIT_KV;
  const rateLimit = await checkRateLimit(ip, kv);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', message: rateLimit.error }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '3600',
        },
      }
    );
  }

  // Run scan
  const result = await scanUrl(url);

  // Check if it's an error
  if ('error' in result) {
    const statusMap: Record<string, number> = {
      invalid_url: 400,
      fetch_failed: 502,
      scan_failed: 500,
    };
    return new Response(JSON.stringify(result), {
      status: statusMap[result.error] || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': String(rateLimit.remaining),
    },
  });
};
