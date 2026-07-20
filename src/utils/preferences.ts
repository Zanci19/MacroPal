import { syncStatusBar } from "./platformSetup";

export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("mp_theme");
  return THEME_MODES.includes(stored as ThemeMode)
    ? (stored as ThemeMode)
    : "dark";
};

export const applyTheme = (mode: ThemeMode) => {
  if (typeof window === "undefined") return;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.body.classList.remove("dark");

  switch (mode) {
    case "dark":
      document.body.classList.add("dark");
      break;
    case "light":
      break;
    case "system":
    default:
      if (prefersDark) {
        document.body.classList.add("dark");
      }
      break;
  }

  window.localStorage.setItem("mp_theme", mode);

  // Re-theme the native status bar to match. The web `dark` class cannot touch
  // it, so without this a theme switch leaves the native bar stuck at its
  // launch colour (dark app, white status bar). No-op on web.
  syncStatusBar(document.body.classList.contains("dark"));
};

/* ----- Font preference: brand (Inter) vs native system stack ----- */
export const FONT_PREFERENCES = ["brand", "system"] as const;
export type FontPreference = (typeof FONT_PREFERENCES)[number];

export const getStoredFontPreference = (): FontPreference => {
  if (typeof window === "undefined") return "brand";
  const stored = window.localStorage.getItem("mp_font");
  return FONT_PREFERENCES.includes(stored as FontPreference)
    ? (stored as FontPreference)
    : "brand";
};

export const applyFontPreference = (pref: FontPreference) => {
  if (typeof window === "undefined") return;
  // Brand (Inter) is the default; body.font-system swaps to the native stack.
  document.body.classList.toggle("font-system", pref === "system");
  window.localStorage.setItem("mp_font", pref);
  window.dispatchEvent(
    new CustomEvent("mp_font_preference_change", { detail: { pref } })
  );
};

/* ----- Home layout: which of the three dashboard styles to render ----- */
export const HOME_LAYOUTS = ["bold", "data", "friendly"] as const;
export type HomeLayout = (typeof HOME_LAYOUTS)[number];
export const DEFAULT_HOME_LAYOUT: HomeLayout = "bold";

export const getHomeLayout = (): HomeLayout => {
  if (typeof window === "undefined") return DEFAULT_HOME_LAYOUT;
  const stored = window.localStorage.getItem("mp_home_layout");
  return HOME_LAYOUTS.includes(stored as HomeLayout)
    ? (stored as HomeLayout)
    : DEFAULT_HOME_LAYOUT;
};

export const applyHomeLayout = (layout: HomeLayout) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_home_layout", layout);
  window.dispatchEvent(
    new CustomEvent("mp_home_layout_change", { detail: { layout } })
  );
};

export const applyAnimationPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_tab_animations", enabled ? "enabled" : "disabled");
  window.dispatchEvent(
    new CustomEvent("mp_animation_preference_change", { detail: { enabled } })
  );
};

export const getAnimationPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("mp_tab_animations");
  return stored !== "disabled";
};

export const applyDebugOverlayPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_debug_overlay", enabled ? "on" : "off");
  window.dispatchEvent(
    new CustomEvent("mp_debug_overlay_change", { detail: { enabled } })
  );
};

export const getDebugOverlayPreference = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem("mp_debug_overlay");
  return stored === "on";
};

export const applyLazyLoadPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_lazy_load", enabled ? "on" : "off");
  window.dispatchEvent(
    new CustomEvent("mp_lazy_load_change", { detail: { enabled } })
  );
};

export const getLazyLoadPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("mp_lazy_load");
  // Default to true (lazy loading enabled) if not explicitly set
  if (stored === null) return true;
  return stored === "on";
};

export const applyChartAnimationPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_chart_animations", enabled ? "on" : "off");
  window.dispatchEvent(
    new CustomEvent("mp_chart_animation_change", { detail: { enabled } })
  );
};

export const getChartAnimationPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("mp_chart_animations");
  if (stored === null) return true;
  return stored === "on";
};

export const applyAutoExpandMealsPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_auto_expand_meals", enabled ? "on" : "off");
  window.dispatchEvent(
    new CustomEvent("mp_auto_expand_meals_change", { detail: { enabled } })
  );
};

