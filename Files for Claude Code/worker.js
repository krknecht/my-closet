/**
 * Closet Manager — Cloudflare Worker proxy
 * Auth: Origin allowlist (returns 403 for unlisted origins).
 *
 * Secrets (set via `wrangler secret put` or the Cloudflare dashboard):
 *   ANTHROPIC_API_KEY   Anthropic API key used server-side
 *   GITHUB_TOKEN        Personal access token with `repo` scope
 *
 * Vars (set in wrangler.toml or the dashboard):
 *   GITHUB_OWNER        e.g. katerknecht
 *   GITHUB_REPO         e.g. my-closet
 *
 * Routes:
 *   GET  /proxy/contents/{path}        Read file from GitHub (returns GitHub API JSON)
 *   PUT  /proxy/contents/{path}        Write file to GitHub (body: {message, content, sha?})
 *   GET  /proxy/image?url={encodedUrl} Fetch external image; returns {content: base64, mimeType}
 *   POST /proxy/anthropic              Proxy to Anthropic Messages API using server-side key
 */

const ALLOWED_ORIGINS = new Set([
  'https://doesthislookright.com',
  'https://my-closet.pages.dev',
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith('/proxy/contents/')) {
      const filePath = url.pathname.slice('/proxy/contents/'.length);
      return handleContents(request, env, filePath, origin);
    }

    if (url.pathname === '/proxy/image') {
      return handleImage(request, env, url.searchParams.get('url'), origin);
    }

    if (url.pathname === '/proxy/anthropic') {
      return handleAnthropic(request, env, origin);
    }

    return jsonResponse({ error: 'Not found' }, 404, origin);
  },
};

// ─── GitHub contents proxy ────────────────────────────────────────────────────

async function handleContents(request, env, filePath, origin) {
  if (!filePath) return jsonResponse({ error: 'Missing file path' }, 400, origin);

  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;
  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'closet-manager-worker',
  };

  if (request.method === 'GET') {
    const res = await fetch(ghUrl, { headers: ghHeaders });
    return jsonResponse(await res.json(), res.status, origin);
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin); }

    const res = await fetch(ghUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return jsonResponse(await res.json(), res.status, origin);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405, origin);
}

// ─── External image proxy ─────────────────────────────────────────────────────

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);

async function handleImage(request, env, imageUrl, origin) {
  if (!imageUrl) return jsonResponse({ error: 'Missing url parameter' }, 400, origin);

  let parsed;
  try { parsed = new URL(imageUrl); } catch {
    return jsonResponse({ error: 'Invalid URL' }, 400, origin);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonResponse({ error: 'Only http/https URLs are allowed' }, 400, origin);
  }

  let res;
  try { res = await fetch(imageUrl); } catch (e) {
    return jsonResponse({ error: 'Failed to fetch image: ' + e.message }, 502, origin);
  }
  if (!res.ok) return jsonResponse({ error: 'Upstream returned ' + res.status }, 502, origin);

  const mimeType = (res.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
  if (!ALLOWED_MIME.has(mimeType)) {
    return jsonResponse({ error: 'Unsupported image type: ' + mimeType }, 400, origin);
  }

  const buffer = await res.arrayBuffer();
  const content = arrayBufferToBase64(buffer);
  return jsonResponse({ content, mimeType }, 200, origin);
}

// ─── Anthropic proxy ──────────────────────────────────────────────────────────

async function handleAnthropic(request, env, origin) {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, origin);

  let body;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin); }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const headers = {
    'Content-Type': res.headers.get('Content-Type') || 'text/event-stream',
    ...corsHeaders(origin),
  };
  return new Response(res.body, { status: res.status, headers });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks to avoid call stack limits on large images
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function jsonResponse(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
