const VALHALLA_ORIGIN = 'https://valhalla1.openstreetmap.de/route';
const CLIENT_ID = 'grand-tour-stage-lab-worker';

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Cache-Control': 'no-store'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!['GET', 'POST'].includes(request.method)) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let target = VALHALLA_ORIGIN;
    let body;
    const headers = {
      'Accept': 'application/json',
      'X-Client-Id': CLIENT_ID
    };

    if (request.method === 'POST') {
      body = await request.text();
      headers['Content-Type'] = 'application/json';
    } else {
      const sourceUrl = new URL(request.url);
      target += sourceUrl.search;
    }

    try {
      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body
      });
      const responseHeaders = new Headers(upstream.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));
      responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
