// Cloudflare Worker entry point.
//
// Intercepts /api/* and proxies to the Render backend (RENDER_API_URL secret).
// Everything else falls through to the static asset binding, which serves the
// PWA files from the project root.
//
// Deploy:
//   wrangler secret put RENDER_API_URL   ← paste Render URL once
//   wrangler deploy

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const renderUrl = env.RENDER_API_URL;
      if (!renderUrl) {
        return new Response(JSON.stringify({ error: 'API not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const backendUrl = renderUrl.replace(/\/$/, '') + url.pathname + url.search;
      return fetch(backendUrl, {
        method: request.method,
        headers: request.headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });
    }

    // sw.js must never be HTTP-cached — browser must always fetch the latest
    // version to detect SW updates. Without this, Cloudflare's default TTL
    // stops version bumps from reaching the phone.
    if (url.pathname === '/sw.js') {
      const response = await env.ASSETS.fetch(request);
      const nocache = new Response(response.body, response);
      nocache.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return nocache;
    }

    return env.ASSETS.fetch(request);
  },
};
