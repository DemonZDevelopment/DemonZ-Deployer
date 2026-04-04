/**
 * DemonZ Deployer — Cloudflare Worker (v3.0.0 — Secure Token Exchange)
 *
 * This Worker performs a Secure Token Exchange for Web Application Flow.
 * The CLIENT_SECRET lives here as an encrypted Cloudflare env variable —
 * it never appears in any frontend file.
 *
 * DEPLOY INSTRUCTIONS:
 *  1. Go to https://workers.cloudflare.com — sign up free
 *  2. Create a new Worker and paste this entire file
 *  3. Set ALLOWED_ORIGINS below to your GitHub Pages URL
 *  4. In Worker Settings → Variables → Secret, add a variable named CLIENT_SECRET
 *     and paste your GitHub OAuth App's client secret as the value
 *  4b. In Worker Settings → Variables → KV Namespace Bindings, create a binding
 *     named RATE_LIMIT bound to a KV namespace. Without this, rate limiting uses
 *     a per-instance in-memory Map and will not enforce limits across Worker
 *     instances in production. The KV binding enables persistent cross-instance
 *     rate limiting at no extra code cost (the Worker already supports it).
 *  5. Click Save & Deploy
 *  6. Copy the *.workers.dev URL into CONFIG.PROXY_URL in js/config.js
 *
 * GITHUB OAUTH APP SETTINGS:
 *  - Authorization callback URL must be set to your app's URL, e.g.:
 *    https://demonzdevelopment.github.io/DemonZ-Deployer/
 *
 * OPTIONAL — Cloudflare KV rate limiting:
 *  Bind a KV namespace called RATE_LIMIT in your Worker settings for
 *  persistent rate limiting across all Worker instances.
 */

// ── Configuration ─────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://demonzdevelopment.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const EXCHANGE_PATH = '/exchange';
const MAX_BODY_BYTES = 1024;
const RATE_LIMIT_MAX        = 10;
const RATE_LIMIT_WINDOW_SEC = 300;

// ── In-memory fallback store ──────────────────────────────────────────────────
const memStore = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function reply(body, status, origin, extra = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      ...extra,
    },
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes('*') ||
    ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o));
}

async function checkRateLimit(ip, env) {
  const key   = `rl:${ip}:exchange`;
  const now   = Math.floor(Date.now() / 1000);
  const reset = now + RATE_LIMIT_WINDOW_SEC;

  if (env?.RATE_LIMIT) {
    const raw   = await env.RATE_LIMIT.get(key);
    const entry = raw ? JSON.parse(raw) : { count: 0, reset };
    if (now > entry.reset) { entry.count = 0; entry.reset = reset; }
    entry.count++;
    await env.RATE_LIMIT.put(key, JSON.stringify(entry), {
      expirationTtl: RATE_LIMIT_WINDOW_SEC + 10,
    });
    return entry.count > RATE_LIMIT_MAX;
  }

  const entry = memStore.get(key) || { count: 0, reset };
  if (now > entry.reset) { entry.count = 0; entry.reset = reset; }
  entry.count++;
  memStore.set(key, entry);

  if (memStore.size > 5000) {
    for (const [k, v] of memStore) {
      if (now > v.reset) memStore.delete(k);
    }
  }
  return entry.count > RATE_LIMIT_MAX;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handleRequest(request, env) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin);
  const cors    = corsHeaders(allowed ? origin : '');

  if (request.method === 'OPTIONS') {
    if (!allowed) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  if (!allowed) {
    return reply('{"error":"Forbidden"}', 403, '');
  }

  if (request.method !== 'POST') {
    return reply('{"error":"Method not allowed"}', 405, origin);
  }

  const { pathname } = new URL(request.url);
  if (pathname !== EXCHANGE_PATH) {
    return reply('{"error":"Not found"}', 404, origin);
  }

  if (!env?.CLIENT_SECRET) {
    console.error('CLIENT_SECRET environment variable is not set.');
    return reply(
      '{"error":"Worker misconfigured — CLIENT_SECRET is not set."}',
      500,
      origin
    );
  }

  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return reply('{"error":"Payload too large"}', 413, origin);
  }

  const ip        = request.headers.get('CF-Connecting-IP') || 'unknown';
  const throttled = await checkRateLimit(ip, env);
  if (throttled) {
    return reply(
      '{"error":"Too many requests. Please wait before trying again."}',
      429,
      origin,
      { 'Retry-After': String(RATE_LIMIT_WINDOW_SEC) }
    );
  }

  const bodyText  = await request.text();
  const byteSize  = new TextEncoder().encode(bodyText).length;
  if (byteSize > MAX_BODY_BYTES) {
    return reply('{"error":"Payload too large"}', 413, origin);
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return reply('{"error":"Invalid JSON body"}', 400, origin);
  }

  if (
    !payload.code       || typeof payload.code      !== 'string' || payload.code.length      > 256 ||
    !payload.client_id  || typeof payload.client_id !== 'string' || payload.client_id.length > 128
  ) {
    return reply('{"error":"Missing or invalid \\"code\\" or \\"client_id\\" field"}', 400, origin);
  }

  const EXPECTED_CLIENT_ID = 'Ov23liFAyEj9YNz0XrRN';
  if (payload.client_id !== EXPECTED_CLIENT_ID) {
    return reply('{"error":"Invalid client_id"}', 400, origin);
  }

  try {
    const upstream = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'DemonZ-Deployer-Worker/3.0.0',
      },
      body: JSON.stringify({
        client_id:     payload.client_id,
        client_secret: env.CLIENT_SECRET,
        code:          payload.code,
      }),
    });

    const responseText = await upstream.text();

    try { JSON.parse(responseText); } catch {
      return reply('{"error":"Upstream returned an unexpected response"}', 502, origin);
    }

    return new Response(responseText, {
      status:  upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Upstream fetch to GitHub failed:', err.message);
    return reply('{"error":"Upstream request to GitHub failed"}', 502, origin);
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
