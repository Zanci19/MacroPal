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
  IonActionSheet,
} from "@ionic/react";

import { useLocation, useHistory } from "react-router";
import { auth, db, trackEvent } from "../firebase";
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
  runTransaction,
} from "firebase/firestore";

import { calendarOutline, starOutline, trashOutline } from "ionicons/icons";
import {
  clampDateKeyToToday,
  formatDateKey,
  isDateKey,
  todayDateKey,
  shiftDateKey,
} from "../utils/date";

/**
 * ==============
 * Types
 * ==============
 */

type OFFNutriments = {
  ["energy-kcal_100g"]?: number;
  ["energy-kcal_serving"]?: number;
  ["proteins_100g"]?: number;
  ["proteins_serving"]?: number;
  ["fat_100g"]?: number;
  ["fat_serving"]?: number;
  ["carbohydrates_100g"]?: number;
  ["carbohydrates_serving"]?: number;

  // Extra nutrients
  ["sugars_100g"]?: number;
  ["sugars_serving"]?: number;
  ["fiber_100g"]?: number;
  ["fiber_serving"]?: number;
  ["saturated-fat_100g"]?: number;
  ["saturated-fat_serving"]?: number;
  ["salt_100g"]?: number;
  ["salt_serving"]?: number;
  ["sodium_100g"]?: number;
  ["sodium_serving"]?: number;
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

type MacroSet = {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  // optional extra nutrients (per base)
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number;
  sodium?: number;
};

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

type Goal = "lose" | "maintain" | "gain";

/**
 * Profile shape subset used here
 */
type ProfileFromFirestore = {
  age?: number | null;
  weight?: number | null;
  height?: number | null;
  goal?: Goal;
  gender?: "male" | "female";
  activity?: "sedentary" | "light" | "moderate" | "very" | "extra";
  caloriesTarget?: number;
  macroTargets?: {
    proteinG: number;
    fatG: number;
    carbsG: number;
  };
};

const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

/**
 * ============
 * Helpers
 * ============
 */

function safeNum(n: unknown, dp = 2): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!isFinite(v)) return 0;
  return Number(v.toFixed(dp));
}

function parseServingSize(
  servingSize?: string
): { grams?: number; ml?: number; label: string } {
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

    sugar:
      nutri?.["sugars_100g"] !== undefined
        ? safeNum(nutri["sugars_100g"], 2)
        : undefined,
    fiber:
      nutri?.["fiber_100g"] !== undefined
        ? safeNum(nutri["fiber_100g"], 2)
        : undefined,
    saturatedFat:
      nutri?.["saturated-fat_100g"] !== undefined
        ? safeNum(nutri["saturated-fat_100g"], 2)
        : undefined,
    salt:
      nutri?.["salt_100g"] !== undefined
        ? safeNum(nutri["salt_100g"], 2)
        : undefined,
    sodium:
      nutri?.["sodium_100g"] !== undefined
        ? safeNum(nutri["sodium_100g"], 2)
        : undefined,
  };
}

function macrosPerServing(nutri?: OFFNutriments): MacroSet {
  return {
    calories: safeNum(nutri?.["energy-kcal_serving"], 0),
    carbs: safeNum(nutri?.["carbohydrates_serving"], 2),
    protein: safeNum(nutri?.["proteins_serving"], 2),
    fat: safeNum(nutri?.["fat_serving"], 2),

    sugar:
      nutri?.["sugars_serving"] !== undefined
        ? safeNum(nutri["sugars_serving"], 2)
        : undefined,
    fiber:
      nutri?.["fiber_serving"] !== undefined
        ? safeNum(nutri["fiber_serving"], 2)
        : undefined,
    saturatedFat:
      nutri?.["saturated-fat_serving"] !== undefined
        ? safeNum(nutri["saturated-fat_serving"], 2)
        : undefined,
    salt:
      nutri?.["salt_serving"] !== undefined
        ? safeNum(nutri["salt_serving"], 2)
        : undefined,
    sodium:
      nutri?.["sodium_serving"] !== undefined
        ? safeNum(nutri["sodium_serving"], 2)
        : undefined,
  };
}

function scale(base: MacroSet, qty: number): MacroSet {
  return {
    calories: safeNum(base.calories * qty, 0),
    carbs: safeNum(base.carbs * qty, 1),
    protein: safeNum(base.protein * qty, 1),
    fat: safeNum(base.fat * qty, 1),

    sugar:
      base.sugar !== undefined ? safeNum(base.sugar * qty, 1) : undefined,
    fiber:
      base.fiber !== undefined ? safeNum(base.fiber * qty, 1) : undefined,
    saturatedFat:
      base.saturatedFat !== undefined
        ? safeNum(base.saturatedFat * qty, 1)
        : undefined,
    salt:
      base.salt !== undefined ? safeNum(base.salt * qty, 2) : undefined,
    sodium:
      base.sodium !== undefined
        ? safeNum(base.sodium * qty, 2)
        : undefined,
  };
}

