/**
 * Closet Manager — Cloudflare Worker proxy for GitHub API
 *
 * Secrets (set via `wrangler secret put` or the Cloudflare dashboard):
 *   CLOSET_PASSPHRASE   Shared secret sent by closet-manager.html
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
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Closet-Passphrase',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith('/proxy/contents/')) {
      const filePath = url.pathname.slice('/proxy/contents/'.length);
      return handleContents(request, env, filePath);
    }

    if (url.pathname === '/proxy/image') {
      return handleImage(request, env, url.searchParams.get('url'));
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

// ─── Auth ────────────────────────────────────────────────────────────────────

function isAuthed(request, env) {
  return request.headers.get('X-Closet-Passphrase') === env.CLOSET_PASSPHRASE;
}

// ─── GitHub contents proxy ────────────────────────────────────────────────────

async function handleContents(request, env, filePath) {
  if (!isAuthed(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
  if (!filePath) return jsonResponse({ error: 'Missing file path' }, 400);

  const ghUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${filePath}`;
  const ghHeaders = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'closet-manager-worker',
  };

  if (request.method === 'GET') {
    const res = await fetch(ghUrl, { headers: ghHeaders });
    return jsonResponse(await res.json(), res.status);
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); }
    catch { return jsonResponse({ error: 'Invalid JSON body' }, 400); }

    const res = await fetch(ghUrl, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return jsonResponse(await res.json(), res.status);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ─── External image proxy ─────────────────────────────────────────────────────

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif']);

async function handleImage(request, env, imageUrl) {
  if (!isAuthed(request, env)) return jsonResponse({ error: 'Unauthorized' }, 401);
  if (!imageUrl) return jsonResponse({ error: 'Missing url parameter' }, 400);

  let parsed;
  try { parsed = new URL(imageUrl); } catch {
    return jsonResponse({ error: 'Invalid URL' }, 400);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonResponse({ error: 'Only http/https URLs are allowed' }, 400);
  }

  let res;
  try { res = await fetch(imageUrl); } catch (e) {
    return jsonResponse({ error: 'Failed to fetch image: ' + e.message }, 502);
  }
  if (!res.ok) return jsonResponse({ error: 'Upstream returned ' + res.status }, 502);

  const mimeType = (res.headers.get('Content-Type') || 'image/jpeg').split(';')[0].trim();
  if (!ALLOWED_MIME.has(mimeType)) {
    return jsonResponse({ error: 'Unsupported image type: ' + mimeType }, 400);
  }

  const buffer = await res.arrayBuffer();
  const content = arrayBufferToBase64(buffer);
  return jsonResponse({ content, mimeType });
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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
