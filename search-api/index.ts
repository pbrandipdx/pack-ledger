// Supabase Edge Function: gear-search
//
//   GET /functions/v1/gear-search?q=zpacks+duplex
//   -> { query, cached, results: [{ name, brand, weight_oz, confidence, weight_note, source_url, source_host }] }
//
// Secrets (set in Supabase, never in the repo):
//   BRAVE_API_KEY   your Brave Search API key
// Provided automatically by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy with JWT verification off (the page is a public static site and cannot hold a secret):
//   supabase functions deploy gear-search --no-verify-jwt

import { rankResults } from "./parse.mjs";

const ALLOWED_ORIGINS = [
  "https://pbrandipdx.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];
const CACHE_DAYS = 30;
const BRAVE_URL = "https://api.search.brave.com/res/v1/web/search";

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { "Vary": "Origin" };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type";
    h["Access-Control-Max-Age"] = "86400";
  }
  return h;
}

function json(body: unknown, status: number, origin: string | null, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin), ...extra },
  });
}

// ---- cache (Supabase REST, service role). Every failure here is non-fatal. -------------

function cacheEnv() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return url && key ? { url, key } : null;
}

async function cacheGet(cacheKey: string): Promise<unknown[] | null> {
  const env = cacheEnv();
  if (!env) return null;
  try {
    const since = new Date(Date.now() - CACHE_DAYS * 86400000).toISOString();
    const res = await fetch(
      `${env.url}/rest/v1/gear_search_cache?key=eq.${encodeURIComponent(cacheKey)}&created_at=gte.${encodeURIComponent(since)}&select=results&limit=1`,
      { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` } },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] && Array.isArray(rows[0].results) ? rows[0].results : null;
  } catch (_e) {
    return null;
  }
}

async function cachePut(cacheKey: string, results: unknown[]) {
  const env = cacheEnv();
  if (!env || !results.length) return;
  try {
    await fetch(`${env.url}/rest/v1/gear_search_cache?on_conflict=key`, {
      method: "POST",
      headers: {
        apikey: env.key,
        Authorization: `Bearer ${env.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ key: cacheKey, results, created_at: new Date().toISOString() }),
    });
  } catch (_e) { /* ignore */ }
}

// ---- Brave -----------------------------------------------------------------------------

async function braveSearch(query: string, apiKey: string, extraSnippets: boolean) {
  const params = new URLSearchParams({
    q: `${query} weight specs`,
    count: "10",
    safesearch: "moderate",
  });
  if (extraSnippets) params.set("extra_snippets", "true");
  return await fetch(`${BRAVE_URL}?${params}`, {
    headers: { "Accept": "application/json", "X-Subscription-Token": apiKey },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);

  // Browsers always send Origin on cross-origin fetches. Reject other sites.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return json({ error: "forbidden_origin" }, 403, origin);

  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/\s+/g, " ").trim();
  if (q.length < 2 || q.length > 80) return json({ error: "bad_query", message: "Use 2 to 80 characters." }, 400, origin);

  const cacheKey = q.toLowerCase();
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return json({ query: q, cached: true, results: cached }, 200, origin, { "Cache-Control": "public, max-age=3600" });
  }

  const apiKey = Deno.env.get("BRAVE_API_KEY");
  if (!apiKey) return json({ error: "not_configured" }, 500, origin);

  let res: Response;
  try {
    res = await braveSearch(q, apiKey, true);
    // Some plans reject extra_snippets. Retry once without it.
    if (res.status === 400 || res.status === 422) res = await braveSearch(q, apiKey, false);
  } catch (_e) {
    return json({ error: "upstream_unreachable" }, 502, origin);
  }

  if (res.status === 429) return json({ error: "rate_limited" }, 429, origin, { "Retry-After": "5" });
  if (!res.ok) return json({ error: "upstream_error", status: res.status }, 502, origin);

  let body: unknown;
  try { body = await res.json(); } catch (_e) { return json({ error: "upstream_bad_json" }, 502, origin); }

  const results = rankResults(q, body as never, 5);
  await cachePut(cacheKey, results);
  return json({ query: q, cached: false, results }, 200, origin, { "Cache-Control": "public, max-age=3600" });
});
