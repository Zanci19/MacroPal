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
  IonAlert,
} from "@ionic/react";

import { useLocation, useHistory } from "react-router";
import { auth, db } from "../firebase";
import {
  doc,
  setDoc,
  arrayUnion,
  collection,
  onSnapshot,
  deleteDoc,
  query as fsQuery,
  orderBy,
  limit,
  increment,
  getDoc,
} from "firebase/firestore";


import { calendarOutline, starOutline, trashOutline } from "ionicons/icons";
import {
  clampDateKeyToToday,
  formatDateKey,
  isDateKey,
  todayDateKey,
  shiftDateKey,
} from "../utils/date";

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

type OFFSearchHit = {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
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

type MacroSet = { calories: number; carbs: number; protein: number; fat: number };
type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

type FavoriteFood = {
  id: string;
  name: string;
  brand?: string | null;
  base?: { amount: number; unit: string; label: string };
  selection: {
    mode: "serving" | "weight";
    note: string;
    servingsQty: number | null;
    weightQty: number | null;
  };
  perBase: MacroSet;
  total: MacroSet;
  dataSource?: string;
  code?: string;
  createdAt: string;
};

type RecentFood = {
  id: string;
  name: string;
  brand?: string | null;
  code?: string | null;
  lastUsedAt: string;
  timesUsed?: number;
};

type DiaryEntryDoc = {
  name?: string;
  brand?: string | null;
  base?: { amount: number; unit: string; label: string };
  selection?: {
    mode?: "serving" | "weight";
    note?: string;
    servingsQty?: number | null;
    weightQty?: number | null;
  };
  perBase?: MacroSet;
  total?: MacroSet;
  dataSource?: string;
  code?: string;
  addedAt?: string;
  [k: string]: any;
};

type DayDoc = Partial<Record<MealKey, DiaryEntryDoc[]>>;

type CustomMealPreset = {
  id: string;
  name: string;
  total: MacroSet;
  createdAt: string;
  note?: string;
};

const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}

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

