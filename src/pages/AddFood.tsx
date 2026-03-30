import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  IonSelect,
  IonSelectOption,
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
  IonFooter,
} from "@ionic/react";

import { Keyboard } from "@capacitor/keyboard";
import { useLocation, useHistory } from "react-router";
import { auth, db, storage, trackEvent } from "../firebase";
import { getCurrentUser } from "../utils/demoAuth";
import { isFeatureEnabled, useRemoteConfig } from "../UpdateGate";
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
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useDemoFirestore } from "../hooks/useDemoFirestore";

import { calendarOutline, starOutline, trashOutline, cameraOutline, sparklesOutline } from "ionicons/icons";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  recognizeFood,
  matchFoodToDatabase,
} from "../utils/foodRecognition";
import {
  clampDateKeyToToday,
  formatDateKey,
  isDateKey,
  todayDateKey,
  shiftDateKey,
} from "../utils/date";
import { handleError } from "../utils/handleError";
import { computeGenericFoodBoost } from "../utils/genericFoodBoosts";
import basicFoods from "../data/basicFoods.json";
import "./AddFood.css";

// Import Swiper for swipeable nutrition pages
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

type OFFNutriments = {
  ["energy-kcal_100g"]?: number;
  ["energy-kcal_serving"]?: number;
  ["proteins_100g"]?: number;
  ["proteins_serving"]?: number;
  ["fat_100g"]?: number;
  ["fat_serving"]?: number;
  ["carbohydrates_100g"]?: number;
  ["carbohydrates_serving"]?: number;
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
  // Vitamins
  ["vitamin-a_100g"]?: number;
  ["vitamin-c_100g"]?: number;
  ["vitamin-d_100g"]?: number;
  ["vitamin-e_100g"]?: number;
  ["vitamin-k_100g"]?: number;
  ["vitamin-b1_100g"]?: number;
  ["vitamin-b2_100g"]?: number;
  ["vitamin-b6_100g"]?: number;
  ["vitamin-b12_100g"]?: number;
  ["vitamin-b9_100g"]?: number;
  ["folates_100g"]?: number;
  ["niacin_100g"]?: number;
  ["pantothenic-acid_100g"]?: number;
  ["biotin_100g"]?: number;
  // Minerals
  ["calcium_100g"]?: number;
  ["iron_100g"]?: number;
  ["magnesium_100g"]?: number;
  ["phosphorus_100g"]?: number;
  ["potassium_100g"]?: number;
  ["zinc_100g"]?: number;
  ["copper_100g"]?: number;
  ["manganese_100g"]?: number;
  ["selenium_100g"]?: number;
  ["iodine_100g"]?: number;
  // Other
  ["cholesterol_100g"]?: number;
  ["trans-fat_100g"]?: number;
  ["polyunsaturated-fat_100g"]?: number;
  ["monounsaturated-fat_100g"]?: number;
  ["omega-3-fat_100g"]?: number;
  ["omega-6-fat_100g"]?: number;
  ["caffeine_100g"]?: number;
  ["alcohol_100g"]?: number;
};

type OFFSearchHit = {
  code: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  image_front_url?: string | null;
  nutriscore_grade?: string | null;
  nutriments?: OFFNutriments;
  dataSource?: "local" | "openfoodfacts";
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
  sugar?: number;
  fiber?: number;
  saturatedFat?: number;
  salt?: number;
  sodium?: number;
};

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";
const MEAL_ORDER: MealKey[] = ["breakfast", "lunch", "dinner", "snacks"];
const createEmptyMealCounts = (): Record<MealKey, number> => ({
  breakfast: 0,
  lunch: 0,
  dinner: 0,
  snacks: 0,
});

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
  code?: string | null;
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
  photoUrl?: string;
  photoName?: string;
  amount?: number;
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
  smartRecommendationEnabled?: boolean;
  showRecentItems?: boolean;
  showRecentSearches?: boolean;
};

const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

// Timing constants for UI debouncing and delays
const FAVORITES_LOAD_DELAY_MS = 300;
const RECENT_FOODS_LOAD_DELAY_MS = 500;
const MEAL_PRESETS_LOAD_DELAY_MS = 700;
const SEARCH_DEBOUNCE_MS = 300;
const SCROLL_TO_TOP_DELAY_MS = 700;

// Validation constants for custom food creation
const MAX_CALORIES = 10000;
const MAX_MACRONUTRIENT_GRAMS = 1000;

const BASIC_FOODS: OFFSearchHit[] = basicFoods as OFFSearchHit[];
const BASIC_FOODS_BY_CODE = new Map(
  BASIC_FOODS.map((food) => [food.code, food])
);


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
    salt: base.salt !== undefined ? safeNum(base.salt * qty, 2) : undefined,
    sodium:
      base.sodium !== undefined ? safeNum(base.sodium * qty, 2) : undefined,
  };
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v;
  });
  return out as T;
}

function useMealFromQuery(location: ReturnType<typeof useLocation>): MealKey {
  const params = new URLSearchParams(location.search);
  const m = (params.get("meal") || "breakfast").toLowerCase();
  return MEAL_ORDER.includes(m as MealKey) ? (m as MealKey) : "breakfast";
}

function useDateFromQuery(location: ReturnType<typeof useLocation>): string {
  const params = new URLSearchParams(location.search);
  const d = params.get("date");
  if (isDateKey(d)) {
    return clampDateKeyToToday(d!);
  }
  return todayDateKey();
}

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
  maintain: ["Nuts & seeds mix", "Avocado + eggs on toast", "Cheese with whole-grain crackers"],
  gain: [
    "Peanut butter sandwich",
    "Trail mix (nuts + dried fruit + chocolate)",
    "Cheese and salami with bread",
  ],
};

const MIN_RESULTS_VISIBILITY_PX = 120;
const RESULTS_VISIBILITY_RATIO = 0.5;
const RESULTS_SCROLL_OFFSET = 96;

