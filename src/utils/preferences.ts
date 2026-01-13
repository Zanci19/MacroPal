export const THEME_MODES = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("mp_theme");
  return THEME_MODES.includes(stored as ThemeMode)
    ? (stored as ThemeMode)
    : "system";
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

export type ProfilePreferences = {
  themeMode?: ThemeMode;
  tabAnimationsEnabled?: boolean;
  debugOverlayEnabled?: boolean;
  lazyLoadEnabled?: boolean;
};

export const getProfilePreferences = (profile?: Record<string, unknown>): ProfilePreferences => {
  if (!profile) return {};

  const themeModeRaw = profile.themeMode;
  const themeMode =
    typeof themeModeRaw === "string" && THEME_MODES.includes(themeModeRaw as ThemeMode)
      ? (themeModeRaw as ThemeMode)
      : undefined;

  return {
    themeMode,
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
  };
};

export const applyProfilePreferences = (profile?: Record<string, unknown>) => {
  const prefs = getProfilePreferences(profile);
  if (typeof prefs.themeMode !== "undefined") {
    applyTheme(prefs.themeMode);
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
  return prefs;
};
