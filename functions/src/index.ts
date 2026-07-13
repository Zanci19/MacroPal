import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten, onDocumentWrittenWithAuthContext } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Response as ExpressResponse } from "express";
import crypto from "node:crypto";

initializeApp();
const firestore = getFirestore();

/* ============ Shared helpers ============ */
function setCors(res: ExpressResponse) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Vary", "Origin");
}

function setCaching(res: ExpressResponse) {
  // Client cache 60s, CDN/edge cache 300s, serve stale 600s
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
}

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const shiftDateKey = (key: string, delta: number): string => {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
};

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
    let lastErr: Error | undefined;

    for (const u of urls) {
      fetchWithTimeout(u, init)
        .then((r) => {
          if (r.ok) resolve(r);
          else {
            lastErr = new Error(`HTTP ${r.status}`);
            if (--pending === 0) reject(lastErr);
          }
        })
        .catch((e: unknown) => {
          lastErr = e as Error;
          if (--pending === 0) reject(lastErr);
        });
    }
  });
}

const googleVisionApiKey = defineSecret("GOOGLE_VISION_API_KEY");
const fatsecretConsumerKey = defineSecret("FATSECRET_CONSUMER_KEY");
const fatsecretConsumerSecret = defineSecret("FATSECRET_CONSUMER_SECRET");

/* ============ Google Vision (proxy) ============ */
export const visionRecognize = onRequest(
  { region: "europe-west1", secrets: [googleVisionApiKey] },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return void res.status(204).send("");
    if (req.method !== "POST") return void res.status(405).json({ error: "method_not_allowed" });

    const imageBase64Raw = (req.body?.imageBase64 || "").toString();
    const imageBase64 = imageBase64Raw.replace(/^data:image\/\w+;base64,/, "");
    if (!imageBase64) return void res.status(400).json({ error: "missing_image_base64" });
    if (imageBase64.length > 8_000_000) return void res.status(413).json({ error: "image_too_large" });

    const key = googleVisionApiKey.value();
    if (!key) return void res.status(500).json({ error: "vision_api_key_missing" });

    try {
      const upstream = await fetchWithTimeout(
        `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                image: { content: imageBase64 },
                features: [
                  { type: "LABEL_DETECTION", maxResults: 10 },
                  { type: "WEB_DETECTION", maxResults: 5 },
                ],
              },
            ],
          }),
        },
        8000
      );

      const body = await upstream.text();
      if (!upstream.ok) {
        return void res.status(502).json({
          error: "upstream_bad_gateway",
          status: upstream.status,
          message: body.slice(0, 500),
        });
      }

      res.set("Content-Type", "application/json");
      return void res.status(200).send(body);
    } catch (error: unknown) {
      const e = error as Error & { name?: string };
      const aborted = e?.name === "AbortError";
      console.error("visionRecognize error:", aborted ? "timeout" : e);
      return void res
        .status(aborted ? 504 : 502)
        .json({ error: aborted ? "upstream_timeout" : "upstream_bad_gateway", message: e?.message ?? "unknown" });
    }
  }
);

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
  } catch (error: unknown) {
    const e = error as Error & { name?: string };
    const aborted = e?.name === "AbortError";
    console.error("offBarcode error:", aborted ? "timeout" : e);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? "upstream_timeout" : "upstream_bad_gateway", message: e?.message ?? "unknown" });
  }
});

/* ============ Food search normalization types ============ */
type SearchHit = {
  code: string;
  product_name: string;
  brands: string;
  serving_size?: string;
  image_front_url?: string | null;
  nutriscore_grade?: string | null;
  nutriments: Record<string, number | undefined>;
  dataSource: "fatsecret" | "openfoodfacts";
  food_type?: string;
};

/* ============ FatSecret (OAuth 1.0 two-legged) ============ */
// FatSecret's premier account provisions foods.search.v5 under both OAuth 1.0 and
// OAuth 2.0. We use OAuth 1.0 request-signing here because it is two-legged (no
// token endpoint) and, unlike OAuth 2.0, does NOT require the caller's egress IP
// to be pre-registered — which matters because Cloud Functions egress IPs are dynamic.
const FATSECRET_ENDPOINT = "https://platform.fatsecret.com/rest/server.api";

function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/** Build a signed FatSecret request URL (GET, HMAC-SHA1). */
function signFatSecretUrl(
  params: Record<string, string>,
  consumerKey: string,
  consumerSecret: string
): string {
  const oauth: Record<string, string> = {
    ...params,
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(oauth)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(oauth[k])}`)
    .join("&");
  const baseStr = ["GET", rfc3986(FATSECRET_ENDPOINT), rfc3986(paramStr)].join("&");
  const signature = crypto
    .createHmac("sha1", `${rfc3986(consumerSecret)}&`)
    .update(baseStr)
    .digest("base64");
  const finalParams: Record<string, string> = { ...oauth, oauth_signature: signature };
  const qs = Object.keys(finalParams)
    .map((k) => `${rfc3986(k)}=${rfc3986(finalParams[k])}`)
    .join("&");
  return `${FATSECRET_ENDPOINT}?${qs}`;
}

const toNum = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : undefined;
};
const round2 = (v: number | undefined): number | undefined =>
  v === undefined ? undefined : Math.round(v * 100) / 100;
