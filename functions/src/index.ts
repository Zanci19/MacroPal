import { onRequest } from "firebase-functions/v2/https";

/* ============ Shared helpers ============ */
function setCors(res: any) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Vary", "Origin");
}

function setCaching(res: any) {
  // Client cache 60s, CDN/edge cache 300s, serve stale 600s
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
}

// Keep the UI responsive; OFF + CDN caches are typically fast
async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Race mirrors; resolve with the first OK response (no Promise.any dependency). */
async function raceOk(urls: string[], init: RequestInit) {
  return new Promise<Response>((resolve, reject) => {
    let pending = urls.length;
    let lastErr: any;

    for (const u of urls) {
      fetchWithTimeout(u, init)
        .then((r) => {
          if (r.ok) resolve(r);
          else {
            lastErr = new Error(`HTTP ${r.status}`);
            if (--pending === 0) reject(lastErr);
          }
        })
        .catch((e) => {
          lastErr = e;
          if (--pending === 0) reject(lastErr);
        });
    }
  });
}

/* ============ OFF: Barcode ============ */
export const offBarcode = onRequest({ region: "europe-west1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return void res.status(204).send("");

  try {
    const code = (req.query.code || "").toString().trim();
    if (!code) return void res.status(400).json({ error: "missing_code" });

    const urls = [
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      `https://world.openfoodfacts.net/api/v2/product/${encodeURIComponent(code)}.json`,
    ];

    const r = await raceOk(urls, {
      headers: {
        "User-Agent": "MacroPal/1.0 (support@macropal.app)",
        "Accept": "application/json",
      },
    });

    const body = await r.text();
    res.set("Content-Type", r.headers.get("content-type") || "application/json");
    setCaching(res);
    res.status(200).send(body);
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    console.error("offBarcode error:", aborted ? "timeout" : e);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? "upstream_timeout" : "upstream_bad_gateway", message: e?.message ?? "unknown" });
  }
});

/* ============ OFF: Search (V3 primary, V1 fallback) ============ */
/**
 * GET /offSearch?q=term&page=1&page_size=20&lc=en&country=slovenia&fresh=0
 * - V3 (Search-a-licious) is the primary full-text search (best relevance).
 * - V1 is used as a reliable fallback for free-text queries.
 * - Add &fresh=1 only when you truly need uncached results.
 */
export const offSearch = onRequest({ region: "europe-west1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return void res.status(204).send("");

  const qRaw = (req.query.q || "").toString().trim();
  const qLower = qRaw.toLowerCase();
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20) || 20));
  const lc = (req.query.lc || "en").toString().trim();
  const country = (req.query.country || "").toString().trim().toLowerCase();
  const fresh = (req.query.fresh || "").toString().trim() === "1";

  if (!qRaw) return void res.status(400).json({ error: "missing_query" });

  try {
    // Shared fields list for compact responses
    const fields =
      "code,product_name,brands,nutriments,serving_size,image_front_url,nutriscore_grade";

    // ---------- V3 (Search-a-licious) ----------
    // Note: V3 is evolving; current deployments expose it under /api/v3/search on OFF hosts.
    // We keep V1 as a rock-solid fallback if a given mirror/version is unavailable.
    const makeV3 = (host: string) => {
      const u = new URL(`https://${host}/api/v3/search`);
      u.searchParams.set("q", qRaw);
      u.searchParams.set("page", String(page));
      u.searchParams.set("page_size", String(pageSize));
      u.searchParams.set("fields", fields);
      if (lc) u.searchParams.set("lc", lc);
      if (country) u.searchParams.set("countries_tags_en", country);
      if (fresh) u.searchParams.set("nocache", "1"); // opt-in only
      return u.toString();
    };
    const v3Urls = [makeV3("world.openfoodfacts.org"), makeV3("world.openfoodfacts.net")];

    // ---------- V1 (legacy free-text) fallback ----------
    const makeV1 = (host: string) => {
      const u = new URL(`https://${host}/cgi/search.pl`);
      u.searchParams.set("action", "process");
      u.searchParams.set("json", "1");
      u.searchParams.set("search_terms", qRaw);
      u.searchParams.set("search_simple", "1"); // free-text
      u.searchParams.set("sort_by", "unique_scans_n");
      u.searchParams.set("page", String(page));
      u.searchParams.set("page_size", String(pageSize));
      u.searchParams.set("fields", fields);
      if (lc) u.searchParams.set("lc", lc);
      if (country) u.searchParams.set("countries_tags_en", country);
      if (fresh) u.searchParams.set("nocache", "1"); // opt-in only
      return u.toString();
    };
    const v1Urls = [makeV1("world.openfoodfacts.org"), makeV1("world.openfoodfacts.net")];

    let r: Response;
    try {
      r = await raceOk(v3Urls, {
        headers: {
          "User-Agent": "MacroPal/1.0 (support@macropal.app)",
          "Accept": "application/json",
        },
      });
      // If V3 responds but shape is unexpected or empty, we can choose to fall back.
      // We'll parse first and decide below.
      const probe = await r.clone().json().catch(() => null);
      const products = Array.isArray(probe?.products) ? probe.products : [];
      if (!products || products.length === 0) {
        // Fallback to V1 for robustness
        r = await raceOk(v1Urls, {
          headers: {
            "User-Agent": "MacroPal/1.0 (support@macropal.app)",
            "Accept": "application/json",
          },
        });
      } else {
        // reuse parsed body below
      }
    } catch {
      // V3 unavailable => go V1
      r = await raceOk(v1Urls, {
        headers: {
          "User-Agent": "MacroPal/1.0 (support@macropal.app)",
          "Accept": "application/json",
        },
      });
    }

    const json = await r.json();
    let products: any[] = Array.isArray(json?.products) ? json.products : [];

    // Lightweight relevance boost (product_name contains the query)
    products.sort((a, b) => {
      const na = (a.product_name || "").toLowerCase();
      const nb = (b.product_name || "").toLowerCase();
      const scoreA = na.includes(qLower) ? 1 : 0;
      const scoreB = nb.includes(qLower) ? 1 : 0;
      return scoreB - scoreA;
    });

    res.set("Content-Type", "application/json");
    setCaching(res);
    return void res.status(200).send(JSON.stringify({ ...json, products }));
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    console.error("offSearch failed:", aborted ? "timeout" : e);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? "upstream_timeout" : "upstream_bad_gateway", message: e?.message ?? "unknown" });
  }
});
