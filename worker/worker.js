/**
 * DemonZ Deployer — Cloudflare Worker CORS Proxy (Hardened)
 *
 * DEPLOY INSTRUCTIONS:
 *  1. Go to https://workers.cloudflare.com — sign up free
 *  2. Create a new Worker
 *  3. Paste this entire file
 *  4. Set ALLOWED_ORIGINS below to your actual GitHub Pages URL
 *  5. Click Save & Deploy
 *  6. Copy the *.workers.dev URL into CONFIG.PROXY_URL in js/config.js
 *
 * OPTIONAL — Cloudflare KV rate limiting:
 *  For stricter rate limiting, bind a KV namespace called RATE_LIMIT
 *  in your Worker settings. Without it, the in-memory fallback is used
 *  (resets per Worker instance, still provides meaningful protection).
 */

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * Set this to your GitHub Pages URL (and localhost for dev).
 * Requests from any other origin will be rejected with 403.
 * Use ['*'] to allow all origins — NOT recommended for production.
 */
const ALLOWED_ORIGINS = [
  'https://demonzdevelopment.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

/** Only these two paths are proxied — everything else returns 404. */
const ALLOWED_TARGETS = {
  '/device/code': 'https://github.com/login/device/code',
  '/token':       'https://github.com/login/oauth/access_token',
};

/** Max request body size in bytes (1 KB is ample for OAuth payloads). */
const MAX_BODY_BYTES = 1024;

/**
 * Rate limit: max requests per IP per window.
 * /device/code is intentionally stricter (prevents code-spam).
 */
const RATE_LIMITS = {
  '/device/code': { max: 5,  windowSec: 300 }, // 5 per 5 min
  '/token':       { max: 30, windowSec: 300 }, // 30 per 5 min (polling)
};

// ── In-memory fallback store (resets per Worker isolate, ~per-request in free plan) ──
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
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', ...extra },
  });
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.includes('*') ||
    ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o));
}

/**
 * Simple IP-based rate limiter.
 * Uses Cloudflare KV if the RATE_LIMIT binding exists, otherwise in-memory.
 */
async function checkRateLimit(ip, pathname, env) {
  const rule = RATE_LIMITS[pathname];
  if (!rule) return false; // unknown path — blocked earlier anyway

  const key   = `rl:${ip}:${pathname}`;
  const now   = Math.floor(Date.now() / 1000);
  const reset = now + rule.windowSec;

  // ── KV-backed (persistent across Workers instances) ──
  if (env && env.RATE_LIMIT) {
    const raw = await env.RATE_LIMIT.get(key);
    const entry = raw ? JSON.parse(raw) : { count: 0, reset };

    if (now > entry.reset) { entry.count = 0; entry.reset = reset; }
    entry.count++;

    await env.RATE_LIMIT.put(key, JSON.stringify(entry), { expirationTtl: rule.windowSec + 10 });
    return entry.count > rule.max;
  }

  // ── In-memory fallback ──
  const entry = memStore.get(key) || { count: 0, reset };
  if (now > entry.reset) { entry.count = 0; entry.reset = reset; }
  entry.count++;
  memStore.set(key, entry);
  // Prune old entries to avoid unbounded growth
  if (memStore.size > 5000) {
    for (const [k, v] of memStore) { if (now > v.reset) memStore.delete(k); }
  }
  return entry.count > rule.max;
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handleRequest(request, env) {
  const origin = request.headers.get('Origin') || '';
  const cors   = corsHeaders(isAllowedOrigin(origin) ? origin : '');

  // Preflight
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: cors });
  }

  // Origin check (rejects non-browser direct calls too)
  if (!isAllowedOrigin(origin)) {
    return reply('{"error":"Forbidden"}', 403, '');
  }

  // Method guard
  if (request.method !== 'POST') {
    return reply('{"error":"Method not allowed"}', 405, origin);
  }

  // Path guard
  const { pathname } = new URL(request.url);
  const target = ALLOWED_TARGETS[pathname];
  if (!target) {
    return reply('{"error":"Not found"}', 404, origin);
  }

  // Body size guard
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return reply('{"error":"Payload too large"}', 413, origin);
  }

  // Rate limit
  const ip        = request.headers.get('CF-Connecting-IP') || 'unknown';
  const throttled = await checkRateLimit(ip, pathname, env);
  if (throttled) {
    return reply(
      '{"error":"Too many requests. Please wait before trying again."}',
      429,
      origin,
      { 'Retry-After': String(RATE_LIMITS[pathname].windowSec) }
    );
  }

  // Read + size-check body
  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return reply('{"error":"Payload too large"}', 413, origin);
  }

  // Validate body is JSON (no garbage forwarding)
  try { JSON.parse(bodyText); }
  catch { return reply('{"error":"Invalid JSON body"}', 400, origin); }

  // Proxy to GitHub
  try {
    const upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'DemonZ-Deployer-Worker/2.0',
      },
      body: bodyText,
    });

    const text = await upstream.text();

    return new Response(text, {
      status:  upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return reply('{"error":"Upstream request failed"}', 502, origin);
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