const asArray = <T>(x: T | T[] | undefined | null): T[] =>
  Array.isArray(x) ? x : x != null ? [x] : [];

type FsServing = Record<string, unknown>;

/** Grams (or ml) represented by a serving's metric block, converting oz if needed. */
function servingGrams(s: FsServing): number | undefined {
  const amt = toNum(s.metric_serving_amount);
  if (!amt || amt <= 0) return undefined;
  const unit = String(s.metric_serving_unit || "").toLowerCase();
  if (unit === "g" || unit === "ml") return amt;
  if (unit === "oz") return amt * 28.3495;
  return undefined;
}

/** Convert a FatSecret v5 food object into the app's OFF-compatible hit shape. */
function normalizeFatSecretFood(food: Record<string, unknown>): SearchHit | null {
  const name = String((food.food_name as string) ?? "").trim();
  if (!name) return null;

  const servings = asArray(
    (food.servings as { serving?: FsServing | FsServing[] } | undefined)?.serving
  );

  // Base serving with a metric weight => lets us derive per-100g values.
  let base: FsServing | undefined;
  let grams: number | undefined;
  for (const s of servings) {
    const g = servingGrams(s);
    if (g) {
      base = s;
      grams = g;
      break;
    }
  }
  const def =
    servings.find((s) => String(s.is_default) === "1") || servings[0] || undefined;

  const nutriments: Record<string, number | undefined> = {};
  if (base && grams) {
    const per100 = (v: unknown) => round2(((toNum(v) ?? 0) * 100) / grams!);
    nutriments["energy-kcal_100g"] = per100(base.calories);
    nutriments["proteins_100g"] = per100(base.protein);
    nutriments["carbohydrates_100g"] = per100(base.carbohydrate);
    nutriments["fat_100g"] = per100(base.fat);
    nutriments["sugars_100g"] = per100(base.sugar);
    nutriments["fiber_100g"] = per100(base.fiber);
    nutriments["saturated-fat_100g"] = per100(base.saturated_fat);
    nutriments["trans-fat_100g"] = per100(base.trans_fat);
    nutriments["polyunsaturated-fat_100g"] = per100(base.polyunsaturated_fat);
    nutriments["monounsaturated-fat_100g"] = per100(base.monounsaturated_fat);
    // FatSecret reports sodium in mg; the app renders sodium/salt in grams (OFF
    // convention), so convert mg -> g here. Other minerals (potassium, calcium,
    // iron, cholesterol) stay in mg and vitamins in µg to match their display units.
    if (base.sodium !== undefined) {
      const sodiumG100 = round2(((toNum(base.sodium) ?? 0) * 100) / grams! / 1000);
      nutriments["sodium_100g"] = sodiumG100;
      nutriments["salt_100g"] =
        sodiumG100 === undefined ? undefined : round2(sodiumG100 * 2.5);
    }
    nutriments["potassium_100g"] = per100(base.potassium);
    nutriments["cholesterol_100g"] = per100(base.cholesterol);
    nutriments["calcium_100g"] = per100(base.calcium);
    nutriments["iron_100g"] = per100(base.iron);
    nutriments["vitamin-a_100g"] = per100(base.vitamin_a);
    nutriments["vitamin-c_100g"] = per100(base.vitamin_c);
    nutriments["vitamin-d_100g"] = per100(base.vitamin_d);
  }
  if (def) {
    nutriments["energy-kcal_serving"] = toNum(def.calories);
    nutriments["proteins_serving"] = toNum(def.protein);
    nutriments["carbohydrates_serving"] = toNum(def.carbohydrate);
    nutriments["fat_serving"] = toNum(def.fat);
    nutriments["sugars_serving"] = toNum(def.sugar);
    nutriments["fiber_serving"] = toNum(def.fiber);
    nutriments["saturated-fat_serving"] = toNum(def.saturated_fat);
    // Per-serving sodium also mg -> g for the macro card.
    if (def.sodium !== undefined) {
      const sodiumGServing = round2((toNum(def.sodium) ?? 0) / 1000);
      nutriments["sodium_serving"] = sodiumGServing;
      nutriments["salt_serving"] =
        sodiumGServing === undefined ? undefined : round2(sodiumGServing * 2.5);
    }
  }

  const image =
    asArray(
      (food.food_images as { food_image?: Array<{ image_url?: string }> } | undefined)
        ?.food_image
    )[0]?.image_url ?? null;

  return {
    code: `fs:${food.food_id}`,
    product_name: name,
    brands: String((food.brand_name as string) ?? "").trim(),
    serving_size: def?.serving_description ? String(def.serving_description) : undefined,
    image_front_url: image,
    nutriscore_grade: null,
    nutriments,
    dataSource: "fatsecret",
    food_type: food.food_type ? String(food.food_type) : undefined,
  };
}

