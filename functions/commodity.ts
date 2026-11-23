const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Upstream guard + cache so a hung Yahoo request can't hold edge workers
// and repeated dashboard polls don't hammer the upstream.
const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;
let cached: string | null = null;
let lastFetchAt = 0;

export default async function(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Short in-memory cache: Brent barely moves intraday and this shields
  // Yahoo from a stampede when many dashboards poll at once.
  const now = Date.now();
  if (now - lastFetchAt < CACHE_TTL_MS && cached) {
    return new Response(cached, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/BZ=F', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Yahoo Finance returned ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    cached = JSON.stringify(data);
    lastFetchAt = Date.now();
    return new Response(cached, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
