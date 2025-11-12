import React, { useEffect, useMemo, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonList,
  IonSpinner,
  IonModal,
  IonButtons,
  IonBackButton,
  IonToast,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSegment,
  IonSegmentButton,
  IonGrid,
  IonRow,
  IonCol,
  IonText,
  IonChip,
  IonIcon,
} from "@ionic/react";

import { useLocation, useHistory } from "react-router";
import { auth, db } from "../firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { calendarOutline } from "ionicons/icons";
import { clampDateKeyToToday, formatDateKey, isDateKey, todayDateKey } from "../utils/date";

/** =========================
 *  Open Food Facts via Firebase Functions proxy
 *  ========================= */
const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

/** =========================
 *  Types (subset we use)
 *  ========================= */
type OFFSearchHit = {
  code: string; // EAN-13
  product_name?: string;
  brands?: string;
  serving_size?: string; // e.g., "30 g", "1 biscuit (25 g)"
  image_front_url?: string | null;
  nutriscore_grade?: string | null;
  nutriments?: OFFNutriments;
};

type OFFProduct = OFFSearchHit;

type OFFBarcodeResponse =
  | { status: 1; product: OFFProduct }
  | { status: 0; code: string; status_verbose?: string };

type OFFSearchResponse = {
  products: OFFSearchHit[];
  count?: number;
  page?: number;
  page_size?: number;
};

type OFFNutriments = {
  ["energy-kcal_100g"]?: number;
  ["energy-kcal_serving"]?: number;
  ["proteins_100g"]?: number;
  ["proteins_serving"]?: number;
  ["fat_100g"]?: number;
  ["fat_serving"]?: number;
  ["carbohydrates_100g"]?: number;
  ["carbohydrates_serving"]?: number;
};

type MacroSet = { calories: number; carbs: number; protein: number; fat: number };
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

/** =========================
 *  Helpers
 *  ========================= */
function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}

// Parse serving_size like "30 g", "1 biscuit (25 g)", "200 ml", "1 bar (45 g)"
function parseServingSize(servingSize?: string): { grams?: number; ml?: number; label: string } {
  const label = (servingSize || "").trim();
  if (!label) return { label: "100 g", grams: 100 };
  const m = label.match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (m) {
    const qty = Number(m[1]);
    const unit = m[2].toLowerCase();
    if (unit === "g") return { grams: qty, label };
    if (unit === "ml") return { ml: qty, label };
  }
  return { label, grams: undefined, ml: undefined };
}

function macrosPer100g(nutri?: OFFNutriments): MacroSet {
  return {
    calories: safeNum(nutri?.["energy-kcal_100g"], 0),
    carbs: safeNum(nutri?.["carbohydrates_100g"], 2),
    protein: safeNum(nutri?.["proteins_100g"], 2),
    fat: safeNum(nutri?.["fat_100g"], 2),
  };
}

function macrosPerServing(nutri?: OFFNutriments): MacroSet {
  return {
    calories: safeNum(nutri?.["energy-kcal_serving"], 0),
    carbs: safeNum(nutri?.["carbohydrates_serving"], 2),
    protein: safeNum(nutri?.["proteins_serving"], 2),
    fat: safeNum(nutri?.["fat_serving"], 2),
  };
}

function scale(base: MacroSet, qty: number): MacroSet {
  return {
    calories: safeNum(base.calories * qty, 0),
    carbs: safeNum(base.carbs * qty, 1),
    protein: safeNum(base.protein * qty, 1),
    fat: safeNum(base.fat * qty, 1),
  };
}

function useMealFromQuery(location: ReturnType<typeof useLocation>): MealKey {
  const params = new URLSearchParams(location.search);
  const m = (params.get("meal") || "breakfast").toLowerCase();
  return (["breakfast", "lunch", "dinner", "snacks"] as MealKey[]).includes(m as MealKey)
    ? (m as MealKey)
    : "breakfast";
}

function useDateFromQuery(location: ReturnType<typeof useLocation>): string {
  const params = new URLSearchParams(location.search);
  const d = params.get("date");
  if (isDateKey(d)) {
    return clampDateKeyToToday(d!);
  }
  return todayDateKey();
}

/** =========================
 *  Component
 *  ========================= */