/** Query FatSecret foods.search.v5. Returns null on any failure so callers can fall back. */
async function searchFatSecret(
  qRaw: string,
  page: number,
  pageSize: number,
  consumerKey: string,
  consumerSecret: string
): Promise<{ products: SearchHit[]; count: number } | null> {
  const params: Record<string, string> = {
    method: "foods.search.v5",
    format: "json",
    search_expression: qRaw,
    page_number: String(Math.max(0, page - 1)), // FatSecret pages are 0-based
    max_results: String(pageSize),
    flag_default_serving: "true",
    include_food_images: "true",
  };
  const url = signFatSecretUrl(params, consumerKey, consumerSecret);

  try {
    const r = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 6000);
    if (!r.ok) {
      console.warn(`FatSecret HTTP ${r.status}`);
      return null;
    }
    const json = (await r.json()) as {
      foods_search?: {
        total_results?: string | number;
        results?: { food?: Record<string, unknown> | Record<string, unknown>[] };
      };
      error?: { message?: string };
    };
    if (json.error) {
      console.warn("FatSecret error:", json.error.message);
      return null;
    }
    const foods = asArray(json.foods_search?.results?.food);
    const products = foods
      .map(normalizeFatSecretFood)
      .filter((p): p is SearchHit => p !== null);
    const count = toNum(json.foods_search?.total_results) ?? products.length;
    return { products, count };
  } catch (e) {
    console.warn("FatSecret request failed:", e);
    return null;
  }
}

/* ============ OpenFoodFacts search (fallback) ============ */
/** Free-text OFF search used as a worldwide fallback when FatSecret has no hits. */
async function searchOpenFoodFacts(
  qRaw: string,
  page: number,
  pageSize: number,
  lc: string,
  country: string
): Promise<{ products: SearchHit[]; count: number }> {
  const fields =
    "code,product_name,brands,nutriments,serving_size,image_front_url,nutriscore_grade";

  const makeV1 = (host: string) => {
    const u = new URL(`https://${host}/cgi/search.pl`);
    u.searchParams.set("action", "process");
    u.searchParams.set("json", "1");
    u.searchParams.set("search_terms", qRaw);
    u.searchParams.set("search_simple", "1");
    u.searchParams.set("sort_by", "popularity_key");
    u.searchParams.set("page", String(page));
    u.searchParams.set("page_size", String(pageSize));
    u.searchParams.set("fields", fields);
    if (lc) u.searchParams.set("lc", lc);
    if (country) u.searchParams.set("countries_tags_en", country);
    return u.toString();
  };
  const urls = [makeV1("world.openfoodfacts.org"), makeV1("world.openfoodfacts.net")];

  const r = await raceOk(urls, {
    headers: {
      "User-Agent": "MacroPal/1.0 (support@macropal.app)",
      Accept: "application/json",
    },
  });
  const json = (await r.json()) as {
    products?: Record<string, unknown>[];
    count?: number;
  };
  const raw = Array.isArray(json.products) ? json.products : [];
  const products: SearchHit[] = raw
    .filter((p) => String(p.product_name || "").trim())
    .map((p) => ({
      code: String(p.code ?? ""),
      product_name: String(p.product_name ?? "").trim(),
      brands: String(p.brands ?? "").trim(),
      serving_size: p.serving_size ? String(p.serving_size) : undefined,
      image_front_url: (p.image_front_url as string) ?? null,
      nutriscore_grade: (p.nutriscore_grade as string) ?? null,
      nutriments: (p.nutriments as Record<string, number | undefined>) ?? {},
      dataSource: "openfoodfacts" as const,
    }));
  return { products, count: json.count ?? products.length };
}

