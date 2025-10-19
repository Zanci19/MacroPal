import React, { useMemo, useState } from "react";
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
} from "@ionic/react";
import { useLocation, useHistory } from "react-router";
import { auth, db } from "../firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

// === USDA FoodData Central (FDC) ===
const FDC_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const FDC_API_KEY = "rF58fpY3NUOuHjlhNvE9i7pjNj0q89dgxkQZ0blP"; // provided key

// ---- Minimal types we use ----
type FDCSearchFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  labelNutrients?: {
    calories?: { value: number };
    protein?: { value: number };
    fat?: { value: number };
    carbohydrates?: { value: number };
  };
};

type FDCFoodDetail = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string;
  servingSize?: number;
  servingSizeUnit?: string; // "g", "mL", etc.
  householdServingFullText?: string;
  labelNutrients?: {
    calories?: { value: number };
    protein?: { value: number };
    fat?: { value: number };
    carbohydrates?: { value: number };
  };
  // NOTE: on /food/{fdcId}, the quantity is usually "amount";
  // fields can be nested under "nutrient"
  foodNutrients?: Array<{
    amount?: number;           // <-- primary for details
    value?: number;            // fallback (rare)
    unitName?: string;         // sometimes present top-level
    nutrientName?: string;     // sometimes present top-level
    nutrientNumber?: string;   // sometimes present top-level
    nutrient?: {
      number?: string;         // e.g. "1008"
      name?: string;           // e.g. "Energy"
      unitName?: string;       // e.g. "KCAL" | "kJ" | "G"
    };
  }>;
};

type MacroSet = { calories: number; carbs: number; protein: number; fat: number };
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

// ---- Helpers ----
function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}
function kjToKcal(v: number) {
  return v / 4.184;
}
// Shape-agnostic nutrient reader (amount/value + nested names/units)
function readNutrientFields(n: NonNullable<FDCFoodDetail["foodNutrients"]>[number]) {
  const numberStr = (n.nutrientNumber ?? n.nutrient?.number ?? "").toString().trim();
  const nameStr = (n.nutrientName ?? n.nutrient?.name ?? "").toLowerCase();
  const unitStr = (n.unitName ?? n.nutrient?.unitName ?? "").toLowerCase(); // "kcal", "kj", "g"
  const qty = (typeof n.amount === "number" ? n.amount : n.value) ?? 0;
  return { numberStr, nameStr, unitStr, qty };
}
function extractMacros(food: FDCFoodDetail | FDCSearchFood): MacroSet {
  // 1) Prefer labelNutrients (common for Branded)
  const ln: any = (food as any).labelNutrients;
  if (ln) {
    return {
      calories: safeNum(ln.calories?.value, 0),
      carbs: safeNum(ln.carbohydrates?.value, 2),
      protein: safeNum(ln.protein?.value, 2),
      fat: safeNum(ln.fat?.value, 2),
    };
  }
  // 2) Fall back to foodNutrients (details endpoint)
  const fns = (food as any).foodNutrients as FDCFoodDetail["foodNutrients"] | undefined;
  let calories = 0, carbs = 0, protein = 0, fat = 0;
  if (Array.isArray(fns) && fns.length) {
    for (const raw of fns) {
      const { numberStr, nameStr, unitStr, qty } = readNutrientFields(raw);
      if (numberStr === "1008" || nameStr.includes("energy")) {
        calories = unitStr === "kj" ? kjToKcal(qty) : qty;
      } else if (numberStr === "1003" || nameStr.startsWith("protein")) {
        protein = qty;
      } else if (numberStr === "1004" || nameStr.includes("fat")) {
        fat = qty;
      } else if (numberStr === "1005" || nameStr.includes("carbohydrate")) {
        carbs = qty;
      }
    }
    // Extra fallback: if Energy not found above but there is any energy in kJ
    if (!calories) {
      const kjEntry = fns.find((n) => {
        const { nameStr, unitStr, qty } = readNutrientFields(n);
        return nameStr.includes("energy") && unitStr === "kj" && qty != null;
      });
      if (kjEntry) {
        const { qty } = readNutrientFields(kjEntry);
        calories = kjToKcal(qty);
      }
    }
  }
  return {
    calories: safeNum(calories, 0),
    carbs: safeNum(carbs, 2),
    protein: safeNum(protein, 2),
    fat: safeNum(fat, 2),
  };
}
function scaleMacros(base: MacroSet, qty: number): MacroSet {
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
  if (m === "breakfast" || m === "lunch" || m === "dinner" || m === "snacks") return m;
  return "breakfast";
}