export const getAutoExpandMealsPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("mp_auto_expand_meals");
  if (stored === null) return true;
  return stored === "on";
};

export const applyMealCountPreference = (enabled: boolean) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("mp_meal_counts", enabled ? "on" : "off");
  window.dispatchEvent(
    new CustomEvent("mp_meal_counts_change", { detail: { enabled } })
  );
};

export const getMealCountPreference = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem("mp_meal_counts");
  if (stored === null) return false;
  return stored === "on";
};

export type ProfilePreferences = {
  themeMode?: ThemeMode;
  fontPreference?: FontPreference;
  homeLayout?: HomeLayout;
  tabAnimationsEnabled?: boolean;
  debugOverlayEnabled?: boolean;
  lazyLoadEnabled?: boolean;
  chartAnimationsEnabled?: boolean;
  autoExpandMeals?: boolean;
  showMealCounts?: boolean;
};

export const getProfilePreferences = (profile?: Record<string, unknown>): ProfilePreferences => {
  if (!profile) return {};

  const themeModeRaw = profile.themeMode;
  const themeMode =
    typeof themeModeRaw === "string" && THEME_MODES.includes(themeModeRaw as ThemeMode)
      ? (themeModeRaw as ThemeMode)
      : undefined;

  const fontRaw = profile.fontPreference;
  const fontPreference =
    typeof fontRaw === "string" && FONT_PREFERENCES.includes(fontRaw as FontPreference)
      ? (fontRaw as FontPreference)
      : undefined;

  const layoutRaw = profile.homeLayout;
  const homeLayout =
    typeof layoutRaw === "string" && HOME_LAYOUTS.includes(layoutRaw as HomeLayout)
      ? (layoutRaw as HomeLayout)
      : undefined;

  return {
    themeMode,
    fontPreference,
    homeLayout,
    tabAnimationsEnabled:
      typeof profile.tabAnimationsEnabled === "boolean"
        ? profile.tabAnimationsEnabled
        : undefined,
    debugOverlayEnabled:
      typeof profile.debugOverlayEnabled === "boolean"
        ? profile.debugOverlayEnabled
        : undefined,
    lazyLoadEnabled:
      typeof profile.lazyLoadEnabled === "boolean"
        ? profile.lazyLoadEnabled
        : undefined,
    chartAnimationsEnabled:
      typeof profile.chartAnimationsEnabled === "boolean"
        ? profile.chartAnimationsEnabled
        : undefined,
    autoExpandMeals:
      typeof profile.autoExpandMeals === "boolean"
        ? profile.autoExpandMeals
        : undefined,
    showMealCounts:
      typeof profile.showMealCounts === "boolean"
        ? profile.showMealCounts
        : undefined,
  };
};

export const applyProfilePreferences = (profile?: Record<string, unknown>) => {
  const prefs = getProfilePreferences(profile);
  if (typeof prefs.themeMode !== "undefined") {
    applyTheme(prefs.themeMode);
  }
  if (typeof prefs.fontPreference !== "undefined") {
    applyFontPreference(prefs.fontPreference);
  }
  if (typeof prefs.homeLayout !== "undefined") {
    applyHomeLayout(prefs.homeLayout);
  }
  if (typeof prefs.tabAnimationsEnabled === "boolean") {
    applyAnimationPreference(prefs.tabAnimationsEnabled);
  }
  if (typeof prefs.debugOverlayEnabled === "boolean") {
    applyDebugOverlayPreference(prefs.debugOverlayEnabled);
  }
  if (typeof prefs.lazyLoadEnabled === "boolean") {
    const storedPreference =
      typeof window === "undefined"
        ? null
        : window.localStorage.getItem("mp_lazy_load");
    if (storedPreference === null) {
      applyLazyLoadPreference(prefs.lazyLoadEnabled);
    }
  }
  if (typeof prefs.chartAnimationsEnabled === "boolean") {
    applyChartAnimationPreference(prefs.chartAnimationsEnabled);
  }
  if (typeof prefs.autoExpandMeals === "boolean") {
    applyAutoExpandMealsPreference(prefs.autoExpandMeals);
  }
  if (typeof prefs.showMealCounts === "boolean") {
    applyMealCountPreference(prefs.showMealCounts);
  }
  return prefs;
};