/* ============ Food search (FatSecret primary, OFF fallback) ============ */
/**
 * GET /foodSearch?q=term&page=1&page_size=20&lc=en&country=slovenia
 * Primary: FatSecret foods.search.v5 (curated food-logging database, best relevance).
 * Fallback: OpenFoodFacts free-text search (worldwide barcode/brand coverage) when
 * FatSecret is unavailable or returns nothing.
 */
export const foodSearch = onRequest(
  { region: "europe-west1", secrets: [fatsecretConsumerKey, fatsecretConsumerSecret] },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return void res.status(204).send("");

    const qRaw = (req.query.q || "").toString().trim();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20) || 20));
    const lc = (req.query.lc || "en").toString().trim();
    const country = (req.query.country || "").toString().trim().toLowerCase();

    if (!qRaw) return void res.status(400).json({ error: "missing_query" });

    try {
      const key = fatsecretConsumerKey.value();
      const secret = fatsecretConsumerSecret.value();

      if (key && secret) {
        const fs = await searchFatSecret(qRaw, page, pageSize, key, secret);
        if (fs && fs.products.length > 0) {
          res.set("Content-Type", "application/json");
          setCaching(res);
          return void res.status(200).send(
            JSON.stringify({
              products: fs.products,
              count: fs.count,
              page,
              page_size: pageSize,
              source: "fatsecret",
            })
          );
        }
      }

      // Fallback: OpenFoodFacts
      const off = await searchOpenFoodFacts(qRaw, page, pageSize, lc, country);
      res.set("Content-Type", "application/json");
      setCaching(res);
      return void res.status(200).send(
        JSON.stringify({
          products: off.products,
          count: off.count,
          page,
          page_size: pageSize,
          source: "openfoodfacts",
        })
      );
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      const aborted = error.name === "AbortError";
      console.error("foodSearch failed:", aborted ? "timeout" : error);
      res
        .status(aborted ? 504 : 502)
        .json({
          error: aborted ? "upstream_timeout" : "upstream_bad_gateway",
          message: error.message ?? "unknown",
        });
    }
  }
);

/* ============ OFF: Search (legacy alias, OFF-only) ============ */
/** Kept for backwards compatibility with older clients; new clients use /foodSearch. */
export const offSearch = onRequest({ region: "europe-west1" }, async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return void res.status(204).send("");

  const qRaw = (req.query.q || "").toString().trim();
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size ?? 20) || 20));
  const lc = (req.query.lc || "en").toString().trim();
  const country = (req.query.country || "").toString().trim().toLowerCase();

  if (!qRaw) return void res.status(400).json({ error: "missing_query" });

  try {
    const off = await searchOpenFoodFacts(qRaw, page, pageSize, lc, country);
    res.set("Content-Type", "application/json");
    setCaching(res);
    return void res.status(200).send(JSON.stringify({ ...off, source: "openfoodfacts" }));
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const aborted = error.name === "AbortError";
    console.error("offSearch failed:", aborted ? "timeout" : error);
    res
      .status(aborted ? 504 : 502)
      .json({ error: aborted ? "upstream_timeout" : "upstream_bad_gateway", message: error.message ?? "unknown" });
  }
});

