import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentWritten, onDocumentWrittenWithAuthContext } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { Response as ExpressResponse } from "express";

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
    const products: Record<string, unknown>[] = Array.isArray(json?.products) ? json.products : [];

    // Lightweight relevance boost (product_name contains the query)
    products.sort((a, b) => {
      const na = (String(a.product_name || "")).toLowerCase();
      const nb = (String(b.product_name || "")).toLowerCase();
      const scoreA = na.includes(qLower) ? 1 : 0;
      const scoreB = nb.includes(qLower) ? 1 : 0;
      return scoreB - scoreA;
    });

    res.set("Content-Type", "application/json");
    setCaching(res);
    return void res.status(200).send(JSON.stringify({ ...json, products }));
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