const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const meal = useMealFromQuery(location);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FDCSearchFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Details modal
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FDCFoodDetail | null>(null);

  // Serving state
  const [useServing, setUseServing] = useState(true);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100); // grams/mL when using weight mode

  const baseMacros = useMemo(() => extractMacros(selectedFood || ({} as any)), [selectedFood]);

  const servingInfo = useMemo(() => {
    if (!selectedFood) return { baseText: "100 g", baseAmount: 100, baseUnit: "g" };
    const hasServing = typeof selectedFood.servingSize === "number" && !!selectedFood.servingSizeUnit;
    if (hasServing) {
      const txt =
        selectedFood.householdServingFullText ||
        `${selectedFood.servingSize} ${selectedFood.servingSizeUnit}`;
      return {
        baseText: txt,
        baseAmount: selectedFood.servingSize!,
        baseUnit: selectedFood.servingSizeUnit!,
      };
    }
    return { baseText: "100 g", baseAmount: 100, baseUnit: "g" };
  }, [selectedFood]);

  const activeTotal = useMemo(() => {
    if (!selectedFood) return { calories: 0, carbs: 0, protein: 0, fat: 0 };
    const hasServing = typeof selectedFood.servingSize === "number" && !!selectedFood.servingSizeUnit;
    if (useServing && hasServing) {
      return scaleMacros(baseMacros, servingsQty);
    }
    const baseAmount = hasServing ? selectedFood.servingSize! : 100;
    const ratio = weightQty / baseAmount;
    return scaleMacros(baseMacros, ratio);
  }, [selectedFood, baseMacros, useServing, servingsQty, weightQty]);

  // ---- API calls ----
  const foodsSearch = async (q: string, pageNumber = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        api_key: FDC_API_KEY,
        query: q,
        pageNumber: String(pageNumber),
        pageSize: "20",
        // Exclude FNDDS (survey) to avoid micronutrient-only oddities
        dataType: ["Branded", "Foundation", "Survey (FNDDS)", "SR Legacy"].join(","),
      });
      const res = await fetch(`${FDC_API_BASE}/foods/search?${params.toString()}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      const foods: FDCSearchFood[] = Array.isArray(data?.foods) ? data.foods : [];
      setResults(foods);
      setPage(pageNumber);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Error fetching foods");
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodDetails = async (fdcId: number) => {
    try {
      const res = await fetch(`${FDC_API_BASE}/food/${fdcId}?api_key=${FDC_API_KEY}`);
      if (!res.ok) throw new Error(`Details failed: ${res.status}`);
      const data: FDCFoodDetail = await res.json();
      setSelectedFood(data);
      setUseServing(true);
      setServingsQty(1);
      setWeightQty(100);
      setOpen(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Error getting food details");
    }
  };

  const addFoodToMeal = async () => {
    if (!auth.currentUser || !selectedFood) return;

    const hasServing = typeof selectedFood.servingSize === "number" && !!selectedFood.servingSizeUnit;
    const baseAmount = hasServing ? selectedFood.servingSize! : 100;
    const baseUnit = hasServing ? selectedFood.servingSizeUnit! : "g";

    let quantityDesc: string;
    let factor = 1;
    if (useServing && hasServing) {
      factor = servingsQty;
      quantityDesc = `${servingsQty} × ${servingInfo.baseText}`;
    } else {
      factor = weightQty / baseAmount;
      quantityDesc = `${weightQty} ${baseUnit}`;
    }

    const perBase = {
      calories: safeNum(baseMacros.calories, 0),
      carbs: safeNum(baseMacros.carbs, 2),
      protein: safeNum(baseMacros.protein, 2),
      fat: safeNum(baseMacros.fat, 2),
    };

    const total = {
      calories: safeNum(perBase.calories * factor, 0),
      carbs: safeNum(perBase.carbs * factor, 1),
      protein: safeNum(perBase.protein * factor, 1),
      fat: safeNum(perBase.fat * factor, 1),
    };

    const today = new Date().toISOString().split("T")[0];
    const userRef = doc(db, "users", auth.currentUser.uid, "foods", today);

    const item = {
      fdcId: selectedFood.fdcId,
      name: selectedFood.description,
      brand: selectedFood.brandOwner || null,
      dataType: selectedFood.dataType || null,
      base: {
        amount: baseAmount,
        unit: baseUnit,
        label: servingInfo.baseText,
      },
      selection: {
        mode: useServing && hasServing ? "serving" : "weight",
        note: quantityDesc,
        servingsQty: useServing && hasServing ? servingsQty : null,
        weightQty: !useServing || !hasServing ? weightQty : null,
      },
      perBase,
      total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    setOpen(false);
    history.goBack(); // return to Home
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Add Food</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Search */}
        <IonItem>
          <IonInput
            placeholder={`Search food to add to ${meal}...`}
            value={query}
            onIonChange={(e) => setQuery(e.detail.value || "")}
            onKeyUp={(e) => {
              if (e.key === "Enter" && query.trim()) foodsSearch(query.trim(), 0);
            }}
          />
        </IonItem>
        <IonButton expand="full" disabled={!query || loading} onClick={() => foodsSearch(query.trim(), 0)}>
          {loading ? (
            <>
              <IonSpinner name="dots" />&nbsp;Searching...
            </>
          ) : (
            "Search"
          )}
        </IonButton>

        {/* Results */}
        <IonList>
          {results.map((food) => {
            const preview = extractMacros(food);
            const hasPreview = preview.calories || preview.protein || preview.carbs || preview.fat;
            return (
              <IonItem key={food.fdcId} button onClick={() => fetchFoodDetails(food.fdcId)}>
                <IonLabel>
                  <h2>
                    {food.description}
                    {food.brandOwner ? ` · ${food.brandOwner}` : ""}
                  </h2>
                  <p>
                    {food.dataType || "—"}
                    {hasPreview
                      ? ` · ${preview.calories || 0} kcal · C ${preview.carbs || 0} g · P ${preview.protein || 0} g · F ${
                          preview.fat || 0
                        } g (per label/100g)`
                      : ""}
                  </p>
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>

        {/* Simple paging controls */}
        {results.length > 0 && (
          <div className="ion-text-center" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <IonButton size="small" disabled={page <= 0 || loading} onClick={() => foodsSearch(query.trim(), page - 1)}>
              Prev
            </IonButton>
            <IonButton size="small" disabled={loading} onClick={() => foodsSearch(query.trim(), page + 1)}>
              Next
            </IonButton>
          </div>
        )}

        {/* Details + add */}
        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{selectedFood?.description}</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {selectedFood && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <p style={{ margin: 0, opacity: 0.7 }}>
                    {selectedFood.brandOwner ? `${selectedFood.brandOwner} · ` : ""}
                    {selectedFood.dataType || ""}
                  </p>
                  <p style={{ margin: "4px 0 0" }}>
                    Base: <strong>{servingInfo.baseText}</strong>
                  </p>
                  <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                    Adding to: <strong>{meal}</strong>
                  </p>
                </div>

                {/* Toggle: servings vs weight */}
                <IonItem>
                  <IonLabel position="stacked">Input mode</IonLabel>
                  <IonSelect
                    value={useServing ? "serving" : "weight"}
                    onIonChange={(e) => setUseServing(e.detail.value === "serving")}
                  >
                    <IonSelectOption value="serving" disabled={!(selectedFood.servingSize && selectedFood.servingSizeUnit)}>
                      By serving
                    </IonSelectOption>
                    <IonSelectOption value="weight">By weight ({servingInfo.baseUnit})</IonSelectOption>
                  </IonSelect>
                </IonItem>

                {useServing && selectedFood.servingSize && selectedFood.servingSizeUnit ? (
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
                    <IonLabel position="stacked">Amount ({servingInfo.baseUnit})</IonLabel>
                    <IonInput
                      type="number"
                      value={weightQty}
                      min="1"
                      step="1"
                      onIonChange={(e) => setWeightQty(Math.max(1, Number(e.detail.value)))}
                    />
                  </IonItem>
                )}

                {/* Macro preview */}
                <div style={{ marginTop: 16 }}>
                  <h3>Per base ({servingInfo.baseText})</h3>
                  <p>
                    {safeNum(baseMacros.calories, 0)} kcal · C {safeNum(baseMacros.carbs, 2)} g · P {safeNum(baseMacros.protein, 2)} g · F{" "}
                    {safeNum(baseMacros.fat, 2)} g
                  </p>
                  <h3>Total</h3>
                  <p>
                    {safeNum(activeTotal.calories, 0)} kcal · C {safeNum(activeTotal.carbs, 1)} g · P {safeNum(activeTotal.protein, 1)} g · F{" "}
                    {safeNum(activeTotal.fat, 1)} g
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
                      safeNum(baseMacros.calories, 0) === 0 &&
                      safeNum(baseMacros.protein, 2) === 0 &&
                      safeNum(baseMacros.carbs, 2) === 0 &&
                      safeNum(baseMacros.fat, 2) === 0
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
    </IonPage>
  );
};

export default AddFood;