function pickRandom(list: string[]): string {
  if (!list.length) return "";
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

const AddFood: React.FC = () => {
  const location = useLocation();
  const history = useHistory();
  const { arrayUnionField } = useDemoFirestore();
  const [meal, setMeal] = useState<MealKey>(useMealFromQuery(location));
  const dateKey = useDateFromQuery(location);
  const remoteConfig = useRemoteConfig();
  const barcodeScannerEnabled = isFeatureEnabled(remoteConfig, "barcodeScanner");
  const autoMealFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get("autoMeal");
    return value === "1" || value === "true";
  }, [location.search]);
  const quickAddFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get("quickAdd");
    return value === "1" || value === "true";
  }, [location.search]);
  const hasMealInQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mealParam = (params.get("meal") || "").toLowerCase();
    return MEAL_ORDER.includes(mealParam as MealKey);
  }, [location.search]);
  const shouldShowMealSelection = quickAddFromQuery || !hasMealInQuery;
  const autoMealPendingRef = useRef<boolean>(autoMealFromQuery);
  useEffect(() => {
    autoMealPendingRef.current = autoMealFromQuery;
  }, [autoMealFromQuery]);
  const pickFirstEmptyMeal = useCallback(
    (counts: Record<MealKey, number>) => {
      for (const key of MEAL_ORDER) {
        if ((counts[key] ?? 0) === 0) return key;
      }
      return "snacks";
    },
    []
  );

  const RECENT_QUERY_KEY = "mp_add_food_recent_queries";
  const RECENT_QUERY_LIMIT = 10;

  const [showMealPicker, setShowMealPicker] = useState(false);
  const [tab, setTab] = useState<"search" | "favorites">("search");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [noMoreResults, setNoMoreResults] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<OFFProduct | null>(null);
  const [foodDetailLoading, setFoodDetailLoading] = useState<string | null>(null);
  const [useServing, setUseServing] = useState<boolean>(false);
  const [servingsQty, setServingsQty] = useState<number>(1);
  const [weightQty, setWeightQty] = useState<number>(100);
  const [addingFood, setAddingFood] = useState(false);
  const [recent, setRecent] = useState<RecentFood[]>([]);
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoriteToDelete, setFavoriteToDelete] = useState<FavoriteFood | null>(
    null
  );
  const [mealPresetToDelete, setMealPresetToDelete] =
    useState<CustomMealPreset | null>(null);

  const [recentFoods, setRecentFoods] = useState<DiaryEntryDoc[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  const [mealPresets, setMealPresets] = useState<CustomMealPreset[]>([]);
  const [mealPresetsLoading, setMealPresetsLoading] = useState(false);

  const [editEntry, setEditEntry] = useState<{
    meal: MealKey;
    index: number;
    item: DiaryEntryDoc;
  } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [photoRemoved, setPhotoRemoved] = useState(false);

  // AI Photo Recognition state
  const [isAiPhotoAnalyzing, setAiPhotoAnalyzing] = useState(false);
  const [aiPhotoDataUrl, setAiPhotoDataUrl] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<any[]>([]);

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

  const [showSmartRecommendation, setShowSmartRecommendation] = useState(true);
  const [showRecentItemsEnabled, setShowRecentItemsEnabled] = useState(true);
  const [showRecentSearchesEnabled, setShowRecentSearchesEnabled] =
    useState(true);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, OFFSearchHit[]>>(new Map());
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLIonInputElement | null>(null);
  const contentRef = useRef<HTMLIonContentElement | null>(null);
  const resultsListRef = useRef<HTMLIonListElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const prevResultsLengthRef = useRef<number>(0);
  const prevResultsKeyRef = useRef<string | null>(null);
  const forceResultsScrollRef = useRef<boolean>(false);

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

  useEffect(() => {
    if (!editEntry) {
      setPhotoPreview(null);
      setPhotoName("");
      setPhotoRemoved(false);
    }
  }, [selectedFood, editEntry]);

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

  const showRecent = useMemo(() => {
    const q = query.trim();
    if (!q) return true;
    if (!loading && results.length === 0) return true;
    return false;
  }, [query, loading, results.length]);

  useEffect(() => {
    trackEvent("add_food_screen_view", { meal, date: dateKey });
  }, [meal, dateKey]);

  useEffect(() => {
    const user = getCurrentUser();
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

        setShowSmartRecommendation(
          typeof p.smartRecommendationEnabled === "boolean"
            ? p.smartRecommendationEnabled
            : true
        );

        setShowRecentItemsEnabled(
          typeof p.showRecentItems === "boolean" ? p.showRecentItems : true
        );

        setShowRecentSearchesEnabled(
          typeof p.showRecentSearches === "boolean" ? p.showRecentSearches : true
        );

        trackEvent("add_food_profile_targets_loaded", {
          uid: user.uid,
          calories: p.caloriesTarget,
        });
      } catch (error: unknown) {
        const e = error as Error;
        const msg = handleError("add_food_profile_targets", e);
        trackEvent("add_food_profile_targets_error", {
          message: e?.message || String(e),
        });
        setToast({
          show: true,
          message: msg,
          color: "danger",
        });
      }
    })();
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    const ref = doc(db, "users", user.uid, "foods", dateKey);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          const emptyCounts = createEmptyMealCounts();
          if (autoMealPendingRef.current) {
            const nextMeal = pickFirstEmptyMeal(emptyCounts);
            if (meal !== nextMeal) {
              setMeal(nextMeal);
            }
            const params = new URLSearchParams(location.search);
            params.delete("autoMeal");
            params.set("meal", nextMeal);
            history.replace({
              pathname: "/add-food",
              search: params.toString() ? `?${params}` : "",
            });
            autoMealPendingRef.current = false;
          }
          setDayTotals({
            calories: 0,
            protein: 0,
            fat: 0,
            carbs: 0,
          });
          return;
        }

        const data = snap.data() as DayDoc;
        const counts = createEmptyMealCounts();
        let calories = 0;
        let protein = 0;
        let fat = 0;
        let carbs = 0;

        MEAL_ORDER.forEach((mealKey) => {
          const arr = Array.isArray(data[mealKey]) ? data[mealKey] : [];
          counts[mealKey] = arr.length;
          arr.forEach((item) => {
            const t = item.total;
            if (!t) return;
            calories += Number(t.calories || 0);
            carbs += Number(t.carbs || 0);
            protein += Number(t.protein || 0);
            fat += Number(t.fat || 0);
          });
        });

        setDayTotals({ calories, protein, fat, carbs });
        if (autoMealPendingRef.current) {
          const nextMeal = pickFirstEmptyMeal(counts);
          if (meal !== nextMeal) {
            setMeal(nextMeal);
          }
          const params = new URLSearchParams(location.search);
          params.delete("autoMeal");
          params.set("meal", nextMeal);
          history.replace({
            pathname: "/add-food",
            search: params.toString() ? `?${params}` : "",
          });
          autoMealPendingRef.current = false;
        }
      },
      (err) => {
        const msg = handleError("add_food_day_totals", err);
        trackEvent("add_food_day_totals_error", {
          message: err?.message || String(err),
        });
        setToast({
          show: true,
          message: msg,
          color: "danger",
        });
      }
    );

    return () => unsub();
  }, [dateKey, history, location.search, meal, pickFirstEmptyMeal]);

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
          // When offline, skip remote barcode lookup and fall back to local search
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            const localMatch = BASIC_FOODS_BY_CODE.get(code);
            if (localMatch) {
              const ps = macrosPerServing(localMatch.nutriments);
              const canServing =
                !!localMatch.serving_size &&
                !!(ps.calories || ps.carbs || ps.protein || ps.fat);
              setSelectedFood({ ...localMatch, dataSource: "local" });
              setUseServing(canServing);
              setServingsQty(1);
              setWeightQty(100);
              setOpen(true);
            } else {
              setToast({
                show: true,
                message: "You're offline — showing local search.",
                color: "warning",
              });
              setQuery(code);
              await foodsSearch(code, 1);
            }
            cleanUrl();
            return;
          }

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
        } catch (error: unknown) {
          const e = error as Error;
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
            count > 0 ? "Item found!" : "Item not found — try refining search.",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- foodsSearch is intentionally excluded to prevent re-running on every render
  }, [location.search, history, meal, dateKey]);

  const ensureResultsVisible = useCallback(async () => {
    const firstResult = results[0];
    const firstKey = firstResult?.code || firstResult?.product_name || null;
    const changed =
      results.length !== prevResultsLengthRef.current || firstKey !== prevResultsKeyRef.current;
    const shouldForce = forceResultsScrollRef.current;
    if (results.length > 0 && (changed || shouldForce)) {
      const listEl = resultsListRef.current as HTMLElement | null;
      const contentEl = await contentRef.current?.getScrollElement();
      if (listEl && contentEl) {
        const listRect = listEl.getBoundingClientRect();
        const scrollRect = contentEl.getBoundingClientRect();
        const visibleHeight = Math.min(listRect.bottom, scrollRect.bottom) - Math.max(listRect.top, scrollRect.top);
        const alreadyInView =
          visibleHeight >= Math.min(listRect.height * RESULTS_VISIBILITY_RATIO, MIN_RESULTS_VISIBILITY_PX);
        if (!alreadyInView) {
          // Leave space (RESULTS_SCROLL_OFFSET) for the upper bar (header, search, buttons, etc.)
          const targetTop = Math.max(listEl.offsetTop - RESULTS_SCROLL_OFFSET, 0);
          requestAnimationFrame(() => {
            void contentRef.current?.scrollToPoint(0, targetTop, 350);
          });
        }
      }
    }
    prevResultsLengthRef.current = results.length;
    prevResultsKeyRef.current = firstKey;
    forceResultsScrollRef.current = false;
  }, [results]);

  useEffect(() => {
    if (!loading) {
      void ensureResultsVisible();
    }
  }, [ensureResultsVisible, loading, results]);

  useEffect(() => {
    const state = (location as { state?: {
      editEntry?: {
        id: string;
        date: string;
        meal: MealKey;
        entry: DiaryEntryDoc;
      };
      copyEntry?: DiaryEntryDoc;
      photoInfo?: { photoUrl: string; photoName: string };
    } }).state as
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
    setPhotoPreview(typeof item.photoUrl === "string" ? item.photoUrl : null);
    setPhotoName(typeof item.photoName === "string" ? item.photoName : "");
    setPhotoRemoved(false);

    const sel = item.selection || {};
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

  // Defer favorites loading to avoid congestion on mobile
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    // Delay loading favorites by 300ms to prioritize critical data
    const timer = setTimeout(() => {
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
    }, FAVORITES_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  // Defer recent foods loading to avoid congestion on mobile
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;

    // Delay loading recent foods by 500ms
    const timer = setTimeout(() => {
      const ref = collection(db, "users", user.uid, "recentFoods");
      const q = fsQuery(ref, orderBy("lastUsedAt", "desc"), limit(10));

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list: RecentFood[] = snap.docs.map((d) => {
            const data = d.data() as Omit<RecentFood, "id">;
            return { id: d.id, ...data };
          });
          setRecent(list);
          trackEvent("recent_off_loaded", {
            uid: user.uid,
            count: list.length,
          });
        },
        (err) => {
          console.error("Error loading recent foods:", err);
          trackEvent("recent_foods_load_error", {
            uid: user.uid,
            error: err?.message || String(err),
          });
        }
      );

      return () => unsub();
    }, RECENT_FOODS_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
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

        collected.sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""));

        const seen = new Set<string>();
        const unique: DiaryEntryDoc[] = [];
        for (const it of collected) {
          const key = `${(it.name || "").toLowerCase()}|${(it.brand || "").toLowerCase()}`;
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
      } catch (error: unknown) {
        const e = error as Error;
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

  // Defer meal presets loading to avoid congestion on mobile
  useEffect(() => {
    const user = getCurrentUser();
    if (!user) return;
    
    // Delay loading meal presets by 700ms
    const timer = setTimeout(() => {
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
    }, MEAL_PRESETS_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_QUERY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((q) => typeof q === "string")
            .slice(0, RECENT_QUERY_LIMIT);
          setRecentQueries(cleaned);
        }
      }
    } catch (e) {
      console.warn("Failed to load recent queries", e);
    }
  }, []);

  const normalizeText = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();

  const tokenize = (text: string) => normalizeText(text).split(" ").filter(Boolean);

  const expandToken = (token: string): string[] => {
    const t = token.trim().toLowerCase();
    const variants = new Set<string>();
    if (!t) return [];
    variants.add(t);
    if (t.endsWith("s") && t.length > 3) variants.add(t.slice(0, -1));
    if (t.endsWith("es") && t.length > 4) variants.add(t.slice(0, -2));
    if (t.endsWith("ies") && t.length > 4) variants.add(t.slice(0, -3) + "y");
    return Array.from(variants);
  };

  const countTokenMatches = (hay: string, tokenVariants: string[][]) => {
    let matched = 0;
    for (const variants of tokenVariants) {
      if (variants.some((v) => hay.includes(v))) matched++;
    }
    return matched;
  };

  const looksLikeRecipeOrSpecific = (nameNorm: string) =>
    /\b(with|and|recipe|recipes|flavor|flavoured|flavored|sauce|mix|salad|cookies|cake|bar|drink|juice|smoothie|ketchup|spread|chocolate)\b/i.test(
      nameNorm
    );

  const recordRecentQuery = (text: string) => {
    const normalized = normalizeText(text);
    if (!normalized) return;
    setRecentQueries((prev) => {
      const next = [normalized, ...prev.filter((q) => q !== normalized)].slice(
        0,
        RECENT_QUERY_LIMIT
      );
      try {
        localStorage.setItem(RECENT_QUERY_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn("Failed to persist recent queries", e);
      }
      return next;
    });
  };

  const clearRecentQueries = () => {
    console.log(`[USER ACTION] AddFood: Clear recent searches clicked`);
    setRecentQueries([]);
    localStorage.removeItem(RECENT_QUERY_KEY);
    trackEvent("recent_queries_cleared");
  };

  const hideKeyboard = useCallback(async () => {
    try {
      await Keyboard.hide();
    } catch (err) {
      console.warn("Keyboard hide failed", err);
    }
    if (searchInputRef.current?.getInputElement) {
      try {
        const el = await searchInputRef.current.getInputElement();
        el?.blur();
      } catch (err) {
        console.warn("Input blur failed", err);
      }
    }
  }, []);

  const foodsSearch = async (q: string, pageNumber = 1): Promise<number> => {
    const raw = (q || "").trim();
    if (!raw) return 0;

    if (raw.length < 2) {
      setToast({
        show: true,
        message: "Type at least 2 characters to search.",
        color: "medium",
      });
      return 0;
    }
    forceResultsScrollRef.current = true;

    if (pageNumber === 1) {
      setNoMoreResults(false);
    }

    const normalizedQuery = normalizeText(raw);
    const queryTokens = tokenize(raw);
    const expandedTokens = queryTokens.map(expandToken);
    const tokenCount = queryTokens.length;

    const cacheKey = `${normalizedQuery}|${pageNumber}`;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached) {
      setResults(cached);
      setPage(pageNumber);
      return cached.length;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setLoading(true);

    trackEvent("food_search_start", {
      query: raw,
      page: pageNumber,
      meal,
      date: dateKey,
    });

    const computeGenericBoost = (food: OFFSearchHit) => {
      const nameNorm = normalizeText(food.product_name || "");
      const brandNorm = normalizeText(food.brands || "");
      let boost = 0;

      if (nameNorm === normalizedQuery && !brandNorm) boost += 450;
      if (!brandNorm) boost += 120;

      const nTokens = tokenize(nameNorm).length;
      if (nTokens <= 3) boost += 50;
      else if (nTokens <= 5) boost += 15;

      if (/\b(\d+\s*x\s*\d+|\dx)\b/.test(nameNorm)) boost -= 25;
      if (/\b\d+\s*(kg|g|ml|l)\b/.test(nameNorm)) boost -= 10;

      return boost;
    };

    const scoreFood = (food: OFFSearchHit) => {
      const nameRaw = food.product_name || "";
      const brandRaw = food.brands || "";
      const nameNorm = normalizeText(nameRaw);
      const brandNorm = normalizeText(brandRaw);
      const combined = `${nameNorm} ${brandNorm}`.trim();

      if (!combined) return { food, score: -9999, matched: 0, required: 0 };

      const matched = countTokenMatches(combined, expandedTokens);
      const required =
        tokenCount <= 1 ? 1 : tokenCount <= 3 ? Math.min(2, tokenCount) : 3;

      let score = 0;

      if (nameNorm === normalizedQuery) score += 1400;
      else if (nameNorm.startsWith(normalizedQuery)) score += 1100;
      else if (combined.includes(normalizedQuery)) score += 800;

      score += matched * 180;
      if (tokenCount > 0) score += (matched / tokenCount) * 120;

      score -= tokenize(nameNorm).length * 2;

      if (looksLikeRecipeOrSpecific(nameNorm) && tokenCount <= 2) score -= 220;

      score += computeGenericFoodBoost(nameNorm, brandNorm);
      score += computeGenericBoost(food);

      return { food, score, matched, required };
    };

    const localFoods = BASIC_FOODS.map((food) => ({
      ...food,
      dataSource: "local" as const,
    }));

    const localScored = localFoods.map(scoreFood);
    let localKept = localScored;
    if (tokenCount > 0) {
      localKept = localScored.filter((x) => x.matched >= x.required);
    }
    if (tokenCount > 0 && localKept.length < 5) {
      localKept = localScored.filter((x) => x.matched >= 1);
    }
    localKept.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const an = (a.food.product_name || "").toLowerCase();
      const bn = (b.food.product_name || "").toLowerCase();
      return an.localeCompare(bn);
    });
    const localResults = localKept.map((item) => item.food);

    try {
      // When offline, skip the remote API and return only local results
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setResults(localResults);
        setPage(pageNumber);
        setNoMoreResults(true);
        searchCacheRef.current.set(cacheKey, localResults);
        recordRecentQuery(raw);
        if (localResults.length === 0) {
          setToast({
            show: true,
            message: "No offline results found. Try a different search.",
            color: "medium",
          });
        }
        return localResults.length;
      }

      const url = new URL(`${FN_BASE}/offSearch`);
      url.searchParams.set("q", raw);
      url.searchParams.set("page", String(pageNumber));
      url.searchParams.set("page_size", "20");

      const res = await fetch(url.toString(), { signal: controller.signal });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);

      const data: OFFSearchResponse = await res.json();
      const foods = Array.isArray(data?.products) ? data.products : [];

      const macroFiltered = foods.filter((food) => {
        const preview = macrosPer100g(food.nutriments);
        return (
          (preview.calories ?? 0) > 0 ||
          (preview.carbs ?? 0) > 0 ||
          (preview.protein ?? 0) > 0 ||
          (preview.fat ?? 0) > 0
        );
      });

      const scored = macroFiltered.map(scoreFood);

      let kept = scored;
      if (tokenCount > 0) {
        kept = scored.filter((x) => x.matched >= x.required);
      }

      if (tokenCount > 0 && kept.length < 5) {
        kept = scored.filter((x) => x.matched >= 1);
      }

      kept.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const an = (a.food.product_name || "").toLowerCase();
        const bn = (b.food.product_name || "").toLowerCase();
        return an.localeCompare(bn);
      });

      const deduped: OFFSearchHit[] = [];
      const seen = new Set<string>();
      if (pageNumber === 1) {
        for (const item of localResults) {
          const f = item;
          const key = f.code || `${f.product_name || ""}|${f.brands || ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          deduped.push(f);
        }
      }
      for (const item of kept) {
        const f = item.food;
        const key = f.code || `${f.product_name || ""}|${f.brands || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(f);
      }

      // Determine if there are more pages based on API total count
      const hasMorePages = typeof data.count === 'number'
        ? pageNumber * 20 < data.count
        : foods.length >= 20;

      // If navigating forward and got no new results, stay on current page
      if (pageNumber > 1 && deduped.length === 0) {
        setNoMoreResults(true);
        return 0;
      }

      setResults(deduped);
      setPage(pageNumber);
      setNoMoreResults(!hasMorePages);

      searchCacheRef.current.set(cacheKey, deduped);

      recordRecentQuery(raw);

      if (deduped.length === 0) {
        setToast({
          show: true,
          message: "No results found. Try refining your search.",
          color: "medium",
        });
      }

      trackEvent("food_search_success", {
        query: raw,
        page: pageNumber,
        count: deduped.length,
      });

      return deduped.length;
    } catch (error: unknown) {
      const e = error as Error & { name?: string };
      if (e?.name === "AbortError") return 0;

      const msg = handleError("food_search", e);
      setToast({
        show: true,
        message: msg,
        color: "danger",
      });

      trackEvent("food_search_error", {
        query: raw,
        page: pageNumber,
        error: e?.message || String(e),
      });

      return 0;
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      setLoading(false);
    }
  };

  const fetchFoodDetailsByCode = async (code: string) => {
    trackEvent("food_details_by_code_start", {
      code,
      meal,
      date: dateKey,
    });

    setFoodDetailLoading(code);

    const localMatch = BASIC_FOODS_BY_CODE.get(code);
    if (localMatch) {
      setSelectedFood({ ...localMatch, dataSource: "local" });
      setUseServing(false);
      setServingsQty(1);
      setWeightQty(100);
      setOpen(true);
      setFoodDetailLoading(null);
      trackEvent("food_details_by_code_success", {
        code,
        hasServing: false,
        source: "local",
      });
      return;
    }

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setToast({
          show: true,
          message: "You're offline. Food details are only available for locally stored foods.",
          color: "warning",
        });
        return;
      }

      const r = await fetch(
        `${FN_BASE}/offBarcode?code=${encodeURIComponent(code)}`
      );
      if (!r.ok) throw new Error(`Details failed: ${r.status}`);
      const data: OFFBarcodeResponse = await r.json();
      if ("status" in data && data.status === 1) {
        const p = data.product;
        const ps = macrosPerServing(p.nutriments);
        const canServing =
          !!p.serving_size && !!(ps.calories || ps.carbs || ps.protein || ps.fat);
        setSelectedFood({ ...p, dataSource: "openfoodfacts" });
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
    } catch (error: unknown) {
      const e = error as Error;
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
    } finally {
      setFoodDetailLoading(null);
    }
  };

  const takeAiPhoto = async () => {
    try {
      console.log('[AI Photo] Starting photo capture...');
      trackEvent("ai_photo_camera_open", { meal, date: dateKey });
      
      // Check if PWA elements are available
      if (typeof window !== 'undefined' && !customElements.get('pwa-camera-modal')) {
        console.error('[AI Photo] PWA camera modal not registered');
        setToast({
          show: true,
          message: "Camera not available. Please refresh the page and try again.",
          color: "danger",
        });
        return;
      }
      
      let photo;

      try {
        photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });
      } catch (err) {
        const errorMessage = String(err);
        const isPwaCameraModalError = errorMessage.includes('$instanceValues$') || errorMessage.includes('facingMode');

        if (!isPwaCameraModalError) {
          throw err;
        }

        console.warn('[AI Photo] PWA camera modal failed; retrying with browser file input fallback', err);
        trackEvent('ai_photo_camera_fallback_web_input', { meal, date: dateKey, error: errorMessage });

        photo = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          webUseInput: true,
        });
      }

      if (photo?.dataUrl) {
        setAiPhotoDataUrl(photo.dataUrl);
        await analyzeAiPhoto(photo.dataUrl);
      }
    } catch (err) {
      console.error("Error taking AI photo:", err);
      
      // Check if user simply cancelled - don't show error for that
      const errorMessage = String(err);
      if (errorMessage.includes("User cancelled") || errorMessage.includes("cancel")) {
        trackEvent("ai_photo_camera_cancelled", { meal, date: dateKey });
        return;
      }
      
      setToast({
        show: true,
        message: "Failed to open the camera. Please try again or refresh the page.",
        color: "danger",
      });
      trackEvent("ai_photo_camera_error", { meal, date: dateKey, error: String(err) });
    }
  };

  const analyzeAiPhoto = async (photoDataUrl: string) => {
    setAiPhotoAnalyzing(true);
    setAiMatches([]);

    try {
      trackEvent("ai_photo_analyze_start", { meal, date: dateKey });

      const result = await recognizeFood(
        photoDataUrl,
        false, // Don't use Google Vision by default
        import.meta.env.VITE_GOOGLE_VISION_API_KEY
      );

      if (result.success && result.predictions.length > 0) {
        // Match predictions to food database
        const matches = matchFoodToDatabase(result.predictions, basicFoods as any[]);
        const validMatches = matches.filter(m => m.matches.length > 0);
        
        setAiMatches(validMatches);
        
        // If we have matches, automatically select the top match
        if (validMatches.length > 0 && validMatches[0].matches.length > 0) {
          const topMatch = validMatches[0].matches[0];
          // Convert to OFFProduct format and open modal
          const offProduct = {
            ...topMatch,
            product_name: topMatch.product_name,
            dataSource: "ai_recognition" as const,
          };
          setSelectedFood(offProduct as any);
          setOpen(true);
          
          trackEvent("ai_photo_analyze_success", {
            meal,
            date: dateKey,
            predictionsCount: result.predictions.length,
            matchesCount: validMatches.length,
            topFood: topMatch.product_name,
          });
        } else {
          setToast({
            show: true,
            message: "No food matches found. Try manual search or a different photo.",
            color: "warning",
          });
          trackEvent("ai_photo_no_matches", { meal, date: dateKey });
        }
      } else {
        setToast({
          show: true,
          message: result.error || "No food items detected. Try a different photo or angle.",
          color: "warning",
        });
        trackEvent("ai_photo_analyze_no_results", { meal, date: dateKey });
      }
    } catch (err) {
      console.error("Error analyzing AI photo:", err);
      setToast({
        show: true,
        message: "Failed to analyze photo. Please try again.",
        color: "danger",
      });
      trackEvent("ai_photo_analyze_error", { meal, date: dateKey, error: String(err) });
    } finally {
      setAiPhotoAnalyzing(false);
    }
  };

  const computeCurrentSelection = () => {
    if (!selectedFood) return null;

    const useServingMode = useServing && selectedFood.serving_size && hasServingMacros;
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

    const total = stripUndefined(scale(perBase, factor));

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

  const handlePhotoChange = useCallback((file?: File | null) => {
    console.log(`[USER ACTION] AddFood: Photo file selected`, { fileType: file?.type, fileSize: file?.size });
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setPhotoPreview(result);
        setPhotoName(file.name || "food-photo");
        setPhotoRemoved(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const clearPhoto = useCallback(() => {
    console.log(`[USER ACTION] AddFood: Remove photo button clicked`);
    setPhotoPreview(null);
    setPhotoName("");
    setPhotoRemoved(true);
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  }, []);

  const uploadPhotoToStorage = useCallback(async (base64Data: string, fileName: string): Promise<string | null> => {
    try {
      const user = getCurrentUser();
      if (!user) return null;

      // Convert base64 to blob
      const base64Response = await fetch(base64Data);
      const blob = await base64Response.blob();

      // Create a unique filename
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `users/${user.uid}/food-photos/${timestamp}_${sanitizedFileName}`;
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, blob);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      trackEvent("photo_uploaded_to_storage", {
        uid: user.uid,
        fileName: sanitizedFileName,
        size: blob.size,
      });
      
      return downloadURL;
    } catch (error) {
      console.error("Error uploading photo to storage:", error);
      trackEvent("photo_upload_error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }, []);

  const addFoodToMeal = async () => {
    console.log(`[USER ACTION] AddFood: Add/Save food to meal clicked`, { meal, editMode: !!editEntry });
    const user = getCurrentUser();
    if (!user) return;

    if (addingFood) return;
    setAddingFood(true);

    try {
      if (editEntry) {
        const { meal: mealKey, index, item } = editEntry;
        const sel = item.selection || {};
        const base = item.base || null;

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
              : typeof item.amount === "number" && item.amount > 0
              ? item.amount
              : 100;
          newValue = Math.max(1, weightQty);
        }

        if (!oldValue || oldValue <= 0) oldValue = mode === "serving" ? 1 : 100;
        const ratio = newValue / oldValue;

        const oldTotal = (item.total || {}) as MacroSet;
        const newTotalRaw: MacroSet = {
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

        const newTotal = stripUndefined(newTotalRaw);

        const newSel = {
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

        // Upload photo to Storage if it's a new base64 photo
        let finalPhotoUrl = photoRemoved ? null : (item.photoUrl ?? null);
        let finalPhotoName = photoRemoved ? null : (item.photoName || null);
        
        if (photoPreview && photoPreview.startsWith('data:')) {
          // This is a new base64 photo that needs to be uploaded
          const uploadedUrl = await uploadPhotoToStorage(photoPreview, photoName || 'food-photo.jpg');
          if (uploadedUrl) {
            finalPhotoUrl = uploadedUrl;
            finalPhotoName = photoName || 'food-photo.jpg';
          } else {
            // Upload failed, show warning but continue
            console.warn("Photo upload failed, meal will be saved without photo");
            setToast({
              show: true,
              message: "Photo upload failed. Meal saved without photo.",
              color: "warning",
            });
            finalPhotoUrl = null;
            finalPhotoName = null;
          }
        } else if (photoPreview) {
          // This is an existing URL from Firebase Storage
          finalPhotoUrl = photoPreview;
          finalPhotoName = photoName;
        }

        const updated: DiaryEntryDoc = {
          ...item,
          total: newTotal,
          selection: newSel,
          photoUrl: finalPhotoUrl ?? undefined,
          photoName: finalPhotoName ?? undefined,
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

      const perBaseClean = stripUndefined({
        calories: safeNum(perBase.calories, 0),
        carbs: safeNum(perBase.carbs, 2),
        protein: safeNum(perBase.protein, 2),
        fat: safeNum(perBase.fat, 2),
        sugar: perBase.sugar !== undefined ? safeNum(perBase.sugar, 2) : undefined,
        fiber: perBase.fiber !== undefined ? safeNum(perBase.fiber, 2) : undefined,
        saturatedFat:
          perBase.saturatedFat !== undefined
            ? safeNum(perBase.saturatedFat, 2)
            : undefined,
        salt: perBase.salt !== undefined ? safeNum(perBase.salt, 2) : undefined,
        sodium: perBase.sodium !== undefined ? safeNum(perBase.sodium, 2) : undefined,
      } as MacroSet);

      const totalClean = stripUndefined(total);

      // Upload photo to Storage if it's a base64 photo
      let finalPhotoUrl: string | null = null;
      let finalPhotoName: string | null = null;
      
      if (photoPreview && photoPreview.startsWith('data:')) {
        // This is a base64 photo that needs to be uploaded
        const uploadedUrl = await uploadPhotoToStorage(photoPreview, photoName || 'food-photo.jpg');
        if (uploadedUrl) {
          finalPhotoUrl = uploadedUrl;
          finalPhotoName = photoName || 'food-photo.jpg';
        } else {
          // Upload failed, show warning but continue
          console.warn("Photo upload failed, meal will be saved without photo");
          setToast({
            show: true,
            message: "Photo upload failed. Meal saved without photo.",
            color: "warning",
          });
        }
      }

      const item = {
        code: selectedFood.code,
        name: selectedFood.product_name || "(no name)",
        brand: selectedFood.brands || null,
        dataSource: selectedFood.dataSource ?? "openfoodfacts",
        base: baseMeta,
        selection: {
          mode: useServingMode ? "serving" : "weight",
          note: quantityDesc,
          servingsQty: useServingMode ? servingsQtyForSel : null,
          weightQty: useServingMode ? null : weightQtyForSel,
        },
        perBase: perBaseClean,
        total: totalClean,
        photoUrl: finalPhotoUrl,
        photoName: finalPhotoName,
        addedAt: new Date().toISOString(),
      };

      const foodsPath = `users/${user.uid}/foods/${dateKey}`;
      await arrayUnionField(foodsPath, meal, [item]);
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
    } catch (error: unknown) {
      const e = error as Error;
      console.error(e);
      const msg = handleError("add_food_to_meal", e);
      setToast({
        show: true,
        message: msg,
        color: "danger",
      });
      trackEvent("diary_add_to_meal_error", {
        error: e?.message || String(e),
      });
    } finally {
      setAddingFood(false);
    }
  };

  const saveCurrentSelectionAsFavorite = async () => {
    console.log(`[USER ACTION] AddFood: Save as favorite clicked`, { foodName: selectedFood?.product_name });
    const user = getCurrentUser();
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

      const perBaseClean = stripUndefined({
        calories: safeNum(perBase.calories, 0),
        carbs: safeNum(perBase.carbs, 2),
        protein: safeNum(perBase.protein, 2),
        fat: safeNum(perBase.fat, 2),
        sugar: perBase.sugar !== undefined ? safeNum(perBase.sugar, 2) : undefined,
        fiber: perBase.fiber !== undefined ? safeNum(perBase.fiber, 2) : undefined,
        saturatedFat:
          perBase.saturatedFat !== undefined
            ? safeNum(perBase.saturatedFat, 2)
            : undefined,
        salt: perBase.salt !== undefined ? safeNum(perBase.salt, 2) : undefined,
        sodium: perBase.sodium !== undefined ? safeNum(perBase.sodium, 2) : undefined,
      } as MacroSet);

      const totalClean = stripUndefined(total);

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
        perBase: perBaseClean,
        total: totalClean,
        dataSource: selectedFood.dataSource ?? "openfoodfacts",
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
    } catch (error: unknown) {
      const e = error as Error;
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
    console.log(`[USER ACTION] AddFood: Create custom food clicked`, { name: customName });
    const user = getCurrentUser();
    if (!user) return;

    // Validate inputs
    const name = customName.trim();
    if (!name) {
      setToast({
        show: true,
        message: "Please enter a food name",
        color: "warning",
      });
      return;
    }

    const brand = customBrand.trim() || null;
    const caloriesVal = parseFloat(customCalories || "0");
    const carbsVal = parseFloat(customCarbs || "0");
    const proteinVal = parseFloat(customProtein || "0");
    const fatVal = parseFloat(customFat || "0");

    // Validate numeric values
    if (isNaN(caloriesVal) || caloriesVal < 0 || caloriesVal > MAX_CALORIES) {
      setToast({
        show: true,
        message: `Please enter a valid calorie value (0-${MAX_CALORIES})`,
        color: "warning",
      });
      return;
    }

    if (isNaN(carbsVal) || carbsVal < 0 || carbsVal > MAX_MACRONUTRIENT_GRAMS) {
      setToast({
        show: true,
        message: `Please enter a valid carbs value (0-${MAX_MACRONUTRIENT_GRAMS}g)`,
        color: "warning",
      });
      return;
    }

    if (isNaN(proteinVal) || proteinVal < 0 || proteinVal > MAX_MACRONUTRIENT_GRAMS) {
      setToast({
        show: true,
        message: `Please enter a valid protein value (0-${MAX_MACRONUTRIENT_GRAMS}g)`,
        color: "warning",
      });
      return;
    }

    if (isNaN(fatVal) || fatVal < 0 || fatVal > MAX_MACRONUTRIENT_GRAMS) {
      setToast({
        show: true,
        message: `Please enter a valid fat value (0-${MAX_MACRONUTRIENT_GRAMS}g)`,
        color: "warning",
      });
      return;
    }

    const calories = safeNum(caloriesVal, 0);
    const carbs = safeNum(carbsVal, 1);
    const protein = safeNum(proteinVal, 1);
    const fat = safeNum(fatVal, 1);

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
        code: null,
        createdAt: new Date().toISOString(),
      };

      await setDoc(favDoc, favData);
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
    } catch (error: unknown) {
      const e = error as Error;
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
    console.log(`[USER ACTION] AddFood: Favorite clicked to add to meal`, { favoriteId: fav.id || 'unknown', meal });
    const user = getCurrentUser();
    if (!user) return;

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

    const foodsPath = `users/${user.uid}/foods/${dateKey}`;
    await arrayUnionField(foodsPath, meal, [item]);
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
    code?: string | null;
  }) => {
    const user = getCurrentUser();
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

    try {
      const user = getCurrentUser();
      if (!user) return;

      const ref = collection(db, "users", user.uid, "recentFoods");
      const q = fsQuery(ref, orderBy("lastUsedAt", "desc"), limit(25));
      const snap = await getDocs(q);

      const docs = snap.docs;
      if (docs.length > 10) {
        const oldOnes = docs.slice(10);
        for (const d of oldOnes) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      console.error("recentFoods cleanup error:", err);
    }

    trackEvent("recent_food_upserted", {
      uid: user.uid,
      key,
      name: payload.name,
    });
  };

  const addHistoryFoodToMeal = async (src: DiaryEntryDoc) => {
    console.log(`[USER ACTION] AddFood: Recent food clicked to add to meal`, { foodName: src.name, meal });
    const user = getCurrentUser();
    if (!user) return;

    const totalRaw: MacroSet =
      src.total || ({ calories: 0, carbs: 0, protein: 0, fat: 0 } as MacroSet);

    const total = stripUndefined(totalRaw);

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
        }),
      perBase: src.perBase ? stripUndefined(src.perBase) : total,
      total,
      addedAt: new Date().toISOString(),
    };

    const foodsPath = `users/${user.uid}/foods/${dateKey}`;
    await arrayUnionField(foodsPath, meal, [item]);

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
    console.log(`[USER ACTION] AddFood: Create custom meal clicked`, { name: mealPresetName });
    const user = getCurrentUser();
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
    } catch (error: unknown) {
      const e = error as Error;
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
    console.log(`[USER ACTION] AddFood: Custom meal clicked to add to meal`, { presetName: preset.name, meal });
    const user = getCurrentUser();
    if (!user) return;

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

    const foodsPath = `users/${user.uid}/foods/${dateKey}`;
    await arrayUnionField(foodsPath, meal, [item]);

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
    console.log(`[USER ACTION] AddFood: Confirm delete favorite clicked`, { favoriteName: favoriteToDelete?.name });
    const user = getCurrentUser();
    if (!user || !favoriteToDelete) {
      setFavoriteToDelete(null);
      return;
    }

    try {
      const ref = doc(db, "users", user.uid, "favorites", favoriteToDelete.id);
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
    } catch (error: unknown) {
      const e = error as Error;
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

  const confirmDeleteMealPreset = async () => {
    console.log(`[USER ACTION] AddFood: Confirm delete custom meal clicked`, { presetName: mealPresetToDelete?.name });
    const user = getCurrentUser();
    if (!user || !mealPresetToDelete) {
      setMealPresetToDelete(null);
      return;
    }

    try {
      const ref = doc(db, "users", user.uid, "mealPresets", mealPresetToDelete.id);
      await deleteDoc(ref);
      setToast({
        show: true,
        message: "Custom meal deleted",
        color: "success",
      });

      trackEvent("meal_preset_deleted", {
        uid: user.uid,
        preset_id: mealPresetToDelete.id,
      });
    } catch (error: unknown) {
      const e = error as Error;
      console.error(e);
      setToast({
        show: true,
        message: e?.message ?? "Could not delete custom meal",
        color: "danger",
      });
      trackEvent("meal_preset_delete_error", {
        error: e?.message || String(e),
      });
    } finally {
      setMealPresetToDelete(null);
    }
  };

  const previewPerBaseLabel = useMemo(() => {
    if (editEntry) {
      const src = editEntry.item;
      const sel = src.selection || {};
      const base = src.base || null;

      if (useServing) {
        return base?.label || sel.note || "1 serving";
      }
      return "100 g";
    }

    if (!selectedFood) return "100 g";
    const useServingMode = useServing && selectedFood.serving_size && hasServingMacros;
    return useServingMode
      ? parsedServing.label || selectedFood.serving_size || "1 serving"
      : "100 g";
  }, [editEntry, useServing, selectedFood, hasServingMacros, parsedServing]);

  const previewPerBaseMacros = useMemo<MacroSet>(() => {
    const useServingMode = useServing && selectedFood?.serving_size && hasServingMacros;
    return useServingMode ? perServing : per100g;
  }, [useServing, selectedFood, hasServingMacros, perServing, per100g]);

  const previewTotal = useMemo(() => {
    if (editEntry) {
      const src = editEntry.item;
      const total: MacroSet =
        src.total || ({ calories: 0, carbs: 0, protein: 0, fat: 0 } as MacroSet);
      const sel = src.selection || {};

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

    const useServingMode = useServing && selectedFood?.serving_size && hasServingMacros;
    if (useServingMode) {
      return scale(previewPerBaseMacros, Math.max(0.1, servingsQty));
    }
    return scale(previewPerBaseMacros, Math.max(1, weightQty) / 100);
  }, [editEntry, useServing, servingsQty, weightQty, selectedFood, hasServingMacros, previewPerBaseMacros]);

  const hasExtraNutrients =
    previewTotal.sugar !== undefined ||
    previewTotal.fiber !== undefined ||
    previewTotal.saturatedFat !== undefined ||
    previewTotal.salt !== undefined;

  const isEditServingMode =
    !!editEntry &&
    (() => {
      const src = editEntry.item;
      const sel = src.selection || {};
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

  const modalTitle = editEntry?.item?.name || selectedFood?.product_name || "(no name)";

  const handleChangeMeal = useCallback((next: MealKey) => {
    if (next === meal) return;
    
    console.log(`[USER ACTION] AddFood: Meal changed`, { from: meal, to: next });

    trackEvent("add_food_meal_change", {
      from: meal,
      to: next,
      date: dateKey,
    });

    setMeal(next);

    const params = new URLSearchParams(location.search);
    params.delete("autoMeal");
    params.set("meal", next);
    history.replace({
      pathname: "/add-food",
      search: `?${params.toString()}`,
    });

    setShowMealPicker(false);
  }, [meal, dateKey, location.search, history]);

  const recommendation = useMemo(() => {
    if (!targets || !dayTotals) return null;

    const remainingProtein = Math.max(0, targets.proteinG - dayTotals.protein);
    const remainingCarbs = Math.max(0, targets.carbsG - dayTotals.carbs);
    const remainingFat = Math.max(0, targets.fatG - dayTotals.fat);
    const remainingCalories = Math.max(0, targets.calories - dayTotals.calories);

    const goal: Goal = targets.goal || "maintain";

    const entries = [
      { key: "protein" as const, remaining: remainingProtein, target: targets.proteinG || 1 },
      { key: "carbs" as const, remaining: remainingCarbs, target: targets.carbsG || 1 },
      { key: "fat" as const, remaining: remainingFat, target: targets.fatG || 1 },
    ];

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

    const sorted = entries
      .filter((e) => e.target > 0)
      .sort((a, b) => b.remaining / Math.max(1, b.target) - a.remaining / Math.max(1, a.target));

    const focus = sorted[0];
    if (!focus || focus.remaining < 3) {
      return null;
    }

    let suggestionList: string[] = [];
    if (focus.key === "protein") suggestionList = PROTEIN_SUGGESTIONS[goal];
    else if (focus.key === "carbs") suggestionList = CARB_SUGGESTIONS[goal];
    else suggestionList = FAT_SUGGESTIONS[goal];

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

      <IonContent className="ion-padding add-food-page" fullscreen ref={contentRef}>
        {shouldShowMealSelection && (
          <IonItem lines="none" className="mp-mb-md">
            <IonLabel>For which meal?</IonLabel>
            <IonSelect
              value={meal}
              interface="popover"
              onIonChange={(e) => handleChangeMeal(e.detail.value as MealKey)}
            >
              {MEAL_ORDER.map((mealKey) => (
                <IonSelectOption key={mealKey} value={mealKey}>
                  {mealKey[0].toUpperCase() + mealKey.slice(1)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        )}
        <IonChip
          color="primary"
          className="mp-mb-md"
          onClick={() => {
            console.log(`[USER ACTION] AddFood: Date/meal chip clicked to open meal picker`, { currentMeal: meal, date: dateKey });
            setShowMealPicker(true);
          }}
        >
          <IonIcon icon={calendarOutline} />
          <span className="mp-ml-sm">
            {friendlyDate} · {meal}
          </span>
        </IonChip>

        {showSmartRecommendation && targets && dayTotals && recommendation && (
          <IonCard className="mp-mb-md">
            <IonCardHeader>
              <IonCardTitle className="mp-text-base">Smart recommendation</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              {recommendation.isClose ? (
                <>
                  <p style={{ marginTop: 0, marginBottom: 6 }}>{recommendation.message}</p>
                  <IonText color="medium" style={{ fontSize: 13 }}>
                    Remaining today: {Math.round(recommendation.remaining.calories)} kcal · Carbohydrates{" "}
                    {Math.round(recommendation.remaining.carbs)} g · Protein{" "}
                    {Math.round(recommendation.remaining.protein)} g · Fat{" "}
                    {Math.round(recommendation.remaining.fat)} g
                  </IonText>
                </>
              ) : (
                <>
                  <p style={{ marginTop: 0, marginBottom: 6 }}>
                    Based on your goal <strong>{recommendation.goal}</strong> and what you’ve already eaten today,
                    you’re still missing some <strong>{recommendation.focusMacro}</strong>.
                  </p>
                  {recommendation.suggestion && (
                    <p style={{ marginTop: 0, marginBottom: 6 }}>
                      For <strong>{meal}</strong> (or a snack) you could try:{" "}
                      <strong>{recommendation.suggestion}</strong>.
                    </p>
                  )}
                  <IonText color="medium" style={{ fontSize: 13 }}>
                    Remaining today: {Math.round(recommendation.remaining.calories)} kcal · Carbohydrates{" "}
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
            console.log(`[USER ACTION] AddFood: Tab changed`, { from: tab, to: e.detail.value });
            const v = (e.detail.value as "search" | "favorites") || "search";
            setTab(v);
            trackEvent("add_food_tab_change", { tab: v, meal, date: dateKey });
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
                debounce={SEARCH_DEBOUNCE_MS}
                ref={searchInputRef}
                onIonInput={(e) => {
                  console.log(`[USER ACTION] AddFood: Search input changed`, { query: e.detail.value });
                  setQuery(e.detail.value ?? "");
                }}
                onKeyUp={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    console.log(`[USER ACTION] AddFood: Enter key pressed in search`, { query: query.trim() });
                    trackEvent("food_search_enter_key", { query: query.trim(), meal, date: dateKey });
                    hideKeyboard();
                    foodsSearch(query.trim(), 1);
                  }
                }}
              />
            </IonItem>

            <div className="add-food-actions-grid">
              <IonButton
                expand="block"
                disabled={!query || loading}
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Search button clicked`, { query: query.trim() });
                  if (!query.trim()) return;
                  trackEvent("food_search_button_click", { query: query.trim(), meal, date: dateKey });
                  hideKeyboard();
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
                color={barcodeScannerEnabled ? undefined : "medium"}
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Barcode scanner button clicked`, { enabled: barcodeScannerEnabled });
                  if (!barcodeScannerEnabled) {
                    setToast({
                      show: true,
                      message: "Barcode scanner is temporarily unavailable.",
                      color: "warning",
                    });
                    trackEvent("barcode_scanner_disabled_click", { meal, date: dateKey });
                    return;
                  }
                  trackEvent("navigate_to_scan_barcode", { meal, date: dateKey });
                  history.push(`/scan-barcode?meal=${meal}&date=${dateKey}`);
                }}
              >
                Barcode scanner
              </IonButton>

              <IonButton
                expand="block"
                fill="outline"
                onClick={async () => {
                  console.log(`[USER ACTION] AddFood: AI Photo button clicked`);
                  await takeAiPhoto();
                }}
                disabled={isAiPhotoAnalyzing}
              >
                <IonIcon slot="start" icon={cameraOutline} />
                {isAiPhotoAnalyzing ? "Analyzing..." : "AI Photo Recognition"}
                {isAiPhotoAnalyzing && <IonSpinner name="crescent" slot="end" />}
              </IonButton>
            </div>

            {showRecentSearchesEnabled && recentQueries.length > 0 && (
              <div className="add-food-recent-section">
                <div className="add-food-section-header">
                  <IonText color="medium" className="mp-text-xs">
                    Recent searches
                  </IonText>
                  <IonButton
                    size="small"
                    fill="clear"
                    onClick={clearRecentQueries}
                    className="mp-mr-sm"
                  >
                    Clear
                  </IonButton>
                </div>

                <div className="add-food-chips-container">
                  {recentQueries.map((rq) => (
                    <IonChip
                      key={rq}
                      onClick={() => {
                        setQuery(rq);
                        trackEvent("recent_query_click", { query: rq });
                        foodsSearch(rq, 1);
                      }}
                    >
                      <IonLabel>{rq}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </div>
            )}

            {showRecentItemsEnabled && recent.length > 0 && showRecent && (
              <div className="add-food-favorites-section">
                <IonText
                  color="medium"
                  className="add-food-section-text"
                >
                  From your history
                </IonText>
                <div className="add-food-chips-container">
                  {recent.map((r) => (
                    <IonChip
                      key={r.id}
                      onClick={() => {
                        console.log(`[USER ACTION] AddFood: Recent food chip clicked`, { id: r.id, name: r.name, hasCode: !!r.code });
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

            <IonList className="add-food-results-list" ref={resultsListRef}>
              {results.map((food) => {
                const preview = macrosPer100g(food.nutriments);

                return (
                  <IonItem
                    key={`${food.code}-${food.product_name || ""}`}
                    button
                    disabled={foodDetailLoading !== null}
                    onClick={() => {
                      console.log(`[USER ACTION] AddFood: Search result clicked`, { code: food.code, name: food.product_name });
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
                        {(food.serving_size ? `Serving: ${food.serving_size} · ` : "") +
                          `${preview.calories || 0} kcal/100g · Carbohydrates ${preview.carbs || 0} g · Protein ${
                            preview.protein || 0
                          } g · Fat ${preview.fat || 0} g`}
                      </p>
                    </IonLabel>
                    {foodDetailLoading === food.code && (
                      <IonSpinner slot="end" name="crescent" />
                    )}
                  </IonItem>
                );
              })}
            </IonList>

            {noMoreResults && results.length > 0 && (
              <p className="add-food-end-of-results">You've reached the end!</p>
            )}
          </>
        )}

        {tab === "favorites" && (
          <>
            <div className="add-food-favorites-filter">
              <IonButton
                size="small"
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Create custom food button clicked`);
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
                  console.log(`[USER ACTION] AddFood: Create custom meal button clicked`);
                  setShowCreateMealPreset(true);
                  trackEvent("meal_preset_modal_open");
                }}
              >
                Create custom meal
              </IonButton>
            </div>

            {recentLoading && (
              <div className="ion-text-center add-food-loading-state-sm">
                <IonSpinner name="dots" />
              </div>
            )}

            {!recentLoading && recentFoods.length > 0 && (
              <>
                <IonText className="add-food-section-text">
                  Recently eaten
                </IonText>
                <IonList className="add-food-favorites-list">
                  {recentFoods.map((item, idx) => (
                    <IonItem key={idx} button onClick={() => addHistoryFoodToMeal(item)}>
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
              <p style={{ padding: 12, opacity: 0.7, fontSize: 14 }}>
                No favorites yet. When adding a food, tap <strong>“Save this portion as a favorite”</strong> in the
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
                    <IonItem key={fav.id} button onClick={() => addFavoriteToMeal(fav)}>
                      <IonIcon slot="start" icon={starOutline} />
                      <IonLabel>
                        <h2>
                          {fav.name}
                          {fav.brand ? ` · ${fav.brand}` : ""}
                        </h2>
                        <p>
                          {Math.round(fav.total.calories)} kcal · Carbs {fav.total.carbs.toFixed(1)} g · Protein{" "}
                          {fav.total.protein.toFixed(1)} g · Fat {fav.total.fat.toFixed(1)} g
                        </p>
                        <p style={{ fontSize: 12, opacity: 0.7 }}>{fav.selection.note}</p>
                      </IonLabel>

                      <IonButton
                        slot="end"
                        fill="clear"
                        color="danger"
                        onClick={(e) => {
                          console.log(`[USER ACTION] AddFood: Delete favorite button clicked`, { favoriteId: fav.id, name: fav.name });
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
                    <IonItem key={preset.id} button onClick={() => addMealPresetToMeal(preset)}>
                      <IonLabel>
                        <h2>{preset.name}</h2>
                        <p>
                          {Math.round(preset.total.calories)} kcal · Carbs {preset.total.carbs.toFixed(1)} g · Protein{" "}
                          {preset.total.protein.toFixed(1)} g · Fat {preset.total.fat.toFixed(1)} g
                        </p>
                        {preset.note && <p style={{ fontSize: 12, opacity: 0.7 }}>{preset.note}</p>}
                      </IonLabel>

                      <IonButton
                        slot="end"
                        fill="clear"
                        color="danger"
                        onClick={(e) => {
                          console.log(`[USER ACTION] AddFood: Delete custom meal button clicked`, { presetId: preset.id, name: preset.name });
                          e.stopPropagation();
                          setMealPresetToDelete(preset);
                          trackEvent("meal_preset_delete_prompt_open", {
                            preset_id: preset.id,
                          });
                        }}
                        aria-label={`Delete custom meal ${preset.name}`}
                      >
                        <IonIcon icon={trashOutline} />
                      </IonButton>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}
          </>
        )}

        <IonModal
          isOpen={open}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Food details modal dismissed`);
            setOpen(false);
            trackEvent("food_details_modal_dismiss");
          }}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>{modalTitle}</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding" fullscreen>
            {editEntry || selectedFood ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  {selectedFood && (
                    <p style={{ margin: 0, opacity: 0.7 }}>
                      {selectedFood.brands ? `${selectedFood.brands}` : ""}
                      {selectedFood.brands && selectedFood.nutriscore_grade ? " · " : ""}
                      {selectedFood.nutriscore_grade
                        ? `Nutri-Score ${selectedFood.nutriscore_grade.toUpperCase()}`
                        : ""}
                    </p>
                  )}
                  <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                    {editEntry ? "Editing in" : "Adding to"}: <strong>{meal}</strong> · {friendlyDate}
                  </p>
                </div>

                {!editEntry && selectedFood && (
                  <IonSegment
                    value={useServing ? "serving" : "weight"}
                    onIonChange={(e) => {
                      console.log(`[USER ACTION] AddFood: Serving/weight mode changed`, { mode: e.detail.value });
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
                      disabled={!selectedFood.serving_size || !hasServingMacros}
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
                        Quantity · <span style={{ opacity: 0.7 }}>{previewPerBaseLabel}</span>
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
                          onClick={() => {
                            const oldQty = servingsQty;
                            const newQty = Math.max(0.1, safeNum(oldQty - 0.5, 1));
                            console.log(`[USER ACTION] AddFood: Serving quantity decreased`, { from: oldQty, to: newQty });
                            setServingsQty(newQty);
                          }}
                        >
                          −
                        </IonButton>
                        <IonInput
                          type="number"
                          inputMode="decimal"
                          value={servingsQty}
                          min="0.1"
                          step="0.1"
                          onIonChange={(e) => {
                            console.log(`[USER ACTION] AddFood: Serving quantity input changed`, { newQty: e.detail.value });
                            setServingsQty(Math.max(0.1, Number(e.detail.value)));
                          }}
                          style={{ textAlign: "center" }}
                        />
                        <IonButton
                          fill="outline"
                          onClick={() => {
                            const oldQty = servingsQty;
                            const newQty = safeNum(oldQty + 0.5, 1);
                            console.log(`[USER ACTION] AddFood: Serving quantity increased`, { from: oldQty, to: newQty });
                            setServingsQty(newQty);
                          }}
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
                        Amount · <span style={{ opacity: 0.7 }}>grams</span>
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
                          onClick={() => {
                            console.log(`[USER ACTION] AddFood: Weight quantity decreased`, { currentQty: weightQty });
                            setWeightQty((v) => Math.max(1, v - 10));
                          }}
                        >
                          −10
                        </IonButton>
                        <IonInput
                          type="number"
                          inputMode="numeric"
                          value={weightQty}
                          min="1"
                          step="1"
                          onIonChange={(e) => {
                            console.log(`[USER ACTION] AddFood: Weight quantity input changed`, { newQty: e.detail.value });
                            setWeightQty(Math.max(1, Number(e.detail.value)));
                          }}
                          style={{ textAlign: "center" }}
                        />
                        <IonButton fill="outline" onClick={() => {
                          console.log(`[USER ACTION] AddFood: Weight quantity increased`, { currentQty: weightQty });
                          setWeightQty((v) => v + 10);
                        }}>
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
                      <span>Nutrition info</span>
                      <IonText color="medium" style={{ fontSize: 12 }}>
                        {showServingCard
                          ? `${safeNum(servingsQty, 1)} × ${previewPerBaseLabel}`
                          : `${Math.max(1, weightQty)} g (base: ${previewPerBaseLabel})`}
                      </IonText>
                    </IonCardTitle>
                    <IonText color="medium" style={{ fontSize: 11, marginTop: 4 }}>
                      Swipe for micronutrients & photo →
                    </IonText>
                  </IonCardHeader>
                  <IonCardContent style={{ padding: "0 0 18px 0" }}>
                    <Swiper
                      modules={[Pagination]}
                      pagination={{ clickable: true }}
                      spaceBetween={0}
                      slidesPerView={1}
                      style={{ width: "100%" }}
                    >
                      {/* Page 1: Macronutrients */}
                      <SwiperSlide>
                        <div style={{ padding: "0 18px" }}>
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

                          {hasExtraNutrients && (
                            <IonGrid style={{ marginTop: 8 }}>
                              <IonRow>
                                {previewTotal.sugar !== undefined && (
                                  <IonCol className="ion-text-center">
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>Sugars</div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                      {safeNum(previewTotal.sugar, 1)} g
                                    </div>
                                  </IonCol>
                                )}
                                {previewTotal.fiber !== undefined && (
                                  <IonCol className="ion-text-center">
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>Fiber</div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                      {safeNum(previewTotal.fiber, 1)} g
                                    </div>
                                  </IonCol>
                                )}
                                {previewTotal.saturatedFat !== undefined && (
                                  <IonCol className="ion-text-center">
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>Sat. fat</div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                      {safeNum(previewTotal.saturatedFat, 1)} g
                                    </div>
                                  </IonCol>
                                )}
                              </IonRow>
                              {previewTotal.salt !== undefined && (
                                <IonRow>
                                  <IonCol className="ion-text-center">
                                    <div style={{ fontSize: 12, opacity: 0.7 }}>Salt</div>
                                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                                      {safeNum(previewTotal.salt, 2)} g
                                    </div>
                                  </IonCol>
                                </IonRow>
                              )}
                            </IonGrid>
                          )}
                        </div>
                      </SwiperSlide>

                      {/* Page 2: Micronutrients (Vitamins & Minerals) */}
                      <SwiperSlide>
                        <div style={{ padding: "0 18px" }}>
                          <div style={{ textAlign: "center", marginBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>
                              Vitamins & Minerals
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                              Per {showServingCard ? `${safeNum(servingsQty, 1)} serving(s)` : `${Math.max(1, weightQty)} g`}
                            </div>
                          </div>

                          {(() => {
                            const nutri = selectedFood?.nutriments;
                            const factor = showServingCard ? servingsQty : (weightQty / 100);
                            
                            const micronutrients = [
                              { key: "vitamin-a_100g", label: "Vitamin A", unit: "µg" },
                              { key: "vitamin-c_100g", label: "Vitamin C", unit: "mg" },
                              { key: "vitamin-d_100g", label: "Vitamin D", unit: "µg" },
                              { key: "vitamin-e_100g", label: "Vitamin E", unit: "mg" },
                              { key: "vitamin-k_100g", label: "Vitamin K", unit: "µg" },
                              { key: "vitamin-b1_100g", label: "B1 (Thiamin)", unit: "mg" },
                              { key: "vitamin-b2_100g", label: "B2 (Riboflavin)", unit: "mg" },
                              { key: "vitamin-b6_100g", label: "Vitamin B6", unit: "mg" },
                              { key: "vitamin-b12_100g", label: "Vitamin B12", unit: "µg" },
                              { key: "folates_100g", label: "Folate", unit: "µg" },
                              { key: "niacin_100g", label: "Niacin (B3)", unit: "mg" },
                              { key: "calcium_100g", label: "Calcium", unit: "mg" },
                              { key: "iron_100g", label: "Iron", unit: "mg" },
                              { key: "magnesium_100g", label: "Magnesium", unit: "mg" },
                              { key: "phosphorus_100g", label: "Phosphorus", unit: "mg" },
                              { key: "potassium_100g", label: "Potassium", unit: "mg" },
                              { key: "zinc_100g", label: "Zinc", unit: "mg" },
                              { key: "copper_100g", label: "Copper", unit: "mg" },
                              { key: "manganese_100g", label: "Manganese", unit: "mg" },
                              { key: "selenium_100g", label: "Selenium", unit: "µg" },
                              { key: "iodine_100g", label: "Iodine", unit: "µg" },
                              { key: "cholesterol_100g", label: "Cholesterol", unit: "mg" },
                              { key: "trans-fat_100g", label: "Trans Fat", unit: "g" },
                              { key: "polyunsaturated-fat_100g", label: "Polyunsat. Fat", unit: "g" },
                              { key: "monounsaturated-fat_100g", label: "Monounsat. Fat", unit: "g" },
                              { key: "omega-3-fat_100g", label: "Omega-3", unit: "g" },
                              { key: "omega-6-fat_100g", label: "Omega-6", unit: "g" },
                              { key: "caffeine_100g", label: "Caffeine", unit: "mg" },
                            ] as const;

                            // Type-safe nutrient access helper
                            const getNutrientValue = (key: string): number | undefined => {
                              if (!nutri) return undefined;
                              return nutri[key as keyof OFFNutriments];
                            };

                            const availableMicros = micronutrients.filter(
                              (m) => {
                                const val = getNutrientValue(m.key);
                                return val !== undefined && val > 0;
                              }
                            );

                            if (availableMicros.length === 0) {
                              return (
                                <div style={{ textAlign: "center", padding: "20px 0", opacity: 0.6 }}>
                                  <p style={{ margin: 0 }}>No micronutrient data available for this food.</p>
                                  <p style={{ margin: "8px 0 0", fontSize: 12 }}>
                                    Data varies by product in the OpenFoodFacts database.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div style={{ 
                                display: "grid", 
                                gridTemplateColumns: "repeat(2, 1fr)", 
                                gap: 8,
                                maxHeight: 200,
                                overflowY: "auto"
                              }}>
                                {availableMicros.map((m) => {
                                  const val = (getNutrientValue(m.key) || 0) * factor;
                                  return (
                                    <div 
                                      key={m.key} 
                                      style={{ 
                                        padding: "8px 10px",
                                        background: "var(--mp-surface-muted)",
                                        borderRadius: 10,
                                        fontSize: 13
                                      }}
                                    >
                                      <div style={{ opacity: 0.7, fontSize: 11 }}>{m.label}</div>
                                      <div style={{ fontWeight: 600 }}>
                                        {safeNum(val, 2)} {m.unit}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </SwiperSlide>

                      {/* Page 3: Photo */}
                      <SwiperSlide>
                        <div style={{ padding: "0 18px" }}>
                          <div style={{ textAlign: "center", marginBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>Food photo</div>
                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                              Add a photo of your meal (optional).
                            </div>
                          </div>

                          {photoPreview ? (
                            <div style={{ textAlign: "center" }}>
                              <img
                                src={photoPreview}
                                alt="Selected food"
                                style={{
                                  width: "100%",
                                  maxHeight: 220,
                                  objectFit: "cover",
                                  borderRadius: 12,
                                }}
                              />
                              <IonText color="medium" style={{ fontSize: 12 }}>
                                {photoName || "Photo attached"}
                              </IonText>
                            </div>
                          ) : (
                            <div
                              style={{
                                textAlign: "center",
                                padding: "16px 0",
                                opacity: 0.7,
                              }}
                            >
                              No photo selected yet.
                            </div>
                          )}

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 12,
                              justifyContent: photoPreview ? "stretch" : "center",
                            }}
                          >
                            <IonButton
                              expand="block"
                              onClick={() => {
                                console.log(`[USER ACTION] AddFood: Add photo button clicked`, { hasExistingPhoto: !!photoPreview });
                                photoInputRef.current?.click();
                              }}
                              style={{ flex: photoPreview ? 1 : "0 1 220px" }}
                            >
                              {photoPreview ? "Replace photo" : "Add photo"}
                            </IonButton>
                            {photoPreview && (
                              <IonButton
                                expand="block"
                                fill="outline"
                                onClick={clearPhoto}
                                style={{ flex: 1 }}
                              >
                                Remove
                              </IonButton>
                            )}
                          </div>
                          <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: "none" }}
                            onChange={(event) =>
                              handlePhotoChange(event.target.files?.[0] ?? null)
                            }
                          />
                        </div>
                      </SwiperSlide>
                    </Swiper>
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
                    onClick={() => {
                      console.log(`[USER ACTION] AddFood: Save as favorite text link clicked`, { foodName: selectedFood.product_name });
                      saveCurrentSelectionAsFavorite();
                    }}
                  >
                    Save this portion as a favorite
                  </IonText>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <IonButton
                    expand="block"
                    onClick={() => {
                      console.log(`[USER ACTION] AddFood: Cancel food details button clicked`);
                      setOpen(false);
                      trackEvent("food_details_cancel");
                    }}
                    fill="outline"
                  >
                    Cancel
                  </IonButton>
                  <IonButton
                    expand="block"
                    onClick={() => {
                      console.log(`[USER ACTION] AddFood: Add/Save food button clicked in modal`, { editMode: !!editEntry, meal });
                      addFoodToMeal();
                    }}
                    disabled={disableAddButton || addingFood}
                  >
                    {addingFood ? (
                      <>
                        <IonSpinner name="dots" />
                        &nbsp;{editEntry ? "Saving..." : `Adding to ${meal}...`}
                      </>
                    ) : editEntry ? (
                      "Save changes"
                    ) : (
                      `Add to ${meal}`
                    )}
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
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Toast dismissed`);
            setToast({ ...toast, show: false });
          }}
        />

        <IonAlert
          isOpen={!!favoriteToDelete}
          header="Delete favorite?"
          message={
            favoriteToDelete ? `Remove “${favoriteToDelete.name}” from your favorites?` : ""
          }
          buttons={[
            { text: "Cancel", role: "cancel", handler: () => {
              console.log(`[USER ACTION] AddFood: Delete favorite alert cancelled`);
              setFavoriteToDelete(null);
            }},
            { text: "Delete", role: "destructive", handler: () => {
              console.log(`[USER ACTION] AddFood: Delete favorite confirmed in alert`);
              confirmDeleteFavorite();
            }},
          ]}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Delete favorite alert dismissed`);
            setFavoriteToDelete(null);
          }}
        />

        <IonAlert
          isOpen={!!mealPresetToDelete}
          header="Delete custom meal?"
          message={
            mealPresetToDelete ? `Remove "${mealPresetToDelete.name}" from your custom meals?` : ""
          }
          buttons={[
            { text: "Cancel", role: "cancel", handler: () => {
              console.log(`[USER ACTION] AddFood: Delete custom meal alert cancelled`);
              setMealPresetToDelete(null);
            }},
            { text: "Delete", role: "destructive", handler: () => {
              console.log(`[USER ACTION] AddFood: Delete custom meal confirmed in alert`);
              confirmDeleteMealPreset();
            }},
          ]}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Delete custom meal alert dismissed`);
            setMealPresetToDelete(null);
          }}
        />

        <IonModal
          isOpen={showCreateCustomFood}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Create custom food modal dismissed`);
            setShowCreateCustomFood(false);
            trackEvent("custom_food_modal_dismiss");
          }}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create custom food</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding" fullscreen>
            <IonItem>
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput value={customName} onIonChange={(e) => {
                console.log(`[USER ACTION] AddFood: Custom food name input changed`, { value: e.detail.value });
                setCustomName(e.detail.value || "");
              }} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Brand (optional)</IonLabel>
              <IonInput value={customBrand} onIonChange={(e) => {
                console.log(`[USER ACTION] AddFood: Custom food brand input changed`, { value: e.detail.value });
                setCustomBrand(e.detail.value || "");
              }} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Calories per 100 g</IonLabel>
              <IonInput
                type="number"
                inputMode="numeric"
                value={customCalories}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Custom food calories input changed`, { value: e.detail.value });
                  setCustomCalories(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Carbs per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customCarbs}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Custom food carbs input changed`, { value: e.detail.value });
                  setCustomCarbs(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Protein per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customProtein}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Custom food protein input changed`, { value: e.detail.value });
                  setCustomProtein(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Fat per 100 g (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={customFat}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Custom food fat input changed`, { value: e.detail.value });
                  setCustomFat(e.detail.value || "");
                }}
              />
            </IonItem>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Cancel custom food creation clicked`);
                  setShowCreateCustomFood(false);
                  trackEvent("custom_food_modal_cancel");
                }}
              >
                Cancel
              </IonButton>
              <IonButton expand="block" onClick={() => {
                console.log(`[USER ACTION] AddFood: Save custom food clicked`, { name: customName });
                createCustomFood();
              }}>
                Save custom food
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonModal
          isOpen={showCreateMealPreset}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Create custom meal modal dismissed`);
            setShowCreateMealPreset(false);
            trackEvent("meal_preset_modal_dismiss");
          }}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Create custom meal</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding" fullscreen>
            <IonItem>
              <IonLabel position="stacked">Meal name</IonLabel>
              <IonInput value={mealPresetName} onIonChange={(e) => {
                console.log(`[USER ACTION] AddFood: Meal preset name input changed`, { value: e.detail.value });
                setMealPresetName(e.detail.value || "");
              }} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Note (optional)</IonLabel>
              <IonInput value={mealPresetNote} onIonChange={(e) => {
                console.log(`[USER ACTION] AddFood: Meal preset note input changed`, { value: e.detail.value });
                setMealPresetNote(e.detail.value || "");
              }} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total calories</IonLabel>
              <IonInput
                type="number"
                inputMode="numeric"
                value={mealPresetCalories}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Meal preset calories input changed`, { value: e.detail.value });
                  setMealPresetCalories(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total carbs (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetCarbs}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Meal preset carbs input changed`, { value: e.detail.value });
                  setMealPresetCarbs(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total protein (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetProtein}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Meal preset protein input changed`, { value: e.detail.value });
                  setMealPresetProtein(e.detail.value || "");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Total fat (g)</IonLabel>
              <IonInput
                type="number"
                inputMode="decimal"
                value={mealPresetFat}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] AddFood: Meal preset fat input changed`, { value: e.detail.value });
                  setMealPresetFat(e.detail.value || "");
                }}
              />
            </IonItem>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Cancel meal preset creation clicked`);
                  setShowCreateMealPreset(false);
                  trackEvent("meal_preset_modal_cancel");
                }}
              >
                Cancel
              </IonButton>
              <IonButton expand="block" onClick={() => {
                console.log(`[USER ACTION] AddFood: Save custom meal clicked`, { name: mealPresetName });
                createMealPreset();
              }}>
                Save custom meal
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonActionSheet
          isOpen={showMealPicker}
          onDidDismiss={() => {
            console.log(`[USER ACTION] AddFood: Meal picker action sheet dismissed`);
            setShowMealPicker(false);
          }}
          header="Select meal"
          buttons={[
            { text: "Breakfast", handler: () => {
              console.log(`[USER ACTION] AddFood: Breakfast selected from meal picker`);
              handleChangeMeal("breakfast");
            }},
            { text: "Lunch", handler: () => {
              console.log(`[USER ACTION] AddFood: Lunch selected from meal picker`);
              handleChangeMeal("lunch");
            }},
            { text: "Dinner", handler: () => {
              console.log(`[USER ACTION] AddFood: Dinner selected from meal picker`);
              handleChangeMeal("dinner");
            }},
            { text: "Snacks", handler: () => {
              console.log(`[USER ACTION] AddFood: Snacks selected from meal picker`);
              handleChangeMeal("snacks");
            }},
            { text: "Cancel", role: "cancel", handler: () => {
              console.log(`[USER ACTION] AddFood: Meal picker cancelled`);
            }},
          ]}
        />
      </IonContent>

      {tab === "search" && results.length > 0 && (
        <IonFooter>
          <IonToolbar className="add-food-pagination-toolbar">
            <div className="add-food-pagination">
              <IonButton
                expand="block"
                fill="outline"
                disabled={page <= 1 || loading}
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Previous page button clicked`, { currentPage: page });
                  trackEvent("food_search_page_prev", { page, query });
                  foodsSearch(query.trim(), page - 1);
                }}
              >
                ← Prev
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                disabled={loading || noMoreResults}
                onClick={() => {
                  console.log(`[USER ACTION] AddFood: Next page button clicked`, { currentPage: page });
                  trackEvent("food_search_page_next", { page, query });
                  foodsSearch(query.trim(), page + 1);
                }}
              >
                Next →
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
};

export default AddFood;