export const updateStreakCache = onDocumentWritten(
  { region: "us-central1", document: "users/{uid}/foods/{dateKey}" },
  async (event) => {
    const uid = event.params.uid as string | undefined;
    if (!uid) return;

    const todayKey = toDateKey(new Date());
    const dateKeys = Array.from({ length: 14 }, (_, i) =>
      shiftDateKey(todayKey, -i)
    );
    const refs = dateKeys.map((dateKey) =>
      firestore.doc(`users/${uid}/foods/${dateKey}`)
    );

    try {
      const snapshots = await firestore.getAll(...refs);
      let streak = 0;
      for (const snap of snapshots) {
        const data = snap.data() as Record<string, unknown> | undefined;
        const any = !!(
          (data?.breakfast as unknown[] | undefined)?.length ||
          (data?.lunch as unknown[] | undefined)?.length ||
          (data?.dinner as unknown[] | undefined)?.length ||
          (data?.snacks as unknown[] | undefined)?.length
        );
        if (any) streak++;
        else break;
      }

      await firestore.doc(`users/${uid}`).set(
        {
          profile: {
            streak,
            streakUpdatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
    } catch (error) {
      console.error("updateStreakCache failed:", error);
    }
  }
);

type Role = "user" | "clinician" | "admin";

const ROLE_USER: Role = "user";
const DAY_MS = 24 * 60 * 60 * 1000;
const ADHERENCE_7D_MIN = 0.5;
const ADHERENCE_30D_MIN = 0.6;

const hasAnyEntries = (data: Record<string, unknown> | undefined): boolean =>
  !!(
    (data?.breakfast as unknown[] | undefined)?.length ||
    (data?.lunch as unknown[] | undefined)?.length ||
    (data?.dinner as unknown[] | undefined)?.length ||
    (data?.snacks as unknown[] | undefined)?.length
  );

const countLoggedDays = async (uid: string, days: number): Promise<number> => {
  const today = new Date();
  const refs = Array.from({ length: days }, (_, idx) => {
    const day = new Date(today.getTime() - idx * DAY_MS);
    const key = toDateKey(day);
    return firestore.doc(`users/${uid}/foods/${key}`);
  });

  const docs = await firestore.getAll(...refs);
  return docs.filter((entry) => hasAnyEntries(entry.data() as Record<string, unknown> | undefined)).length;
};

const adherenceRate = (daysLogged: number, windowDays: number): number =>
  Number((Math.max(0, Math.min(daysLogged, windowDays)) / windowDays).toFixed(2));

const buildRiskReasons = (adherence7d: number, adherence30d: number): string[] => {
  const reasons: string[] = [];
  if (adherence7d < ADHERENCE_7D_MIN) reasons.push("low_adherence_7d");
  if (adherence30d < ADHERENCE_30D_MIN) reasons.push("low_adherence_30d");
  return reasons;
};

const upsertAlert = async (uid: string, reasonCode: string, payload: {
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metadata?: Record<string, unknown>;
}) => {
  const nowIso = new Date().toISOString();
  await firestore.doc(`users/${uid}/alerts/${reasonCode}`).set(
    {
      reasonCode,
      severity: payload.severity,
      message: payload.message,
      status: "open",
      metadata: payload.metadata ?? {},
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    { merge: true }
  );
};

const evaluateAndWriteAlerts = async (uid: string) => {
  const [logged7, logged30] = await Promise.all([
    countLoggedDays(uid, 7),
    countLoggedDays(uid, 30),
  ]);
  const adherence7d = adherenceRate(logged7, 7);
  const adherence30d = adherenceRate(logged30, 30);
  const reasons = buildRiskReasons(adherence7d, adherence30d);

  for (const reason of reasons) {
    await upsertAlert(uid, reason, {
      severity: "medium",
      message:
        reason === "low_adherence_7d"
          ? "Low logging adherence in the last 7 days."
          : "Low logging adherence in the last 30 days.",
      metadata: { adherence7d, adherence30d },
    });
  }

  return { adherence7d, adherence30d, reasons };
};

const writeReport = async (uid: string, reportType: "weekly" | "monthly") => {
  const now = new Date();
  const periodDays = reportType === "weekly" ? 7 : 30;
  const periodEnd = toDateKey(now);
  const periodStart = toDateKey(new Date(now.getTime() - (periodDays - 1) * DAY_MS));
  const [logged7, logged30, alertsSnap] = await Promise.all([
    countLoggedDays(uid, 7),
    countLoggedDays(uid, 30),
    firestore.collection(`users/${uid}/alerts`).where("status", "==", "open").get(),
  ]);
  const adherence7d = adherenceRate(logged7, 7);
  const adherence30d = adherenceRate(logged30, 30);
  const trendDelta = Number((adherence7d - adherence30d).toFixed(2));
  const reportId = `${reportType}-${periodEnd}`;

  await firestore.doc(`users/${uid}/reports/${reportId}`).set(
    {
      reportType,
      periodStart,
      periodEnd,
      adherence7d,
      adherence30d,
      trendDelta,
      openAlerts: alertsSnap.size,
      keyNotes: [
        `7d adherence ${Math.round(adherence7d * 100)}%`,
        `30d adherence ${Math.round(adherence30d * 100)}%`,
      ],
      generatedAt: now.toISOString(),
    },
    { merge: true }
  );
};

export const ensureUserRoleOnCreate = onDocumentCreated(
  { region: "us-central1", document: "users/{uid}" },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot?.exists) return;

    const data = snapshot.data();
    if (data?.role === ROLE_USER || data?.role === "clinician" || data?.role === "admin") return;

    await snapshot.ref.set({ role: ROLE_USER }, { merge: true });
  }
);

export const ensureUserRoleOnWrite = onDocumentWritten(
  { region: "us-central1", document: "users/{uid}" },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data();
    if (data?.role === ROLE_USER || data?.role === "clinician" || data?.role === "admin") return;
    await after.ref.set({ role: ROLE_USER }, { merge: true });
  }
);

export const backfillUserRoles = onSchedule(
  { region: "us-central1", schedule: "every day 03:00" },
  async () => {
    const usersSnap = await firestore.collection("users").limit(500).get();
    if (usersSnap.empty) return;

    const batch = firestore.batch();
    let updates = 0;

    usersSnap.docs.forEach((entry) => {
      const existingRole = entry.data().role;
      if (existingRole === ROLE_USER || existingRole === "clinician" || existingRole === "admin") return;
      batch.set(entry.ref, { role: ROLE_USER }, { merge: true });
      updates += 1;
    });

    if (updates > 0) {
      await batch.commit();
      console.log(`backfillUserRoles updated ${updates} users`);
    }
  }
);

export const evaluateAlertsOnFoodWrite = onDocumentWritten(
  { region: "us-central1", document: "users/{uid}/foods/{dateKey}" },
  async (event) => {
    const uid = event.params.uid as string | undefined;
    if (!uid) return;

    const userSnap = await firestore.doc(`users/${uid}`).get();
    const linkStatus = userSnap.data()?.clinicianLink?.status;
    if (linkStatus !== "active") return;

    await evaluateAndWriteAlerts(uid);
  }
);

export const scheduledAlertSweep = onSchedule(
  { region: "us-central1", schedule: "every day 05:00" },
  async () => {
    const linkedUsers = await firestore
      .collection("users")
      .where("clinicianLink.status", "==", "active")
      .limit(200)
      .get();

    for (const entry of linkedUsers.docs) {
      await evaluateAndWriteAlerts(entry.id);
    }
  }
);

export const generateWeeklyConsultationReports = onSchedule(
  { region: "us-central1", schedule: "every monday 06:00" },
  async () => {
    const linkedUsers = await firestore
      .collection("users")
      .where("clinicianLink.status", "==", "active")
      .limit(200)
      .get();
    for (const entry of linkedUsers.docs) {
      await writeReport(entry.id, "weekly");
    }
  }
);

export const generateMonthlyConsultationReports = onSchedule(
  { region: "us-central1", schedule: "1 of month 06:15" },
  async () => {
    const linkedUsers = await firestore
      .collection("users")
      .where("clinicianLink.status", "==", "active")
      .limit(200)
      .get();
    for (const entry of linkedUsers.docs) {
      await writeReport(entry.id, "monthly");
    }
  }
);

const writeAuditLog = async (payload: {
  actorUid: string;
  action: string;
  targetUid?: string;
  details?: Record<string, unknown>;
}) => {
  await firestore.collection("auditLogs").add({
    actorUid: payload.actorUid,
    action: payload.action,
    targetUid: payload.targetUid ?? null,
    details: payload.details ?? {},
    createdAt: new Date().toISOString(),
  });
};

export const auditAssignmentChanges = onDocumentWrittenWithAuthContext(
  { region: "us-central1", document: "users/{clinicianUid}/assignedUsers/{userUid}" },
  async (event) => {
    const clinicianUid = event.params.clinicianUid as string;
    const userUid = event.params.userUid as string;
    const actorUid = event.authId || clinicianUid;

    await writeAuditLog({
      actorUid,
      action: "assignment_updated",
      targetUid: userUid,
      details: {
        clinicianUid,
        beforeExists: event.data?.before.exists ?? false,
        afterExists: event.data?.after.exists ?? false,
      },
    });
  }
);

export const auditCarePlanChanges = onDocumentWrittenWithAuthContext(
  { region: "us-central1", document: "users/{uid}/carePlans/{planId}" },
  async (event) => {
    const uid = event.params.uid as string;
    const planId = event.params.planId as string;
    const actorUid = event.authId || "unknown";

    await writeAuditLog({
      actorUid,
      action: "care_plan_updated",
      targetUid: uid,
      details: {
        planId,
        beforeExists: event.data?.before.exists ?? false,
        afterExists: event.data?.after.exists ?? false,
      },
    });
  }
);
