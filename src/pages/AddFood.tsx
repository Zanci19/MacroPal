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
} from "@ionic/react";

import { useLocation, useHistory } from "react-router";
import { auth, db } from "../firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";
import { Macros, MealKey } from "../types/nutrition";

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

function macrosPer100g(nutri?: OFFNutriments): Macros {
  return {
    calories: safeNum(nutri?.["energy-kcal_100g"], 0),
    carbs: safeNum(nutri?.["carbohydrates_100g"], 2),
    protein: safeNum(nutri?.["proteins_100g"], 2),
    fat: safeNum(nutri?.["fat_100g"], 2),
  };
}

function macrosPerServing(nutri?: OFFNutriments): Macros {
  return {
    calories: safeNum(nutri?.["energy-kcal_serving"], 0),
    carbs: safeNum(nutri?.["carbohydrates_serving"], 2),
    protein: safeNum(nutri?.["proteins_serving"], 2),
    fat: safeNum(nutri?.["fat_serving"], 2),
  };
}

function scale(base: Macros, qty: number): Macros {
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

/** =========================
 *  Component
 *  ========================= */
const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const meal = useMealFromQuery(location);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Details modal
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<OFFProduct | null>(null);

  // Input mode + quantities
  const [useServing, setUseServing] = useState(true);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100);

  const [toast, setToast] = React.useState<{ show: boolean; message: string; color?: string }>(
    { show: false, message: "", color: "success" }
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
          const r = await fetch(`${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`);
          if (r.ok) {
            const data: OFFBarcodeResponse = await r.json();
            if ("status" in data && data.status === 1) {
              setToast({ show: true, message: "Item found", color: "success" });
              setSelectedFood(data.product);
              setUseServing(true);
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
      } else if (q) {
        setQuery(q);
        const count = await foodsSearch(q, 1);
        setToast({
          show: true,
          message: count > 0 ? "Item found!" : "Item not found — try refining search.",
          color: count > 0 ? "success" : "danger",
        });
        cleanUrl();
      } else if (found) {
        cleanUrl();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Derived numerics
  const per100g = useMemo(() => macrosPer100g(selectedFood?.nutriments), [selectedFood]);
  const perServing = useMemo(() => macrosPerServing(selectedFood?.nutriments), [selectedFood]);
  const parsedServing = useMemo(() => parseServingSize(selectedFood?.serving_size), [selectedFood]);

  const hasServingMacros = useMemo(
    () => !!(perServing.calories || perServing.carbs || perServing.protein || perServing.fat),
    [perServing]
  );
  const has100gMacros = useMemo(
    () => !!(per100g.calories || per100g.carbs || per100g.protein || per100g.fat),
    [per100g]
  );

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
        setSelectedFood(data.product);
        setUseServing(true);
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

    // Decide mode and base
    const useServingMode = useServing && selectedFood.serving_size && hasServingMacros;

    // Base macros + label + meta depend on mode
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

    // Factor + UI note
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

    // Totals
    const total = scale(perBase, factor);

    // Build the item
    const today = new Date().toISOString().split("T")[0];
    const userRef = doc(db, "users", auth.currentUser.uid, "foods", today);

    const item = {
      code: selectedFood.code,
      name: selectedFood.product_name || "(no name)",
      brand: selectedFood.brands || null,
      dataSource: "openfoodfacts",
      base: baseMeta, // ← reflects the chosen mode
      selection: {
        mode: useServingMode ? "serving" : "weight",
        note: quantityDesc,
        servingsQty: useServingMode ? factor : null,
        weightQty: useServingMode ? null : Math.round(factor * 100), // grams actually entered
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
    history.replace("/app/home");
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
            <IonBackButton defaultHref="/app/home" />
          </IonButtons>
          <IonTitle>Add Food</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
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
            onClick={() => history.push(`/scan-barcode?meal=${meal}`)}
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

        {/* Details modal */}
        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedFood?.product_name || "(no name)"}</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {selectedFood && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, opacity: 0.7 }}>
                    {selectedFood.brands ? `${selectedFood.brands}` : ""}
                    {selectedFood.brands && selectedFood.nutriscore_grade ? " · " : ""}
                    {selectedFood.nutriscore_grade ? `Nutri-Score ${selectedFood.nutriscore_grade.toUpperCase()}` : ""}
                  </p>
                  <p style={{ margin: "4px 0 0" }}>
                    Base: <strong>{previewPerBaseLabel}</strong>
                  </p>
                  <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                    Adding to: <strong>{meal}</strong>
                  </p>
                </div>

                <IonItem>
                  <IonLabel position="stacked">Input mode</IonLabel>
                  <IonSelect
                    value={useServing ? "serving" : "weight"}
                    onIonChange={(e) => setUseServing(e.detail.value === "serving")}
                  >
                    <IonSelectOption
                      value="serving"
                      disabled={!selectedFood.serving_size || !hasServingMacros}
                    >
                      By serving
                    </IonSelectOption>
                    <IonSelectOption value="weight">By weight (g)</IonSelectOption>
                  </IonSelect>
                </IonItem>

                {useServing && selectedFood.serving_size && hasServingMacros ? (
                  <IonItem>
                    <IonLabel position="stacked">Servings</IonLabel>
                    <IonInput
                      type="number"
                      value={servingsQty}
                      min="0.1"
                      step="0.1"
                      onIonChange={(e) => setServingsQty(Math.max(0.1, Number(e.detail.value)))}
                    />
                  </IonItem>
                ) : (
                  <IonItem>
                    <IonLabel position="stacked">Amount (g)</IonLabel>
                    <IonInput
                      type="number"
                      value={weightQty}
                      min="1"
                      step="1"
                      onIonChange={(e) => setWeightQty(Math.max(1, Number(e.detail.value)))}
                    />
                  </IonItem>
                )}

                <div style={{ marginTop: 16 }}>
                  <h3>Per base ({previewPerBaseLabel})</h3>
                  <p>
                    {safeNum(previewPerBaseMacros.calories, 0)} kcal · C {safeNum(previewPerBaseMacros.carbs, 2)} g · P {safeNum(previewPerBaseMacros.protein, 2)} g · F{" "}
                    {safeNum(previewPerBaseMacros.fat, 2)} g
                  </p>
                  <h3>Total</h3>
                  <p>
                    {safeNum(previewTotal.calories, 0)} kcal · C {safeNum(previewTotal.carbs, 1)} g · P {safeNum(previewTotal.protein, 1)} g · F{" "}
                    {safeNum(previewTotal.fat, 1)} g
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
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