const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Details modal
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<OFFProduct | null>(null);

  // Input mode + quantities
  // Start in weight mode; we’ll flip to serving later if data exists.
  const [useServing, setUseServing] = useState<boolean>(false);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100);

  const [toast, setToast] = React.useState<{ show: boolean; message: string; color?: string }>(
    { show: false, message: "", color: "success" }
  );

  // Derived numerics
  const per100g = useMemo(() => macrosPer100g(selectedFood?.nutriments), [selectedFood]);
  const perServing = useMemo(() => macrosPerServing(selectedFood?.nutriments), [selectedFood]);
  const parsedServing = useMemo(() => parseServingSize(selectedFood?.serving_size), [selectedFood]);
  const friendlyDate = useMemo(
    () => formatDateKey(dateKey, { weekday: "short", month: "short", day: "numeric" }),
    [dateKey]
  );

  const hasServingMacros = useMemo(
    () => !!(perServing.calories || perServing.carbs || perServing.protein || perServing.fat),
    [perServing]
  );
  const has100gMacros = useMemo(
    () => !!(per100g.calories || per100g.carbs || per100g.protein || per100g.fat),
    [per100g]
  );

  // Handle coming from ScanBarcode
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const q = params.get("q");
    const found = params.get("found");

    const cleanUrl = () => {
      params.delete("code");
      params.delete("q");
      params.delete("found");
      history.replace({ pathname: "/add-food", search: params.toString() ? `?${params}` : "" });
    };

    (async () => {
      if (code) {
        try {
          // ✅ FIXED URL (and removed stray space)
          const r = await fetch(`${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`);
          if (r.ok) {
            const data: OFFBarcodeResponse = await r.json();
            if ("status" in data && data.status === 1) {
              setToast({ show: true, message: "Item found", color: "success" });

              const p = data.product;
              const ps = macrosPerServing(p.nutriments);
              const canServing = !!p.serving_size && !!(ps.calories || ps.carbs || ps.protein || ps.fat);

              setSelectedFood(p);
              setUseServing(canServing);   // start on Serving only if it’s valid
              setServingsQty(1);
              setWeightQty(100);
              setOpen(true);
            } else {
              setToast({ show: true, message: "Item not found — showing search.", color: "danger" });
              setQuery(code);
              await foodsSearch(code, 1);
            }
          } else {
            setToast({ show: true, message: "Lookup failed — showing search.", color: "danger" });
            setQuery(code);
            await foodsSearch(code, 1);
          }
        } catch (e: any) {
          console.error(e);
          setToast({ show: true, message: "Error — showing search.", color: "danger" });
          setQuery(code);
          await foodsSearch(code, 1);
        } finally {
          cleanUrl();
        }
        return;
      }

      if (q) {
        setQuery(q);
        const count = await foodsSearch(q, 1);
        setToast({
          show: true,
          message: count > 0 ? "Item found!" : "Item not found — try refining search.",
          color: count > 0 ? "success" : "danger",
        });
        cleanUrl();
        return;
      }

      if (found) {
        cleanUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);


  /** =========================
   *  API calls
   *  ========================= */
  const foodsSearch = async (q: string, pageNumber = 1): Promise<number> => {
    if (!q.trim()) return 0;
    setLoading(true);
    try {
      const url = new URL(`${FN_BASE}/offSearch`);
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(pageNumber));
      url.searchParams.set("page_size", "20");

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data: OFFSearchResponse = await res.json();
      const foods = Array.isArray(data?.products) ? data.products : [];
      setResults(foods);
      setPage(pageNumber);
      return foods.length;
    } catch (e: any) {
      console.error(e);
      setToast({ show: true, message: e?.message ?? "Error fetching foods", color: "danger" });
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodDetailsByCode = async (code: string) => {
    try {
      const r = await fetch(`${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`);
      if (!r.ok) throw new Error(`Details failed: ${r.status}`);
      const data: OFFBarcodeResponse = await r.json();
      if ("status" in data && data.status === 1) {
        const p = data.product;
        const ps = macrosPerServing(p.nutriments);
        const canServing = !!p.serving_size && !!(ps.calories || ps.carbs || ps.protein || ps.fat);
        setSelectedFood(p);
        setUseServing(canServing);
        setServingsQty(1);
        setWeightQty(100);
        setOpen(true);
        return;
      }


      throw new Error("Not found");
    } catch (e: any) {
      console.error(e);
      setToast({ show: true, message: e?.message ?? "Error getting food details", color: "danger" });
    }
  };

  /** =========================
   *  Add — mode-aware base, factor, and labels
   *  ========================= */
  const addFoodToMeal = async () => {
    if (!auth.currentUser || !selectedFood) return;

    const useServingMode = useServing && selectedFood.serving_size && hasServingMacros;

    const perBase: MacroSet = useServingMode ? perServing : per100g;
    const baseLabel = useServingMode
      ? (parsedServing.label || selectedFood.serving_size || "1 serving")
      : "100 g";
    const baseMeta =
      useServingMode && (parsedServing.grams || parsedServing.ml)
        ? {
            amount: parsedServing.grams ?? parsedServing.ml ?? 0,
            unit: parsedServing.grams ? "g" : "ml",
            label: baseLabel,
          }
        : { amount: 100, unit: "g", label: "100 g" };

    let factor = 1;
    let quantityDesc = "";
    if (useServingMode) {
      factor = Math.max(0.1, servingsQty);
      quantityDesc = `${factor} × ${baseLabel}`;
    } else {
      const grams = Math.max(1, weightQty);
      factor = grams / 100;
      quantityDesc = `${grams} g`;
    }

    const total = scale(perBase, factor);

    const userRef = doc(db, "users", auth.currentUser.uid, "foods", dateKey);

    const item = {
      code: selectedFood.code,
      name: selectedFood.product_name || "(no name)",
      brand: selectedFood.brands || null,
      dataSource: "openfoodfacts",
      base: baseMeta,
      selection: {
        mode: useServingMode ? "serving" : "weight",
        note: quantityDesc,
        servingsQty: useServingMode ? factor : null,
        weightQty: useServingMode ? null : Math.round(factor * 100),
      },
      perBase: {
        calories: safeNum(perBase.calories, 0),
        carbs: safeNum(perBase.carbs, 2),
        protein: safeNum(perBase.protein, 2),
        fat: safeNum(perBase.fat, 2),
      },
      total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    setOpen(false);
    history.replace(`/app/home?date=${dateKey}`);
  };

  /** =========================
   *  Active totals for the modal (live preview)
   *  ========================= */
  const previewPerBaseLabel = useMemo(() => {
    if (!selectedFood) return "100 g";
    const useServingMode = useServing && selectedFood.serving_size && hasServingMacros;
    return useServingMode ? (parsedServing.label || selectedFood.serving_size || "1 serving") : "100 g";
  }, [selectedFood, useServing, hasServingMacros, parsedServing.label]);

  const previewPerBaseMacros = useMemo<MacroSet>(() => {
    const useServingMode = useServing && selectedFood?.serving_size && hasServingMacros;
    return useServingMode ? perServing : per100g;
  }, [useServing, selectedFood, hasServingMacros, perServing, per100g]);

  const previewTotal = useMemo(() => {
    const useServingMode = useServing && selectedFood?.serving_size && hasServingMacros;
    if (useServingMode) {
      return scale(previewPerBaseMacros, Math.max(0.1, servingsQty));
    }
    return scale(previewPerBaseMacros, Math.max(1, weightQty) / 100);
  }, [useServing, selectedFood, hasServingMacros, previewPerBaseMacros, servingsQty, weightQty]);

  /** =========================
   *  Render
   *  ========================= */
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/app/home?date=${dateKey}`} />
          </IonButtons>
          <IonTitle>Add Food</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonChip color="primary" style={{ marginBottom: 12 }}>
          <IonIcon icon={calendarOutline} />
          <span style={{ marginLeft: 6 }}>
            {friendlyDate} · {meal}
          </span>
        </IonChip>

        {/* Search input */}
        <IonItem>
          <IonInput
            placeholder={`Search food to add to ${meal}...`}
            value={query}
            onIonChange={(e) => setQuery(e.detail.value || "")}
            onKeyUp={(e) => {
              if (e.key === "Enter" && query.trim()) foodsSearch(query.trim(), 1);
            }}
          />
        </IonItem>

        {/* Buttons: Search + Barcode */}
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <IonButton
            expand="block"
            disabled={!query || loading}
            onClick={() => foodsSearch(query.trim(), 1)}
          >
            {loading ? (
              <>
                <IonSpinner name="dots" />
                &nbsp;Searching…
              </>
            ) : (
              "Search"
            )}
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            onClick={() => history.push(`/scan-barcode?meal=${meal}&date=${dateKey}`)}
          >
            Barcode scanner
          </IonButton>
        </div>

        {/* Results */}
        <IonList style={{ marginTop: 8 }}>
          {results.map((food) => {
            const preview = macrosPer100g(food.nutriments);
            const hasPreview = preview.calories || preview.protein || preview.carbs || preview.fat;
            return (
              <IonItem key={`${food.code}-${food.product_name || ""}`} button onClick={() => fetchFoodDetailsByCode(food.code)}>
                <IonLabel>
                  <h2>
                    {food.product_name || "(no name)"}{food.brands ? ` · ${food.brands}` : ""}
                  </h2>
                  <p>
                    {(food.serving_size ? `Serving: ${food.serving_size} · ` : "") +
                      (hasPreview
                        ? `${preview.calories || 0} kcal/100g · C ${preview.carbs || 0} g · P ${preview.protein || 0} g · F ${preview.fat || 0} g`
                        : "—")}
                  </p>
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>

        {/* Paging */}
        {results.length > 0 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <IonButton
              size="small"
              disabled={page <= 1 || loading}
              onClick={() => foodsSearch(query.trim(), page - 1)}
            >
              Prev
            </IonButton>
            <IonButton
              size="small"
              disabled={loading}
              onClick={() => foodsSearch(query.trim(), page + 1)}
            >
              Next
            </IonButton>
          </div>
        )}

        {/* Details modal — REDESIGNED */}
        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedFood?.product_name || "(no name)"}</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {selectedFood && (
              <>
                {/* Subheader */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, opacity: 0.7 }}>
                    {selectedFood.brands ? `${selectedFood.brands}` : ""}
                    {selectedFood.brands && selectedFood.nutriscore_grade ? " · " : ""}
                    {selectedFood.nutriscore_grade ? `Nutri-Score ${selectedFood.nutriscore_grade.toUpperCase()}` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                    Adding to: <strong>{meal}</strong> · {friendlyDate}
                  </p>
                </div>

                {/* Mode toggle */}
                <IonSegment
                  value={useServing ? "serving" : "weight"}
                  onIonChange={(e) => setUseServing(e.detail.value === "serving")}
                >
                  <IonSegmentButton value="serving" disabled={!selectedFood.serving_size || !hasServingMacros}>
                    <IonLabel>Serving</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="weight" disabled={!has100gMacros}>
                    <IonLabel>Weight</IonLabel>
                  </IonSegmentButton>
                </IonSegment>

                {/* Quantity steppers */}
                {useServing && selectedFood.serving_size && hasServingMacros ? (
                  <IonCard style={{ marginTop: 12 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: 16 }}>
                        Quantity · <span style={{ opacity: 0.7 }}>{previewPerBaseLabel}</span>
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
                        <IonButton
                          fill="outline"
                          onClick={() => setServingsQty((v) => Math.max(0.1, safeNum(v - 0.5, 1)))}
                        >
                          −
                        </IonButton>
                        <IonInput
                          type="number"
                          inputmode="decimal"
                          value={servingsQty}
                          min="0.1"
                          step="0.1"
                          onIonChange={(e) => setServingsQty(Math.max(0.1, Number(e.detail.value)))}
                          style={{ textAlign: "center" }}
                        />
                        <IonButton
                          fill="outline"
                          onClick={() => setServingsQty((v) => safeNum(v + 0.5, 1))}
                        >
                          +
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ) : (
                  <IonCard style={{ marginTop: 12 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: 16 }}>Amount · <span style={{ opacity: 0.7 }}>grams</span></IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center" }}>
                        <IonButton
                          fill="outline"
                          onClick={() => setWeightQty((v) => Math.max(1, v - 10))}
                        >
                          −10
                        </IonButton>
                        <IonInput
                          type="number"
                          inputmode="numeric"
                          value={weightQty}
                          min="1"
                          step="1"
                          onIonChange={(e) => setWeightQty(Math.max(1, Number(e.detail.value)))}
                          style={{ textAlign: "center" }}
                        />
                        <IonButton
                          fill="outline"
                          onClick={() => setWeightQty((v) => v + 10)}
                        >
                          +10
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                )}

                {/* Totals card — single, clean summary */}
                <IonCard style={{ marginTop: 8 }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span>Nutrition total</span>
                      <IonText color="medium" style={{ fontSize: 12 }}>
                        {useServing
                          ? `${safeNum(servingsQty, 1)} × ${previewPerBaseLabel}`
                          : `${Math.max(1, weightQty)} g (base: ${previewPerBaseLabel})`}
                      </IonText>
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div style={{ textAlign: "center", marginBottom: 8 }}>
                      <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>
                        {safeNum(previewTotal.calories, 0)} kcal
                      </div>
                    </div>

                    <IonGrid>
                      <IonRow>
                        <IonCol className="ion-text-center">
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Carbs</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {safeNum(previewTotal.carbs, 1)} g
                          </div>
                        </IonCol>
                        <IonCol className="ion-text-center">
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Protein</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {safeNum(previewTotal.protein, 1)} g
                          </div>
                        </IonCol>
                        <IonCol className="ion-text-center">
                          <div style={{ fontSize: 12, opacity: 0.7 }}>Fat</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {safeNum(previewTotal.fat, 1)} g
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  </IonCardContent>
                </IonCard>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <IonButton expand="block" onClick={() => setOpen(false)} fill="outline">
                    Cancel
                  </IonButton>
                  <IonButton
                    expand="block"
                    onClick={addFoodToMeal}
                    disabled={
                      safeNum(previewPerBaseMacros.calories, 0) === 0 &&
                      safeNum(previewPerBaseMacros.protein, 2) === 0 &&
                      safeNum(previewPerBaseMacros.carbs, 2) === 0 &&
                      safeNum(previewPerBaseMacros.fat, 2) === 0
                    }
                  >
                    Add to {meal}
                  </IonButton>
                </div>
              </>
            )}
          </IonContent>
        </IonModal>
      </IonContent>

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2000}
        onDidDismiss={() => setToast({ ...toast, show: false })}
      />
    </IonPage>
  );
};

export default AddFood;