function useMealFromQuery(location: ReturnType<typeof useLocation>): MealKey {
  const params = new URLSearchParams(location.search);
  const m = (params.get("meal") || "breakfast").toLowerCase();
  return (["breakfast", "lunch", "dinner", "snacks"] as MealKey[]).includes(
    m as MealKey
  )
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

/**
 * ===========================
 * Recommendation presets
 * ===========================
 */

const PROTEIN_SUGGESTIONS: Record<Goal, string[]> = {
  lose: [
    "Greek yogurt (0–2% fat) with some berries",
    "Tuna with cucumber or salad",
    "Low-fat cottage cheese",
    "Egg whites omelette with veggies",
  ],
  maintain: [
    "Skyr or Greek yogurt with fruit",
    "Chicken breast with rice cakes",
    "Cottage cheese + piece of fruit",
    "Protein shake with a banana",
  ],
  gain: [
    "Chicken and rice bowl",
    "Protein shake with oats and banana",
    "Cottage cheese with honey and granola",
    "Tuna sandwich on whole-grain bread",
  ],
};

const CARB_SUGGESTIONS: Record<Goal, string[]> = {
  lose: [
    "Fruit (banana, apple, berries)",
    "Oatmeal with a bit of honey",
    "Whole-grain toast with some jam",
    "Rice cakes with banana slices",
  ],
  maintain: [
    "Oatmeal with milk and fruit",
    "Rice or pasta with a light sauce",
    "Whole-grain bread with toppings",
    "Potatoes with veggies",
  ],
  gain: [
    "Big bowl of oatmeal with milk and toppings",
    "Rice / pasta with sauce and some cheese",
    "Bagel with peanut butter and banana",
    "Granola with yogurt and fruit",
  ],
};

const FAT_SUGGESTIONS: Record<Goal, string[]> = {
  lose: [
    "Handful of nuts (almonds, walnuts)",
    "Avocado on whole-grain toast",
    "Olives with salad",
  ],
  maintain: [
    "Nuts & seeds mix",
    "Avocado + eggs on toast",
    "Cheese with whole-grain crackers",
  ],
  gain: [
    "Peanut butter sandwich",
    "Trail mix (nuts + dried fruit + chocolate)",
    "Cheese and salami with bread",
  ],
};

function pickRandom(list: string[]): string {
  if (!list.length) return "";
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

/**
 * ==================
 * Component
 * ==================
 */

const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const [meal, setMeal] = useState<MealKey>(useMealFromQuery(location));
  const dateKey = useDateFromQuery(location);

  const [showMealPicker, setShowMealPicker] = useState(false);

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
  const [favoriteToDelete, setFavoriteToDelete] =
    useState<FavoriteFood | null>(null);

  const [recentFoods, setRecentFoods] = useState<DiaryEntryDoc[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [mealPresets, setMealPresets] = useState<CustomMealPreset[]>([]);
  const [mealPresetsLoading, setMealPresetsLoading] = useState(false);

  const [editEntry, setEditEntry] = useState<{
    meal: MealKey;
    index: number;
    item: DiaryEntryDoc;
  } | null>(null);

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

  // 🔥 New: profile targets + today's totals
  const [targets, setTargets] = useState<{
    calories: number;
    proteinG: number;
    fatG: number;
    carbsG: number;
    goal: Goal;
  } | null>(null);

  const [dayTotals, setDayTotals] = useState<{
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  } | null>(null);

  const per100g = useMemo(
    () => macrosPer100g(selectedFood?.nutriments),
    [selectedFood]
  );
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

  // Screen view
  useEffect(() => {
    trackEvent("add_food_screen_view", { meal, date: dateKey });
  }, [meal, dateKey]);

  /**
   * 🔥 Load profile targets (caloriesTarget + macroTargets) once
   */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    (async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { profile?: ProfileFromFirestore } | undefined;
        const p = data?.profile;

        if (!p || !p.caloriesTarget || !p.macroTargets) {
          return;
        }

        setTargets({
          calories: p.caloriesTarget,
          proteinG: p.macroTargets.proteinG,
          fatG: p.macroTargets.fatG,
          carbsG: p.macroTargets.carbsG,
          goal: (p.goal as Goal) || "maintain",
        });

        trackEvent("add_food_profile_targets_loaded", {
          uid: user.uid,
          calories: p.caloriesTarget,
        });
      } catch (e: any) {
        console.error("Error loading profile targets:", e);
        trackEvent("add_food_profile_targets_error", {
          message: e?.message || String(e),
        });
      }
    })();
  }, []);

  /**
   * 🔥 Subscribe to today's diary to compute totals (kcal, C, P, F)
   */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const ref = doc(db, "users", user.uid, "foods", dateKey);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setDayTotals({
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
          });
          return;
        }

        const data = snap.data() as DayDoc;
        let calories = 0;
        let protein = 0;
        let fat = 0;
        let carbs = 0;

        (["breakfast", "lunch", "dinner", "snacks"] as MealKey[]).forEach(
          (mealKey) => {
            const arr = data[mealKey] || [];
            arr.forEach((item) => {
              const t = item.total;
              if (!t) return;
              calories += Number(t.calories || 0);
              carbs += Number(t.carbs || 0);
              protein += Number(t.protein || 0);
              fat += Number(t.fat || 0);
            });
          }
        );

        setDayTotals({ calories, protein, fat, carbs });
      },
      (err) => {
        console.error("Error loading day totals:", err);
        trackEvent("add_food_day_totals_error", {
          message: err?.message || String(err),
        });
      }
    );

    return () => unsub();
  }, [dateKey]);

  // Handle code/q from URL (barcode / prefilled search)
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
        trackEvent("add_food_from_barcode", {
          meal,
          date: dateKey,
          code,
          found_flag: !!found,
        });

        try {
          const r = await fetch(
            `${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`
          );
          if (r.ok) {
            const data: OFFBarcodeResponse = await r.json();
            if ("status" in data && data.status === 1) {
              trackEvent("barcode_lookup_success", {
                code,
                meal,
                date: dateKey,
              });

              setToast({
                show: true,
                message: "Item found",
                color: "success",
              });

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
              trackEvent("barcode_lookup_not_found", {
                code,
                meal,
                date: dateKey,
              });

              setToast({
                show: true,
                message: "Item not found — showing search.",
                color: "danger",
              });
              setQuery(code);
              await foodsSearch(code, 1);
            }
          } else {
            trackEvent("barcode_lookup_http_error", {
              code,
              status: r.status,
            });
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
          trackEvent("barcode_lookup_exception", {
            code,
            error: e?.message || String(e),
          });
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
        trackEvent("add_food_search_prefilled", {
          query: q,
          meal,
          date: dateKey,
        });
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
        trackEvent("add_food_return_from_scan", { meal, date: dateKey });
        cleanUrl();
      }
    })();
  }, [location.search, history, meal, dateKey]);

  // EDIT MODE – preload entry from location.state
  useEffect(() => {
    const state = (location as any).state as
      | {
          editEntry?: {
            meal: MealKey;
            index: number;
            item: DiaryEntryDoc;
          };
        }
      | undefined;

    if (!state || !state.editEntry) return;

    const { meal, index, item } = state.editEntry;

    setEditEntry({ meal, index, item });

    const sel: any = item.selection || {};
    const mode: "serving" | "weight" =
      sel.mode === "serving" || sel.mode === "weight" ? sel.mode : "weight";

    if (mode === "serving") {
      const q =
        typeof sel.servingsQty === "number" && sel.servingsQty > 0
          ? sel.servingsQty
          : 1;
      setUseServing(true);
      setServingsQty(q);
    } else {
      const grams =
        typeof sel.weightQty === "number" && sel.weightQty > 0
          ? sel.weightQty
          : 100;
      setUseServing(false);
      setWeightQty(grams);
    }

    setOpen(true);

    history.replace({
      pathname: "/add-food",
      search: location.search,
    });
  }, [location, history]);

  // Favorites
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
        trackEvent("favorites_loaded", {
          uid: user.uid,
          count: list.length,
        });
      },
      (err) => {
        console.error(err);
        setFavoritesLoading(false);
        setToast({
          show: true,
          message: "Error loading favorites",
          color: "danger",
        });
        trackEvent("favorites_load_error", {
          uid: user.uid,
          error: err?.message || String(err),
        });
      }
    );
    return () => unsub();
  }, []);

  // Recent OFF
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
      trackEvent("recent_off_loaded", {
        uid: user.uid,
        count: list.length,
      });
    });

    return () => unsub();
  }, []);

  // Recent history (last 14 days)
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

        if (!cancelled) {
          setRecentFoods(unique);
          trackEvent("recent_history_loaded", {
            uid,
            count: unique.length,
          });
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          trackEvent("recent_history_load_error", {
            error: e?.message || String(e),
          });
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    };

    loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  // Meal presets
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
        trackEvent("meal_presets_loaded", {
          uid: user.uid,
          count: list.length,
        });
      },
      (err) => {
        console.error(err);
        setMealPresetsLoading(false);
        setToast({
          show: true,
          message: "Error loading custom meals",
          color: "danger",
        });
        trackEvent("meal_presets_load_error", {
          uid: user.uid,
          error: err?.message || String(err),
        });
      }
    );
    return () => unsub();
  }, []);

  const foodsSearch = async (q: string, pageNumber = 1): Promise<number> => {
    if (!q.trim()) return 0;
    setLoading(true);

    trackEvent("food_search_start", {
      query: q,
      page: pageNumber,
      meal,
      date: dateKey,
    });

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

      trackEvent("food_search_success", {
        query: q,
        page: pageNumber,
        count: foods.length,
      });

      return foods.length;
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Error fetching foods",
        color: "danger",
      });

      trackEvent("food_search_error", {
        query: q,
        page: pageNumber,
        error: e?.message || String(e),
      });

      return 0;
    } finally {
      setLoading(false);
    }
  };

  const fetchFoodDetailsByCode = async (code: string) => {
    trackEvent("food_details_by_code_start", {
      code,
      meal,
      date: dateKey,
    });

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

        trackEvent("food_details_by_code_success", {
          code,
          hasServing: canServing,
        });
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

      trackEvent("food_details_by_code_error", {
        code,
        error: e?.message || String(e),
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
    const user = auth.currentUser;
    if (!user) return;

    // ✏️ EDIT MODE – update existing entry
    if (editEntry) {
      const { meal: mealKey, index, item } = editEntry;
      const anyItem: any = item;
      const sel: any = anyItem.selection || {};
      const base = anyItem.base || null;

      const mode: "serving" | "weight" =
        sel.mode === "serving" || sel.mode === "weight"
          ? sel.mode
          : useServing
          ? "serving"
          : "weight";

      let oldValue: number;
      let newValue: number;

      if (mode === "serving") {
        oldValue =
          typeof sel.servingsQty === "number" && sel.servingsQty > 0
            ? sel.servingsQty
            : 1;
        newValue = Math.max(0.1, servingsQty);
      } else {
        oldValue =
          typeof sel.weightQty === "number" && sel.weightQty > 0
            ? sel.weightQty
            : typeof anyItem.amount === "number" && anyItem.amount > 0
            ? anyItem.amount
            : 100;
        newValue = Math.max(1, weightQty);
      }

      if (!oldValue || oldValue <= 0) oldValue = mode === "serving" ? 1 : 100;
      const ratio = newValue / oldValue;

      const oldTotal: any = item.total || {};
      const newTotal: MacroSet = {
        calories: safeNum((oldTotal.calories || 0) * ratio, 0),
        carbs: safeNum((oldTotal.carbs || 0) * ratio, 2),
        protein: safeNum((oldTotal.protein || 0) * ratio, 2),
        fat: safeNum((oldTotal.fat || 0) * ratio, 2),
        sugar:
          oldTotal.sugar !== undefined
            ? safeNum((oldTotal.sugar || 0) * ratio, 2)
            : undefined,
        fiber:
          oldTotal.fiber !== undefined
            ? safeNum((oldTotal.fiber || 0) * ratio, 2)
            : undefined,
        saturatedFat:
          oldTotal.saturatedFat !== undefined
            ? safeNum((oldTotal.saturatedFat || 0) * ratio, 2)
            : undefined,
        salt:
          oldTotal.salt !== undefined
            ? safeNum((oldTotal.salt || 0) * ratio, 2)
            : undefined,
        sodium:
          oldTotal.sodium !== undefined
            ? safeNum((oldTotal.sodium || 0) * ratio, 2)
            : undefined,
      };

      const newSel: any = {
        ...(sel || {}),
        mode,
      };

      if (mode === "serving") {
        newSel.servingsQty = newValue;
        if (newSel.weightQty === undefined) newSel.weightQty = null;

        const baseLabel = base?.label || sel.note || "1 serving";

        newSel.note = `${safeNum(newValue, 2)} × ${baseLabel}`;
      } else {
        newSel.weightQty = newValue;
        if (newSel.servingsQty === undefined) newSel.servingsQty = null;
        newSel.note = `${safeNum(newValue, 0)} g`;
      }

      const updated: DiaryEntryDoc = {
        ...item,
        total: newTotal,
        selection: newSel,
      };

      const userRef = doc(db, "users", user.uid, "foods", dateKey);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const data = (snap.data() || {}) as DayDoc;
        const arr: DiaryEntryDoc[] = Array.isArray(data[mealKey])
          ? [...(data[mealKey] as DiaryEntryDoc[])]
          : [];

        let idx = index;
        if (idx < 0 || idx >= arr.length) {
          idx = arr.findIndex((x) => x.addedAt === item.addedAt);
        }
        if (idx < 0) return;

        arr[idx] = updated;
        tx.set(userRef, { ...data, [mealKey]: arr }, { merge: true });
      });

      trackEvent("diary_entry_edited_in_add_food", {
        uid: user.uid,
        meal: mealKey,
        date: dateKey,
        index,
        name: item.name,
      });

      setOpen(false);
      history.replace(`/app/home?date=${dateKey}`);
      return;
    }

    // 🧃 NORMAL ADD FROM OFF
    if (!selectedFood) return;

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

    const userRef = doc(db, "users", user.uid, "foods", dateKey);

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
        sugar:
          perBase.sugar !== undefined
            ? safeNum(perBase.sugar, 2)
            : undefined,
        fiber:
          perBase.fiber !== undefined
            ? safeNum(perBase.fiber, 2)
            : undefined,
        saturatedFat:
          perBase.saturatedFat !== undefined
            ? safeNum(perBase.saturatedFat, 2)
            : undefined,
        salt:
          perBase.salt !== undefined
            ? safeNum(perBase.salt, 2)
            : undefined,
        sodium:
          perBase.sodium !== undefined
            ? safeNum(perBase.sodium, 2)
            : undefined,
      } as MacroSet,
      total,
      addedAt: new Date().toISOString(),
    };

    await setDoc(userRef, { [meal]: arrayUnion(item) }, { merge: true });
    await upsertRecentFood({
      name: item.name,
      brand: item.brand,
      code: item.code,
    });

    trackEvent("diary_add_from_off", {
      uid: user.uid,
      meal,
      date: dateKey,
      code: item.code,
      name: item.name,
      mode: item.selection.mode,
      calories: item.total.calories,
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
          sugar:
            perBase.sugar !== undefined
              ? safeNum(perBase.sugar, 2)
              : undefined,
          fiber:
            perBase.fiber !== undefined
              ? safeNum(perBase.fiber, 2)
              : undefined,
          saturatedFat:
            perBase.saturatedFat !== undefined
              ? safeNum(perBase.saturatedFat, 2)
              : undefined,
          salt:
            perBase.salt !== undefined
              ? safeNum(perBase.salt, 2)
              : undefined,
          sodium:
            perBase.sodium !== undefined
              ? safeNum(perBase.sodium, 2)
              : undefined,
        } as MacroSet,
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

      trackEvent("favorite_saved_from_off", {
        uid: user.uid,
        code: selectedFood.code,
        name: favData.name,
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save favorite",
        color: "danger",
      });
      trackEvent("favorite_save_error", {
        error: e?.message || String(e),
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

      trackEvent("custom_food_saved", {
        uid: user.uid,
        name,
        calories,
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save custom food",
        color: "danger",
      });
      trackEvent("custom_food_save_error", {
        error: e?.message || String(e),
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

    trackEvent("diary_add_from_favorite", {
      uid: user.uid,
      meal,
      date: dateKey,
      favorite_id: fav.id,
      source: fav.dataSource,
      calories: fav.total.calories,
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

    trackEvent("recent_food_upserted", {
      uid: user.uid,
      key,
      name: payload.name,
    });
  };

  const addHistoryFoodToMeal = async (src: DiaryEntryDoc) => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid, "foods", dateKey);
    const total: MacroSet =
      src.total ||
      ({ calories: 0, carbs: 0, protein: 0, fat: 0 } as MacroSet);
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

    trackEvent("diary_add_from_history", {
      uid: user.uid,
      meal,
      date: dateKey,
      name: item.name,
      calories: item.total.calories,
    });

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

      trackEvent("meal_preset_saved", {
        uid: user.uid,
        name,
        calories,
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not save meal preset",
        color: "danger",
      });
      trackEvent("meal_preset_save_error", {
        error: e?.message || String(e),
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

    trackEvent("diary_add_from_meal_preset", {
      uid: user.uid,
      meal,
      date: dateKey,
      preset_id: preset.id,
      name: preset.name,
      calories: preset.total.calories,
    });

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

      trackEvent("favorite_deleted", {
        uid: user.uid,
        favorite_id: favoriteToDelete.id,
      });
    } catch (e: any) {
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not delete favorite",
        color: "danger",
      });
      trackEvent("favorite_delete_error", {
        error: e?.message || String(e),
      });
    } finally {
      setFavoriteToDelete(null);
    }
  };

  const previewPerBaseLabel = useMemo(() => {
    if (editEntry) {
      const src: any = editEntry.item;
      const sel: any = src.selection || {};
      const base = src.base || null;

      if (useServing) {
        return base?.label || sel.note || "1 serving";
      }
      return "100 g";
    }

    if (!selectedFood) return "100 g";
    const useServingMode =
      useServing && selectedFood.serving_size && hasServingMacros;
    return useServingMode
      ? parsedServing.label || selectedFood.serving_size || "1 serving"
      : "100 g";
  }, [editEntry, useServing, selectedFood, hasServingMacros, parsedServing]);

  const previewPerBaseMacros = useMemo<MacroSet>(() => {
    const useServingMode =
      useServing && selectedFood?.serving_size && hasServingMacros;
    return useServingMode ? perServing : per100g;
  }, [useServing, selectedFood, hasServingMacros, perServing, per100g]);

  const previewTotal = useMemo(() => {
    if (editEntry) {
      const src: any = editEntry.item;
      const total: MacroSet =
        src.total ||
        ({ calories: 0, carbs: 0, protein: 0, fat: 0 } as MacroSet);
      const sel: any = src.selection || {};

      const mode: "serving" | "weight" =
        sel.mode === "serving" || sel.mode === "weight"
          ? sel.mode
          : useServing
          ? "serving"
          : "weight";

      let oldVal: number;
      let newVal: number;

      if (mode === "serving") {
        oldVal =
          typeof sel.servingsQty === "number" && sel.servingsQty > 0
            ? sel.servingsQty
            : 1;
        newVal = Math.max(0.1, servingsQty);
      } else {
        oldVal =
          typeof sel.weightQty === "number" && sel.weightQty > 0
            ? sel.weightQty
            : typeof src.amount === "number" && src.amount > 0
            ? src.amount
            : 100;
        newVal = Math.max(1, weightQty);
      }

      if (!oldVal || oldVal <= 0) oldVal = mode === "serving" ? 1 : 100;
      const ratio = newVal / oldVal;

      return scale(total, ratio);
    }

    const useServingMode =
      useServing && selectedFood?.serving_size && hasServingMacros;
    if (useServingMode) {
      return scale(previewPerBaseMacros, Math.max(0.1, servingsQty));
    }
    return scale(previewPerBaseMacros, Math.max(1, weightQty) / 100);
  }, [
    editEntry,
    useServing,
    servingsQty,
    weightQty,
    selectedFood,
    hasServingMacros,
    previewPerBaseMacros,
  ]);

  const hasExtraNutrients =
    previewTotal.sugar !== undefined ||
    previewTotal.fiber !== undefined ||
    previewTotal.saturatedFat !== undefined ||
    previewTotal.salt !== undefined;

  // serving vs weight card in UI
  const isEditServingMode =
    !!editEntry &&
    (() => {
      const src: any = editEntry.item;
      const sel: any = src.selection || {};
      const mode: "serving" | "weight" =
        sel.mode === "serving" || sel.mode === "weight"
          ? sel.mode
          : useServing
          ? "serving"
          : "weight";
      return mode === "serving";
    })();

  const showServingCard = editEntry
    ? isEditServingMode
    : !!(useServing && selectedFood?.serving_size && hasServingMacros);

  const disableAddButton =
    editEntry != null
      ? safeNum(previewTotal.calories, 0) === 0 &&
        safeNum(previewTotal.protein, 2) === 0 &&
        safeNum(previewTotal.carbs, 2) === 0 &&
        safeNum(previewTotal.fat, 2) === 0
      : safeNum(previewPerBaseMacros.calories, 0) === 0 &&
        safeNum(previewPerBaseMacros.protein, 2) === 0 &&
        safeNum(previewPerBaseMacros.carbs, 2) === 0 &&
        safeNum(previewPerBaseMacros.fat, 2) === 0;

  const modalTitle =
    editEntry?.item?.name || selectedFood?.product_name || "(no name)";

  const handleChangeMeal = (next: MealKey) => {
    if (next === meal) return;

    trackEvent("add_food_meal_change", {
      from: meal,
      to: next,
      date: dateKey,
    });

    setMeal(next);

    const params = new URLSearchParams(location.search);
    params.set("meal", next);
    history.replace({
      pathname: "/add-food",
      search: `?${params.toString()}`,
    });

    setShowMealPicker(false);
  };

  /**
   * 🔥 Smart recommendation based on remaining macros
   */
  const recommendation = useMemo(() => {
    if (!targets || !dayTotals) return null;

    const remainingProtein = Math.max(0, targets.proteinG - dayTotals.protein);
    const remainingCarbs = Math.max(0, targets.carbsG - dayTotals.carbs);
    const remainingFat = Math.max(0, targets.fatG - dayTotals.fat);
    const remainingCalories = Math.max(0, targets.calories - dayTotals.calories);

    const goal: Goal = targets.goal || "maintain";

    const entries = [
      {
        key: "protein" as const,
        remaining: remainingProtein,
        target: targets.proteinG || 1,
      },
      {
        key: "carbs" as const,
        remaining: remainingCarbs,
        target: targets.carbsG || 1,
      },
      {
        key: "fat" as const,
        remaining: remainingFat,
        target: targets.fatG || 1,
      },
    ];

    // If you're basically done, don't push food
    if (
      remainingCalories <= 80 &&
      remainingProtein <= 5 &&
      remainingCarbs <= 10 &&
      remainingFat <= 5
    ) {
      return {
        isClose: true,
        message: "You’re very close to today’s targets 🎉",
        remaining: {
          calories: remainingCalories,
          protein: remainingProtein,
          carbs: remainingCarbs,
          fat: remainingFat,
        },
        goal,
      };
    }

    // sort by relative gap (remaining / target)
    const sorted = entries
      .filter((e) => e.target > 0)
      .sort(
        (a, b) =>
          b.remaining / Math.max(1, b.target) -
          a.remaining / Math.max(1, a.target)
      );

    const focus = sorted[0];
    if (!focus || focus.remaining < 3) {
      // fallback – no strong missing macro
      return null;
    }

    let suggestionList: string[] = [];
    if (focus.key === "protein") {
      suggestionList = PROTEIN_SUGGESTIONS[goal];
    } else if (focus.key === "carbs") {
      suggestionList = CARB_SUGGESTIONS[goal];
    } else {
      suggestionList = FAT_SUGGESTIONS[goal];
    }

    const suggestion = pickRandom(suggestionList);

    return {
      isClose: false,
      focusMacro: focus.key,
      suggestion,
      remaining: {
        calories: remainingCalories,
        protein: remainingProtein,
        carbs: remainingCarbs,
        fat: remainingFat,
      },
      goal,
    };
  }, [targets, dayTotals]);

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
        <IonChip
          color="primary"
          style={{ marginBottom: 12 }}
          onClick={() => setShowMealPicker(true)}
        >
          <IonIcon icon={calendarOutline} />
          <span style={{ marginLeft: 6 }}>
            {friendlyDate} · {meal}
          </span>
        </IonChip>

        {/* 🔥 Smart recommendation card */}
        {targets && dayTotals && recommendation && (
          <IonCard style={{ marginBottom: 12 }}>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: 16 }}>
                Smart recommendation
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {recommendation.isClose ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: 6 }}>
                    {recommendation.message}
                  </p>
                  <IonText color="medium" style={{ fontSize: 13 }}>
                    Remaining today:{" "}
                    {Math.round(recommendation.remaining.calories)} kcal · Carbohydrates{" "}
                    {Math.round(recommendation.remaining.carbs)} g · Protein{" "}
                    {Math.round(recommendation.remaining.protein)} g · Fat{" "}
                    {Math.round(recommendation.remaining.fat)} g
                  </IonText>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0, marginBottom: 6 }}>
                    Based on your goal{" "}
                    <strong>{recommendation.goal}</strong> and what you’ve
                    already eaten today, you’re still missing some{" "}
                    <strong>{recommendation.focusMacro}</strong>.
                  </p>
                  {recommendation.suggestion && (
                    <p style={{ marginTop: 0, marginBottom: 6 }}>
                      For <strong>{meal}</strong> (or a snack) you could try:{" "}
                      <strong>{recommendation.suggestion}</strong>.
                    </p>
                  )}
                  <IonText color="medium" style={{ fontSize: 13 }}>
                    Remaining today:{" "}
                    {Math.round(recommendation.remaining.calories)} kcal · Carbohydrates{" "}
                    {Math.round(recommendation.remaining.carbs)} g · Protein{" "}
                    {Math.round(recommendation.remaining.protein)} g · Fat{" "}
                    {Math.round(recommendation.remaining.fat)} g
                  </IonText>
                </>
              )}
            </IonCardContent>
          </IonCard>
        )}

        <IonSegment
          value={tab}
          onIonChange={(e) => {
            const v = (e.detail.value as "search" | "favorites") || "search";
            setTab(v);
            trackEvent("add_food_tab_change", {
              tab: v,
              meal,
              date: dateKey,
            });
          }}
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
                debounce={0}
                onIonInput={(e) => setQuery(e.detail.value ?? "")}
                onKeyUp={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    trackEvent("food_search_enter_key", {
                      query: query.trim(),
                      meal,
                      date: dateKey,
                    });
                    foodsSearch(query.trim(), 1);
                  }
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
                onClick={() => {
                  if (!query.trim()) return;
                  trackEvent("food_search_button_click", {
                    query: query.trim(),
                    meal,
                    date: dateKey,
                  });
                  foodsSearch(query.trim(), 1);
                }}
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
                onClick={() => {
                  trackEvent("navigate_to_scan_barcode", {
                    meal,
                    date: dateKey,
                  });
                  history.push(`/scan-barcode?meal=${meal}&date=${dateKey}`);
                }}
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
                        trackEvent("recent_off_chip_click", {
                          id: r.id,
                          code: r.code,
                          name: r.name,
                        });
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
                    onClick={() => {
                      trackEvent("search_result_click", {
                        code: food.code,
                        name: food.product_name || "(no name)",
                      });
                      fetchFoodDetailsByCode(food.code);
                    }}
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
                            ? `${preview.calories || 0} kcal/100g · Carbohydrates ${
                                preview.carbs || 0
                              } g · Protein ${preview.protein || 0} g · Fat ${
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
                  onClick={() => {
                    trackEvent("food_search_page_prev", {
                      page,
                      query,
                    });
                    foodsSearch(query.trim(), page - 1);
                  }}
                >
                  Prev
                </IonButton>
                <IonButton
                  size="small"
                  disabled={loading}
                  onClick={() => {
                    trackEvent("food_search_page_next", {
                      page,
                      query,
                    });
                    foodsSearch(query.trim(), page + 1);
                  }}
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
                onClick={() => {
                  setShowCreateCustomFood(true);
                  trackEvent("custom_food_modal_open");
                }}
              >
                Create custom food
              </IonButton>
              <IonButton
                size="small"
                fill="outline"
                onClick={() => {
                  setShowCreateMealPreset(true);
                  trackEvent("meal_preset_modal_open");
                }}
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
                <strong>“Save this portion as a favorite”</strong> in the
                details dialog to store it here.
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
                          trackEvent("favorite_delete_prompt_open", {
                            favorite_id: fav.id,
                          });
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

        {/* DETAILS MODAL – works for ADD + EDIT */}
        <IonModal
          isOpen={open}
          onDidDismiss={() => {
            setOpen(false);
            trackEvent("food_details_modal_dismiss");
          }}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>{modalTitle}</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {editEntry || selectedFood ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  {selectedFood && (
                    <p
                      style={{
                        margin: 0,
                        opacity: 0.7,
                      }}
                    >
                      {selectedFood.brands ? `${selectedFood.brands}` : ""}
                      {selectedFood.brands && selectedFood.nutriscore_grade
                        ? " · "
                        : ""}
                      {selectedFood.nutriscore_grade
                        ? `Nutri-Score ${selectedFood.nutriscore_grade.toUpperCase()}`
                        : ""}
                    </p>
                  )}
                  <p
                    style={{
                      margin: "4px 0 0",
                      opacity: 0.8,
                    }}
                  >
                    {editEntry ? "Editing in" : "Adding to"}:{" "}
                    <strong>{meal}</strong> · {friendlyDate}
                  </p>
                </div>

                {!editEntry && selectedFood && (
                  <IonSegment
                    value={useServing ? "serving" : "weight"}
                    onIonChange={(e) => {
                      const val = e.detail.value;
                      const nextServing = val === "serving";
                      setUseServing(nextServing);
                      trackEvent("food_details_mode_change", {
                        mode: nextServing ? "serving" : "weight",
                      });
                    }}
                  >
                    <IonSegmentButton
                      value="serving"
                      disabled={
                        !selectedFood.serving_size || !hasServingMacros
                      }
                    >
                      <IonLabel>Serving</IonLabel>
                    </IonSegmentButton>
                    <IonSegmentButton value="weight" disabled={!has100gMacros}>
                      <IonLabel>Weight</IonLabel>
                    </IonSegmentButton>
                  </IonSegment>
                )}

                {showServingCard ? (
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
                      <IonText color="medium" style={{ fontSize: 12 }}>
                        {showServingCard
                          ? `${safeNum(
                              servingsQty,
                              1
                            )} × ${previewPerBaseLabel}`
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

                    {hasExtraNutrients && (
                      <IonGrid style={{ marginTop: 8 }}>
                        <IonRow>
                          {previewTotal.sugar !== undefined && (
                            <IonCol className="ion-text-center">
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.7,
                                }}
                              >
                                Sugars
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              >
                                {safeNum(previewTotal.sugar, 1)} g
                              </div>
                            </IonCol>
                          )}
                          {previewTotal.fiber !== undefined && (
                            <IonCol className="ion-text-center">
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.7,
                                }}
                              >
                                Fiber
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              >
                                {safeNum(previewTotal.fiber, 1)} g
                              </div>
                            </IonCol>
                          )}
                          {previewTotal.saturatedFat !== undefined && (
                            <IonCol className="ion-text-center">
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.7,
                                }}
                              >
                                Sat. fat
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              >
                                {safeNum(previewTotal.saturatedFat, 1)} g
                              </div>
                            </IonCol>
                          )}
                        </IonRow>
                        {previewTotal.salt !== undefined && (
                          <IonRow>
                            <IonCol className="ion-text-center">
                              <div
                                style={{
                                  fontSize: 12,
                                  opacity: 0.7,
                                }}
                              >
                                Salt
                              </div>
                              <div
                                style={{
                                  fontSize: 16,
                                  fontWeight: 600,
                                }}
                              >
                                {safeNum(previewTotal.salt, 2)} g
                              </div>
                            </IonCol>
                          </IonRow>
                        )}
                      </IonGrid>
                    )}
                  </IonCardContent>
                </IonCard>

                {!editEntry && selectedFood && (
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
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 16,
                  }}
                >
                  <IonButton
                    expand="block"
                    onClick={() => {
                      setOpen(false);
                      trackEvent("food_details_cancel");
                    }}
                    fill="outline"
                  >
                    Cancel
                  </IonButton>
                  <IonButton
                    expand="block"
                    onClick={addFoodToMeal}
                    disabled={disableAddButton}
                  >
                    {editEntry ? "Save changes" : `Add to ${meal}`}
                  </IonButton>
                </div>
              </>
            ) : (
              <IonText color="medium">No food selected.</IonText>
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
          onDidDismiss={() => {
            setShowCreateCustomFood(false);
            trackEvent("custom_food_modal_dismiss");
          }}
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
                onClick={() => {
                  setShowCreateCustomFood(false);
                  trackEvent("custom_food_modal_cancel");
                }}
              >
                Cancel
              </IonButton>
              <IonButton expand="block" onClick={createCustomFood}>
                Save custom food
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={showCreateMealPreset}
          onDidDismiss={() => {
            setShowCreateMealPreset(false);
            trackEvent("meal_preset_modal_dismiss");
          }}
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
                onClick={() => {
                  setShowCreateMealPreset(false);
                  trackEvent("meal_preset_modal_cancel");
                }}
              >
                Cancel
              </IonButton>
              <IonButton expand="block" onClick={createMealPreset}>
                Save custom meal
              </IonButton>
            </div>
          </IonContent>
        </IonModal>
        <IonActionSheet
          isOpen={showMealPicker}
          onDidDismiss={() => setShowMealPicker(false)}
          header="Select meal"
          buttons={[
            {
              text: "Breakfast",
              handler: () => handleChangeMeal("breakfast"),
            },
            {
              text: "Lunch",
              handler: () => handleChangeMeal("lunch"),
            },
            {
              text: "Dinner",
              handler: () => handleChangeMeal("dinner"),
            },
            {
              text: "Snacks",
              handler: () => handleChangeMeal("snacks"),
            },
            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default AddFood;
