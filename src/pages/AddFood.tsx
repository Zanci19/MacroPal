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
import { auth, db } from "../firebase";
import { doc, setDoc, arrayUnion } from "firebase/firestore";

// === USDA FoodData Central (FDC) ===
// Docs: https://fdc.nal.usda.gov/api-guide
const FDC_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const FDC_API_KEY = "rF58fpY3NUOuHjlhNvE9i7pjNj0q89dgxkQZ0blP"; // <-- as requested

// ---- Minimal types we use ----
type FDCSearchFood = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  dataType?: string; // "Branded" | "Survey (FNDDS)" | "SR Legacy" | "Foundation" | ...
  // Some search results (especially Branded) include label nutrients right away:
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
  // Serving info (often present for Branded, FNDDS):
  servingSize?: number; // numeric value
  servingSizeUnit?: string; // e.g., "g", "mL"
  householdServingFullText?: string; // e.g., "1 container (170g)"
  // Branded foods often include labelNutrients (kcal are "calories")
  labelNutrients?: {
    calories?: { value: number };
    protein?: { value: number };
    fat?: { value: number };
    carbohydrates?: { value: number };
  };
  // Otherwise we can fall back to "foodNutrients"
  foodNutrients?: Array<{
    nutrientName?: string; // e.g., "Energy", "Protein", "Total lipid (fat)", "Carbohydrate, by difference"
    unitName?: string; // e.g., "kcal", "kJ", "g"
    value?: number;
  }>;
};

type MacroSet = { calories: number; carbs: number; protein: number; fat: number };

// ---- Helpers ----
function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}

// Pull macros from either labelNutrients (preferred for branded) or map foodNutrients
function extractMacros(food: FDCFoodDetail | FDCSearchFood): MacroSet {
  // 1) Prefer labelNutrients if present
  const ln: any = (food as any).labelNutrients;
  if (ln) {
    return {
      calories: safeNum(ln.calories?.value, 0),
      carbs: safeNum(ln.carbohydrates?.value, 2),
      protein: safeNum(ln.protein?.value, 2),
      fat: safeNum(ln.fat?.value, 2),
    };
  }

  // 2) Fall back to foodNutrients mapping
  const fns = (food as any).foodNutrients as FDCFoodDetail["foodNutrients"] | undefined;
  let calories = 0,
    carbs = 0,
    protein = 0,
    fat = 0;

  if (Array.isArray(fns)) {
    for (const n of fns) {
      const name = (n.nutrientName || "").toLowerCase();
      const unit = (n.unitName || "").toLowerCase();
      const val = n.value ?? 0;

      if (name.includes("energy") && (unit === "kcal" || unit === "cal")) calories = val;
      if (name.startsWith("protein")) protein = val;
      if (name.includes("carbohydrate")) carbs = val;
      if (name.includes("total lipid") || name.includes("fat")) fat = val;
    }
  }

  return {
    calories: safeNum(calories, 0),
    carbs: safeNum(carbs, 2),
    protein: safeNum(protein, 2),
    fat: safeNum(fat, 2),
  };
}

// Scale macros from "per base" (serving if defined, otherwise per 100g) to quantity
function scaleMacros(base: MacroSet, qty: number): MacroSet {
  return {
    calories: safeNum(base.calories * qty, 0),
    carbs: safeNum(base.carbs * qty, 1),
    protein: safeNum(base.protein * qty, 1),
    fat: safeNum(base.fat * qty, 1),
  };
}

const AddFood: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FDCSearchFood[]>([]);
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snacks">("breakfast");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  // Details modal
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FDCFoodDetail | null>(null);

  // Serving state:
  // - If the item has servingSize, that's the "base". User chooses either:
  //   (A) number of servings, OR (B) grams/mL. We'll let them toggle "by servings" vs "by weight".
  const [useServing, setUseServing] = useState(true);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100); // grams/mL when using weight mode

  // Derived values
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
    // Fall back: many non-branded foods are essentially per 100 g
    return { baseText: "100 g", baseAmount: 100, baseUnit: "g" };
  }, [selectedFood]);

  const activeTotal = useMemo(() => {
    if (!selectedFood) return { calories: 0, carbs: 0, protein: 0, fat: 0 };

    // Case 1: "per serving" base
    const hasServing = typeof selectedFood.servingSize === "number" && !!selectedFood.servingSizeUnit;
    if (useServing && hasServing) {
      return scaleMacros(baseMacros, servingsQty);
    }

    // Case 2: weight-based (assume base macros correspond to either servingSize or 100 g)
    const baseAmount = hasServing ? selectedFood.servingSize! : 100;
    const ratio = weightQty / baseAmount;
    return scaleMacros(baseMacros, ratio);
  }, [selectedFood, baseMacros, useServing, servingsQty, weightQty]);

  // ---- API calls ----
  const foodsSearch = async (q: string, pageNumber = 0) => {
    setLoading(true);
    try {
      // Use GET; supports CORS, returns JSON
      const params = new URLSearchParams({
        api_key: FDC_API_KEY,
        query: q,
        pageNumber: String(pageNumber),
        pageSize: "20",
        // Filter example: include Branded + Survey + SR/FF if you want broader coverage
        dataType: ["Branded", "Survey (FNDDS)", "SR Legacy", "Foundation"].join(","),
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
      // Reset modal controls
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

    // What is one "base"?
    const hasServing = typeof selectedFood.servingSize === "number" && !!selectedFood.servingSizeUnit;
    const baseAmount = hasServing ? selectedFood.servingSize! : 100;
    const baseUnit = hasServing ? selectedFood.servingSizeUnit! : "g";

    // Quantity chosen + how many "bases" is that?
    let quantityDesc: string;
    let factor = 1;
    if (useServing && hasServing) {
      factor = servingsQty;
      quantityDesc = `${servingsQty} × ${servingInfo.baseText}`;
    } else {
      // weight mode
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
        label: servingInfo.baseText, // e.g., "1 container (170g)" OR "100 g"
      },
      selection: {
        mode: useServing && hasServing ? "serving" : "weight",
        note: quantityDesc,
        servingsQty: useServing && hasServing ? servingsQty : null,
        weightQty: !useServing || !hasServing ? weightQty : null,
      },
      perBase, // macros per base (serving or 100 g)
      total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    setOpen(false);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Add Food</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Select Meal</IonLabel>
          <IonSelect value={meal} onIonChange={(e) => setMeal(e.detail.value)}>
            <IonSelectOption value="breakfast">Breakfast</IonSelectOption>
            <IonSelectOption value="lunch">Lunch</IonSelectOption>
            <IonSelectOption value="dinner">Dinner</IonSelectOption>
            <IonSelectOption value="snacks">Snacks</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonInput
            placeholder="Search food..."
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
            // Prefer labelNutrients from search if available for a quick preview
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
                      ? ` · ${preview.calories || 0} kcal · C ${preview.carbs || 0} g · P ${preview.protein || 0} g · F ${preview.fat || 0} g (per label/100g)`
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
                  <IonButton expand="block" onClick={addFoodToMeal}>
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
