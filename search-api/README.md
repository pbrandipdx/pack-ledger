# Gear search function

Powers the search bar at the top of Pack Ledger. The page sends a query, the function asks Brave Search, pulls out a name, brand, and weight from the results, and returns up to 5 candidates.

```
GET /functions/v1/gear-search?q=zpacks+duplex
-> { "query": "...", "cached": false,
     "results": [{ "name", "brand", "weight_oz", "confidence", "weight_note", "source_url", "source_host" }] }
```

`weight_oz` is `null` when no weight was found. `confidence` is `"high"` when two sources agree or the text says packed/trail/listed weight, otherwise `"low"` (the page shows a "Verify" flag). A number is only used when the words just before it say it is a weight, so fluid ounces, shipping weight, and fabric density are ignored. A missing weight is expected and fine: the add form lets you type it in.

## Files

| File | Purpose |
|---|---|
| `index.ts` | The Supabase edge function (Deno). Calls Brave, checks the cache, enforces the CORS allowlist. |
| `parse.mjs` | Pure parsing and ranking code, also used by the tests. |
| `parse.test.mjs` | Tests. Run `node --test search-api/parse.test.mjs`. |
| `schema.sql` | The 30-day result cache table (RLS on, no policies, so only the function can touch it). |

## One-time setup

1. Create a Brave Search API key at https://api-dashboard.search.brave.com and check the plan's monthly limit.
2. In the Supabase project, run `schema.sql`.
3. Set the secret `BRAVE_API_KEY` in the project's Edge Function secrets (dashboard, not this repo).
4. Deploy `index.ts` and `parse.mjs` as a function named `gear-search` with JWT verification off (the site is static and cannot hold a secret).
5. Put the function URL in `config.js` at the repo root (`window.PACK_SEARCH_URL`). The search bar stays hidden while that is empty.

## Things to know

- The CORS allowlist in `index.ts` (`ALLOWED_ORIGINS`) limits which websites can call the function from a browser. It is not authentication: someone could call the URL directly. The cache, the 80-character query limit, and your Brave plan's monthly cap are what bound the cost.
- Brave's `extra_snippets` option gives more text to find weights in. If a plan rejects it, the function retries without it and finds fewer weights.
- Add brands to the `BRANDS` list in `parse.mjs` when a brand comes back blank.