const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [tab, setTab] = useState<"search" | "favorites">("search");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<OFFProduct | null>(null);

  const [useServing, setUseServing] = useState<boolean>(false);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100);

  const [recent, setRecent] = useState<RecentFood[]>([]);

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteToDelete, setFavoriteToDelete] = useState<FavoriteFood | null>(null);

  const [recentFoods, setRecentFoods] = useState<DiaryEntryDoc[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [mealPresets, setMealPresets] = useState<CustomMealPreset[]>([]);
  const [mealPresetsLoading, setMealPresetsLoading] = useState(false);

  const [showCreateCustomFood, setShowCreateCustomFood] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customCarbs, setCustomCarbs] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [customFat, setCustomFat] = useState("");

  const [showCreateMealPreset, setShowCreateMealPreset] = useState(false);
  const [mealPresetName, setMealPresetName] = useState("");
  const [mealPresetNote, setMealPresetNote] = useState("");
  const [mealPresetCalories, setMealPresetCalories] = useState("");
  const [mealPresetCarbs, setMealPresetCarbs] = useState("");
  const [mealPresetProtein, setMealPresetProtein] = useState("");
  const [mealPresetFat, setMealPresetFat] = useState("");

  const per100g = useMemo(() => macrosPer100g(selectedFood?.nutriments), [selectedFood]);
  const perServing = useMemo(
    () => macrosPerServing(selectedFood?.nutriments),
    [selectedFood]
  );
  const parsedServing = useMemo(
    () => parseServingSize(selectedFood?.serving_size),
    [selectedFood]
  );
  const friendlyDate = useMemo(
    () =>
      formatDateKey(dateKey, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [dateKey]
  );

  const hasServingMacros = useMemo(
    () =>
      !!(
        perServing.calories ||
        perServing.carbs ||
        perServing.protein ||
        perServing.fat
      ),
    [perServing]
  );
  const has100gMacros = useMemo(
    () =>
      !!(per100g.calories || per100g.carbs || per100g.protein || per100g.fat),
    [per100g]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const q = params.get("q");
    const found = params.get("found");

    const cleanUrl = () => {
      params.delete("code");
      params.delete("q");
      params.delete("found");
      history.replace({
        pathname: "/add-food",
        search: params.toString() ? `?${params}` : "",
      });
    };

    (async () => {
      if (code) {
        try {
          const r = await fetch(
            `${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`
          );
          if (r.ok) {
            const data: OFFBarcodeResponse = await r.json();
            if ("status" in data && data.status === 1) {
              setToast({ show: true, message: "Item found", color: "success" });

              const p = data.product;
              const ps = macrosPerServing(p.nutriments);
              const canServing =
                !!p.serving_size &&
                !!(ps.calories || ps.carbs || ps.protein || ps.fat);

              setSelectedFood(p);
              setUseServing(canServing);
              setServingsQty(1);
              setWeightQty(100);
              setOpen(true);
            } else {
              setToast({
                show: true,
                message: "Item not found — showing search.",
                color: "danger",
              });
              setQuery(code);
              await foodsSearch(code, 1);
            }
          } else {
            setToast({
              show: true,
              message: "Lookup failed — showing search.",
              color: "danger",
            });
            setQuery(code);
            await foodsSearch(code, 1);
          }
        } catch (e: any) {
          console.error(e);
          setToast({
            show: true,
            message: "Error — showing search.",
            color: "danger",
          });
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
          message:
            count > 0
              ? "Item found!"
              : "Item not found — try refining search.",
          color: count > 0 ? "success" : "danger",
        });
        cleanUrl();
        return;
      }

      if (found) {
        cleanUrl();
      }
    })();
  }, [location.search, history]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    setFavoritesLoading(true);
    const ref = collection(db, "users", user.uid, "favorites");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: FavoriteFood[] = snap.docs.map((d) => {
          const data = d.data() as Omit<FavoriteFood, "id">;
          return { id: d.id, ...data };
        });
        setFavorites(list);
        setFavoritesLoading(false);
      },
      (err) => {
        console.error(err);
        setFavoritesLoading(false);
        setToast({
          show: true,
          message: "Error loading favorites",
          color: "danger",
        });
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = collection(db, "users", user.uid, "recentFoods");
    const q = fsQuery(ref, orderBy("lastUsedAt", "desc"), limit(20));

    const unsub = onSnapshot(q, (snap) => {
      const list: RecentFood[] = snap.docs.map((d) => {
        const data = d.data() as Omit<RecentFood, "id">;
        return { id: d.id, ...data };
      });
      setRecent(list);
    });

    return () => unsub();
  }, []);


  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    let cancelled = false;

    const loadRecent = async () => {
      try {
        setRecentLoading(true);
        const uid = user.uid;
        const today = todayDateKey();
        const collected: DiaryEntryDoc[] = [];

        for (let i = 0; i < 14; i++) {
          const key = shiftDateKey(today, -i);
          const snap = await getDoc(doc(db, "users", uid, "foods", key));
          if (!snap.exists()) continue;
          const data = snap.data() as DayDoc;
          (["breakfast", "lunch", "dinner", "snacks"] as MealKey[]).forEach(
            (mealKey) => {
              const arr = data[mealKey] || [];
              arr.forEach((item) => {
                if (item && item.total) {
                  collected.push(item);
                }
              });
            }
          );
        }

        collected.sort((a, b) =>
          (b.addedAt || "").localeCompare(a.addedAt || "")
        );

        const seen = new Set<string>();
        const unique: DiaryEntryDoc[] = [];
        for (const it of collected) {
          const key = `${(it.name || "").toLowerCase()}|${(
            it.brand || ""
          ).toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(it);
          if (unique.length >= 10) break;
        }

        if (!cancelled) setRecentFoods(unique);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    };

    loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    setMealPresetsLoading(true);
    const ref = collection(db, "users", user.uid, "mealPresets");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const list: CustomMealPreset[] = snap.docs.map((d) => {
          const data = d.data() as Omit<CustomMealPreset, "id">;
          return { id: d.id, ...data };
        });
        setMealPresets(list);
        setMealPresetsLoading(false);
      },
      (err) => {
        console.error(err);
        setMealPresetsLoading(false);
        setToast({
          show: true,
          message: "Error loading custom meals",
          color: "danger",
        });
      }
    );
    return () => unsub();
  }, []);

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
      setToast({
        show: true,
        message: e?.message ?? "Error fetching foods",
        color: "danger",
      });
      return 0;
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodDetailsByCode = async (code: string) => {
    try {
      const r = await fetch(
        `${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`
      );
      if (!r.ok) throw new Error(`Details failed: ${r.status}`);
      const data: OFFBarcodeResponse = await r.json();
      if ("status" in data && data.status === 1) {
        const p = data.product;
        const ps = macrosPerServing(p.nutriments);
        const canServing =
          !!p.serving_size &&
          !!(ps.calories || ps.carbs || ps.protein || ps.fat);
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
      setToast({
        show: true,
        message: e?.message ?? "Error getting food details",
        color: "danger",
      });
    }
  };

  const computeCurrentSelection = () => {
    if (!selectedFood) return null;

    const useServingMode =
      useServing && selectedFood.serving_size && hasServingMacros;

    const perBase: MacroSet = useServingMode ? perServing : per100g;

    const baseLabel = useServingMode
      ? parsedServing.label || selectedFood.serving_size || "1 serving"
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
    let servingsQtyForSel: number | null = null;
    let weightQtyForSel: number | null = null;

    if (useServingMode) {
      const qty = Math.max(0.1, servingsQty);
      factor = qty;
      quantityDesc = `${qty} × ${baseLabel}`;
      servingsQtyForSel = qty;
      weightQtyForSel = null;
    } else {
      const grams = Math.max(1, weightQty);
      factor = grams / 100;
      quantityDesc = `${grams} g`;
      servingsQtyForSel = null;
      weightQtyForSel = grams;
    }

    const total = scale(perBase, factor);

    return {
      useServingMode,
      perBase,
      baseMeta,
      quantityDesc,
      total,
      servingsQtyForSel,
      weightQtyForSel,
    };
  };

  const addFoodToMeal = async () => {
    if (!auth.currentUser || !selectedFood) return;

    const payload = computeCurrentSelection();
    if (!payload) return;

    const {
      useServingMode,
      perBase,
      baseMeta,
      quantityDesc,
      total,
      servingsQtyForSel,
      weightQtyForSel,
    } = payload;

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
        servingsQty: useServingMode ? servingsQtyForSel : null,
        weightQty: useServingMode ? null : weightQtyForSel,
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
    await upsertRecentFood({
      name: item.name,
      brand: item.brand,
      code: item.code,
    });
    setOpen(false);
    history.replace(`/app/home?date=${dateKey}`);
  };

  const saveCurrentSelectionAsFavorite = async () => {
    const user = auth.currentUser;
    if (!user || !selectedFood) return;

    const payload = computeCurrentSelection();
    if (!payload) return;

    const {
      useServingMode,
      perBase,
      baseMeta,
      quantityDesc,
      total,
      servingsQtyForSel,
      weightQtyForSel,
    } = payload;

    try {
      const colRef = collection(db, "users", user.uid, "favorites");
      const favDoc = doc(colRef);

      const favData: Omit<FavoriteFood, "id"> = {
        name: selectedFood.product_name || "(no name)",
        brand: selectedFood.brands || null,
        base: baseMeta,
        selection: {
          mode: useServingMode ? "serving" : "weight",
          note: quantityDesc,
          servingsQty: useServingMode ? servingsQtyForSel : null,
          weightQty: useServingMode ? null : weightQtyForSel,
        },
        perBase: {
          calories: safeNum(perBase.calories, 0),
          carbs: safeNum(perBase.carbs, 2),
          protein: safeNum(perBase.protein, 2),
          fat: safeNum(perBase.fat, 2),
        },
        total,
        dataSource: "openfoodfacts",
        code: selectedFood.code,
        createdAt: new Date().toISOString(),
      };

      await setDoc(favDoc, favData);
      setToast({
        show: true,
        message: "Saved to favorites",
        color: "success",
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save favorite",
        color: "danger",
      });
    }
  };

  const createCustomFood = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const name = customName.trim() || "(no name)";
    const brand = customBrand.trim() || null;
    const calories = safeNum(parseFloat(customCalories || "0"), 0);
    const carbs = safeNum(parseFloat(customCarbs || "0"), 1);
    const protein = safeNum(parseFloat(customProtein || "0"), 1);
    const fat = safeNum(parseFloat(customFat || "0"), 1);

    const perBase: MacroSet = { calories, carbs, protein, fat };
    const baseMeta = { amount: 100, unit: "g", label: "100 g" };
    const selection = {
      mode: "weight" as const,
      note: "100 g",
      servingsQty: null,
      weightQty: 100,
    };
    const total = perBase;

    try {
      const colRef = collection(db, "users", user.uid, "favorites");
      const favDoc = doc(colRef);

      const favData: Omit<FavoriteFood, "id"> = {
        name,
        brand,
        base: baseMeta,
        selection,
        perBase,
        total,
        dataSource: "custom",
        code: undefined,
        createdAt: new Date().toISOString(),
      };

      await setDoc(favDoc, favData as any);
      setToast({
        show: true,
        message: "Custom food saved",
        color: "success",
      });
      setShowCreateCustomFood(false);
      setCustomName("");
      setCustomBrand("");
      setCustomCalories("");
      setCustomCarbs("");
      setCustomProtein("");
      setCustomFat("");
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save custom food",
        color: "danger",
      });
    }
  };

  const addFavoriteToMeal = async (fav: FavoriteFood) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid, "foods", dateKey);

    const item = {
      code: fav.code,
      name: fav.name,
      brand: fav.brand ?? null,
      dataSource: fav.dataSource ?? "favorite",
      base: fav.base,
      selection: fav.selection,
      perBase: fav.perBase,
      total: fav.total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    await upsertRecentFood({
      name: item.name,
      brand: item.brand,
      code: item.code,
    });
    history.replace(`/app/home?date=${dateKey}`);
  };

  const upsertRecentFood = async (payload: {
    name: string;
    brand?: string | null;
    code?: string;
  }) => {
    const user = auth.currentUser;
    if (!user) return;

    const key =
      payload.code && payload.code.trim().length > 0
        ? payload.code
        : `${payload.name.toLowerCase()}|${(payload.brand || "").toLowerCase()}`;

    const ref = doc(db, "users", user.uid, "recentFoods", key);
    await setDoc(
      ref,
      {
        name: payload.name,
        brand: payload.brand || null,
        code: payload.code || null,
        lastUsedAt: new Date().toISOString(),
        timesUsed: increment(1),
      },
      { merge: true }
    );
  };


  const addHistoryFoodToMeal = async (src: DiaryEntryDoc) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid, "foods", dateKey);
    const total: MacroSet =
      src.total || ({ calories: 0, carbs: 0, protein: 0, fat: 0 } as MacroSet);
    const item = {
      code: src.code,
      name: src.name || "(no name)",
      brand: src.brand ?? null,
      dataSource: src.dataSource ?? "history",
      base: src.base ?? null,
      selection:
        src.selection ??
        ({
          mode: "weight",
          note: "",
          servingsQty: null,
          weightQty: null,
        } as any),
      perBase: src.perBase ?? total,
      total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    history.replace(`/app/home?date=${dateKey}`);
  };

  const createMealPreset = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const name = mealPresetName.trim() || "(no name)";
    const calories = safeNum(parseFloat(mealPresetCalories || "0"), 0);
    const carbs = safeNum(parseFloat(mealPresetCarbs || "0"), 1);
    const protein = safeNum(parseFloat(mealPresetProtein || "0"), 1);
    const fat = safeNum(parseFloat(mealPresetFat || "0"), 1);
    const total: MacroSet = { calories, carbs, protein, fat };
    const note = mealPresetNote.trim() || undefined;

    try {
      const colRef = collection(db, "users", user.uid, "mealPresets");
      const presetDoc = doc(colRef);

      const data: Omit<CustomMealPreset, "id"> = {
        name,
        total,
        note,
        createdAt: new Date().toISOString(),
      };

      await setDoc(presetDoc, data);
      setToast({
        show: true,
        message: "Meal preset saved",
        color: "success",
      });
      setShowCreateMealPreset(false);
      setMealPresetName("");
      setMealPresetNote("");
      setMealPresetCalories("");
      setMealPresetCarbs("");
      setMealPresetProtein("");
      setMealPresetFat("");
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save meal preset",
        color: "danger",
      });
    }
  };

  const addMealPresetToMeal = async (preset: CustomMealPreset) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid, "foods", dateKey);

    const item = {
      code: null,
      name: preset.name,
      brand: null,
      dataSource: "mealPreset",
      base: { amount: 1, unit: "meal", label: "1 meal" },
      selection: {
        mode: "serving" as const,
        note: preset.note || "1 meal",
        servingsQty: 1,
        weightQty: null,
      },
      perBase: preset.total,
      total: preset.total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    history.replace(`/app/home?date=${dateKey}`);
  };

  const confirmDeleteFavorite = async () => {
    const user = auth.currentUser;
    if (!user || !favoriteToDelete) {
      setFavoriteToDelete(null);
      return;
    }

    try {
      const ref = doc(
        db,
        "users",
        user.uid,
        "favorites",
        favoriteToDelete.id
      );
      await deleteDoc(ref);
      setToast({
        show: true,
        message: "Favorite deleted",
        color: "success",
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not delete favorite",
        color: "danger",
      });
    } finally {
      setFavoriteToDelete(null);
    }
  };

  const previewPerBaseLabel = useMemo(() => {
    if (!selectedFood) return "100 g";
    const useServingMode =
      useServing && selectedFood.serving_size && hasServingMacros;
    return useServingMode
      ? parsedServing.label || selectedFood.serving_size || "1 serving"
      : "100 g";
  }, [selectedFood, useServing, hasServingMacros, parsedServing.label]);

  const previewPerBaseMacros = useMemo<MacroSet>(() => {
    const useServingMode =
      useServing && selectedFood?.serving_size && hasServingMacros;
    return useServingMode ? perServing : per100g;
  }, [useServing, selectedFood, hasServingMacros, perServing, per100g]);

  const previewTotal = useMemo(() => {
    const useServingMode =
      useServing && selectedFood?.serving_size && hasServingMacros;
    if (useServingMode) {
      return scale(previewPerBaseMacros, Math.max(0.1, servingsQty));
    }
    return scale(previewPerBaseMacros, Math.max(1, weightQty) / 100);
  }, [
    useServing,
    selectedFood,
    hasServingMacros,
    previewPerBaseMacros,
    servingsQty,
    weightQty,
  ]);

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

        <IonSegment
          value={tab}
          onIonChange={(e) =>
            setTab((e.detail.value as "search" | "favorites") || "search")
          }
          style={{ marginBottom: 12 }}
        >
          <IonSegmentButton value="search">
            <IonLabel>Search</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="favorites">
            <IonLabel>Favorites</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {tab === "search" && (
          <>
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

            <div
              style={{
                display: "grid",
                gap: 8,
                marginTop: 8,
              }}
            >
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
                onClick={() =>
                  history.push(`/scan-barcode?meal=${meal}&date=${dateKey}`)
                }
              >
                Barcode scanner
              </IonButton>
            </div>

            {recent.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <IonText
                  color="medium"
                  style={{
                    fontSize: 13,
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  From your history
                </IonText>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  {recent.map((r) => (
                    <IonChip
                      key={r.id}
                      onClick={() => {
                        if (r.code) {
                          fetchFoodDetailsByCode(r.code);
                        } else {
                          setQuery(r.name);
                          foodsSearch(r.name, 1);
                        }
                      }}
                    >
                      <IonLabel>
                        {r.name}
                        {r.brand ? ` · ${r.brand}` : ""}
                      </IonLabel>
                    </IonChip>
                  ))}
                </div>
              </div>
            )}

            <IonList style={{ marginTop: 8 }}>
              {results.map((food) => {
                const preview = macrosPer100g(food.nutriments);
                const hasPreview =
                  preview.calories ||
                  preview.protein ||
                  preview.carbs ||
                  preview.fat;
                return (
                  <IonItem
                    key={`${food.code}-${food.product_name || ""}`}
                    button
                    onClick={() => fetchFoodDetailsByCode(food.code)}
                  >
                    <IonLabel>
                      <h2>
                        {food.product_name || "(no name)"}
                        {food.brands ? ` · ${food.brands}` : ""}
                      </h2>
                      <p>
                        {(food.serving_size
                          ? `Serving: ${food.serving_size} · `
                          : "") +
                          (hasPreview
                            ? `${preview.calories || 0} kcal/100g · C ${
                                preview.carbs || 0
                              } g · P ${preview.protein || 0} g · F ${
                                preview.fat || 0
                              } g`
                            : "—")}
                      </p>
                    </IonLabel>
                  </IonItem>
                );
              })}
            </IonList>

            {results.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
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
          </>
        )}


        {tab === "favorites" && (
          <>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <IonButton
                size="small"
                onClick={() => setShowCreateCustomFood(true)}
              >
                Create custom food
              </IonButton>
              <IonButton
                size="small"
                fill="outline"
                onClick={() => setShowCreateMealPreset(true)}
              >
                Create custom meal
              </IonButton>
            </div>

            {recentLoading && (
              <div className="ion-text-center" style={{ padding: 8 }}>
                <IonSpinner name="dots" />
              </div>
            )}

            {!recentLoading && recentFoods.length > 0 && (
              <>
                <IonText
                  style={{
                    padding: "4px 12px",
                    display: "block",
                    fontSize: 13,
                    opacity: 0.8,
                  }}
                >
                  Recently eaten
                </IonText>
                <IonList style={{ marginTop: 4 }}>
                  {recentFoods.map((item, idx) => (
                    <IonItem
                      key={idx}
                      button
                      onClick={() => addHistoryFoodToMeal(item)}
                    >
                      <IonLabel>
                        <h2>
                          {item.name || "(no name)"}
                          {item.brand ? ` · ${item.brand}` : ""}
                        </h2>
                        <p>
                          {Math.round(item.total?.calories || 0)} kcal · Carbs{" "}
                          {(item.total?.carbs ?? 0).toFixed(1)} g · Protein{" "}
                          {(item.total?.protein ?? 0).toFixed(1)} g · Fat{" "}
                          {(item.total?.fat ?? 0).toFixed(1)} g
                        </p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}

            {favoritesLoading && (
              <div className="ion-text-center" style={{ padding: 16 }}>
                <IonSpinner name="dots" />
              </div>
            )}

            {!favoritesLoading && favorites.length === 0 && (
              <p
                style={{
                  padding: 12,
                  opacity: 0.7,
                  fontSize: 14,
                }}
              >
                No favorites yet. When adding a food, tap{" "}
                <strong>“Save this portion as a favorite”</strong> in the details
                dialog to store it here.
              </p>
            )}

            {!favoritesLoading && favorites.length > 0 && (
              <>
                <IonText
                  style={{
                    padding: "4px 12px",
                    display: "block",
                    fontSize: 13,
                    opacity: 0.8,
                  }}
                >
                  Favorites
                </IonText>
                <IonList style={{ marginTop: 4 }}>
                  {favorites.map((fav) => (
                    <IonItem
                      key={fav.id}
                      button
                      onClick={() => addFavoriteToMeal(fav)}
                    >
                      <IonIcon slot="start" icon={starOutline} />
                      <IonLabel>
                        <h2>
                          {fav.name}
                          {fav.brand ? ` · ${fav.brand}` : ""}
                        </h2>
                        <p>
                          {Math.round(fav.total.calories)} kcal · Carbs{" "}
                          {fav.total.carbs.toFixed(1)} g · Protein{" "}
                          {fav.total.protein.toFixed(1)} g · Fat{" "}
                          {fav.total.fat.toFixed(1)} g
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          {fav.selection.note}
                        </p>
                      </IonLabel>

                      <IonButton
                        slot="end"
                        fill="clear"
                        color="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFavoriteToDelete(fav);
                        }}
                        aria-label={`Delete favorite ${fav.name}`}
                      >
                        <IonIcon icon={trashOutline} />
                      </IonButton>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}

            {mealPresetsLoading && (
              <div className="ion-text-center" style={{ padding: 12 }}>
                <IonSpinner name="dots" />
              </div>
            )}

            {!mealPresetsLoading && mealPresets.length > 0 && (
              <>
                <IonText
                  style={{
                    padding: "4px 12px",
                    display: "block",
                    fontSize: 13,
                    opacity: 0.8,
                    marginTop: 8,
                  }}
                >
                  Custom meals
                </IonText>
                <IonList style={{ marginTop: 4 }}>
                  {mealPresets.map((preset) => (
                    <IonItem
                      key={preset.id}
                      button
                      onClick={() => addMealPresetToMeal(preset)}
                    >
                      <IonLabel>
                        <h2>{preset.name}</h2>
                        <p>
                          {Math.round(preset.total.calories)} kcal · Carbs{" "}
                          {preset.total.carbs.toFixed(1)} g · Protein{" "}
                          {preset.total.protein.toFixed(1)} g · Fat{" "}
                          {preset.total.fat.toFixed(1)} g
                        </p>
                        {preset.note && (
                          <p
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            {preset.note}
                          </p>
                        )}
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}
          </>
        )}

        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>
                {selectedFood?.product_name || "(no name)"}
              </IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {selectedFood && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <p
                    style={{
                      margin: 0,
                      opacity: 0.7,
                    }}
                  >
                    {selectedFood.brands ? `${selectedFood.brands}` : ""}
                    {selectedFood.brands && selectedFood.nutriscore_grade ? " · " : ""}
                    {selectedFood.nutriscore_grade
                      ? `Nutri-Score ${selectedFood.nutriscore_grade.toUpperCase()}`
                      : ""}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      opacity: 0.8,
                    }}
                  >
                    Adding to: <strong>{meal}</strong> · {friendlyDate}
                  </p>
                </div>

                <IonSegment
                  value={useServing ? "serving" : "weight"}
                  onIonChange={(e) =>
                    setUseServing(e.detail.value === "serving")
                  }
                >
                  <IonSegmentButton
                    value="serving"
                    disabled={
                      !selectedFood.serving_size || !hasServingMacros
                    }
                  >
                    <IonLabel>Serving</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton
                    value="weight"
                    disabled={!has100gMacros}
                  >
                    <IonLabel>Weight</IonLabel>
                  </IonSegmentButton>
                </IonSegment>

                {useServing &&
                selectedFood.serving_size &&
                hasServingMacros ? (
                  <IonCard style={{ marginTop: 12 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: 16 }}>
                        Quantity ·{" "}
                        <span style={{ opacity: 0.7 }}>
                          {previewPerBaseLabel}
                        </span>
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <IonButton
                          fill="outline"
                          onClick={() =>
                            setServingsQty((v) =>
                              Math.max(0.1, safeNum(v - 0.5, 1))
                            )
                          }
                        >
                          −
                        </IonButton>
                        <IonInput
                          type="number"
                          inputMode="decimal"
                          value={servingsQty}
                          min="0.1"
                          step="0.1"
                          onIonChange={(e) =>
                            setServingsQty(
                              Math.max(0.1, Number(e.detail.value))
                            )
                          }
                          style={{
                            textAlign: "center",
                          }}
                        />
                        <IonButton
                          fill="outline"
                          onClick={() =>
                            setServingsQty((v) => safeNum(v + 0.5, 1))
                          }
                        >
                          +
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ) : (
                  <IonCard style={{ marginTop: 12 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: 16 }}>
                        Amount ·{" "}
                        <span style={{ opacity: 0.7 }}>grams</span>
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <IonButton
                          fill="outline"
                          onClick={() =>
                            setWeightQty((v) => Math.max(1, v - 10))
                          }
                        >
                          −10
                        </IonButton>
                        <IonInput
                          type="number"
                          inputMode="numeric"
                          value={weightQty}
                          min="1"
                          step="1"
                          onIonChange={(e) =>
                            setWeightQty(
                              Math.max(1, Number(e.detail.value))
                            )
                          }
                          style={{
                            textAlign: "center",
                          }}
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

                <IonCard style={{ marginTop: 8 }}>
                  <IonCardHeader>
                    <IonCardTitle
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                      }}
                    >
                      <span>Nutrition total</span>
                      <IonText
                        color="medium"
                        style={{ fontSize: 12 }}
                      >
                        {useServing
                          ? `${safeNum(servingsQty, 1)} × ${previewPerBaseLabel}`
                          : `${Math.max(
                              1,
                              weightQty
                            )} g (base: ${previewPerBaseLabel})`}
                      </IonText>
                    </IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <div
                      style={{
                        textAlign: "center",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 34,
                          fontWeight: 800,
                          lineHeight: 1,
                        }}
                      >
                        {safeNum(previewTotal.calories, 0)} kcal
                      </div>
                    </div>

                    <IonGrid>
                      <IonRow>
                        <IonCol className="ion-text-center">
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            Carbs
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            {safeNum(previewTotal.carbs, 1)} g
                          </div>
                        </IonCol>
                        <IonCol className="ion-text-center">
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            Protein
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            {safeNum(previewTotal.protein, 1)} g
                          </div>
                        </IonCol>
                        <IonCol className="ion-text-center">
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.7,
                            }}
                          >
                            Fat
                          </div>
                          <div
                            style={{
                              fontSize: 18,
                              fontWeight: 700,
                            }}
                          >
                            {safeNum(previewTotal.fat, 1)} g
                          </div>
                        </IonCol>
                      </IonRow>
                    </IonGrid>
                  </IonCardContent>
                </IonCard>

                <IonText
                  color="medium"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginTop: 8,
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                  onClick={saveCurrentSelectionAsFavorite}
                >
                  Save this portion as a favorite
                </IonText>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 16,
                  }}
                >
                  <IonButton
                    expand="block"
                    onClick={() => setOpen(false)}
                    fill="outline"
                  >
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

        <IonToast
          isOpen={toast.show}
          message={toast.message}
          color={toast.color}
          duration={2000}
          onDidDismiss={() => setToast({ ...toast, show: false })}
        />

        <IonAlert
          isOpen={!!favoriteToDelete}
          header="Delete favorite?"
          message={
            favoriteToDelete
              ? `Remove “${favoriteToDelete.name}” from your favorites?`
              : ""
          }
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => setFavoriteToDelete(null),
            },
            {
              text: "Delete",
              role: "destructive",
              handler: confirmDeleteFavorite,
            },
          ]}
          onDidDismiss={() => setFavoriteToDelete(null)}
        />

        <IonModal
          isOpen={showCreateCustomFood}
          onDidDismiss={() => setShowCreateCustomFood(false)}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create custom food</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput
                value={customName}
                onIonChange={(e) => setCustomName(e.detail.value || "")}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Brand (optional)</IonLabel>
              <IonInput
                value={customBrand}
                onIonChange={(e) => setCustomBrand(e.detail.value || "")}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Calories per 100 g</IonLabel>
              <IonInput
                type="number"
                inputMode="numeric"
                value={customCalories}
                onIonChange={(e) =>
                  setCustomCalories(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Carbs per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customCarbs}
                onIonChange={(e) =>
                  setCustomCarbs(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Protein per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customProtein}
                onIonChange={(e) =>
                  setCustomProtein(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Fat per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customFat}
                onIonChange={(e) => setCustomFat(e.detail.value || "")}
              />
            </IonItem>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
              }}
            >
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => setShowCreateCustomFood(false)}
              >
                Cancel
              </IonButton>
              <IonButton
                expand="block"
                onClick={createCustomFood}
              >
                Save custom food
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={showCreateMealPreset}
          onDidDismiss={() => setShowCreateMealPreset(false)}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create custom meal</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="stacked">Meal name</IonLabel>
              <IonInput
                value={mealPresetName}
                onIonChange={(e) =>
                  setMealPresetName(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Note (optional)</IonLabel>
              <IonInput
                value={mealPresetNote}
                onIonChange={(e) =>
                  setMealPresetNote(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total calories</IonLabel>
              <IonInput
                type="number"
                inputMode="numeric"
                value={mealPresetCalories}
                onIonChange={(e) =>
                  setMealPresetCalories(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total carbs (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetCarbs}
                onIonChange={(e) =>
                  setMealPresetCarbs(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total protein (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetProtein}
                onIonChange={(e) =>
                  setMealPresetProtein(e.detail.value || "")
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total fat (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetFat}
                onIonChange={(e) =>
                  setMealPresetFat(e.detail.value || "")
                }
              />
            </IonItem>

            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 16,
              }}
            >
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => setShowCreateMealPreset(false)}
              >
                Cancel
              </IonButton>
              <IonButton
                expand="block"
                onClick={createMealPreset}
              >
                Save custom meal
              </IonButton>
            </div>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default AddFood;
