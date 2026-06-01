// Cloudflare Pages Function — proxies all /api/* requests to the Render backend.
//
// Why a proxy rather than calling Render directly from the frontend:
// this keeps the frontend using relative /api/* URLs (no hardcoded host,
// no CORS headers needed), and the Render URL is configured once as an
// environment variable in the Cloudflare Pages dashboard.
//
// Set RENDER_API_URL in Cloudflare Pages → Settings → Environment variables.
// Value: your Render service URL, e.g. https://cocktail-shaker-api.onrender.com
// (no trailing slash)

export async function onRequest(context) {
  const { request, env, params } = context;

  const renderUrl = env.RENDER_API_URL;
  if (!renderUrl) {
    return new Response(JSON.stringify({ error: 'API not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(request.url);
  const path = '/api/' + (params.path ? params.path.join('/') : '');
  const backendUrl = renderUrl.replace(/\/$/, '') + path + url.search;

  return fetch(backendUrl, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });
}
