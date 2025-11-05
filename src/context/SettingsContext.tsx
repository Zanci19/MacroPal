import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type GoalFocus = "lose" | "maintain" | "gain";
export type ThemePreference = "light" | "dark" | "system";
export type AccentColor = "indigo" | "emerald" | "orange" | "rose";
export type EnergyUnit = "kcal" | "kJ";
export type WeightUnit = "kg" | "lb";

export interface SettingsState {
  account: {
    email: string;
    displayName: string;
  };
  goals: {
    focus: GoalFocus;
    proteinTarget: number;
    carbTarget: number;
    fatTarget: number;
    calorieTarget: number;
  };
  notifications: {
    dailySummary: boolean;
    pushEnabled: boolean;
    reminderTime: string;
  };
  privacy: {
    shareAnalytics: boolean;
    diaryPrivate: boolean;
  };
  security: {
    requirePin: boolean;
    pinCode: string | null;
    biometricUnlock: boolean;
    lastPasswordChange: string | null;
  };
  appearance: {
    theme: ThemePreference;
    accentColor: AccentColor;
    useLargeText: boolean;
  };
  units: {
    energy: EnergyUnit;
    weight: WeightUnit;
    language: string;
  };
  integrations: {
    googleFitConnected: boolean;
    appleHealthConnected: boolean;
  };
}

export const DEFAULT_SETTINGS: SettingsState = {
  account: {
    email: "you@example.com",
    displayName: "MacroPal user",
  },
  goals: {
    focus: "maintain",
    proteinTarget: 140,
    carbTarget: 250,
    fatTarget: 60,
    calorieTarget: 2200,
  },
  notifications: {
    dailySummary: true,
    pushEnabled: false,
    reminderTime: "20:00",
  },
  privacy: {
    shareAnalytics: true,
    diaryPrivate: false,
  },
  security: {
    requirePin: false,
    pinCode: null,
    biometricUnlock: false,
    lastPasswordChange: null,
  },
  appearance: {
    theme: "system",
    accentColor: "indigo",
    useLargeText: false,
  },
  units: {
    energy: "kcal",
    weight: "kg",
    language: "en",
  },
  integrations: {
    googleFitConnected: false,
    appleHealthConnected: false,
  },
};

const STORAGE_KEY = "macropal.settings";

const ACCENT_COLOR_MAP: Record<AccentColor, string> = {
  indigo: "#4453ff",
  emerald: "#18b089",
  orange: "#ff7e36",
  rose: "#ff4f70",
};

type SettingsContextValue = {
  settings: SettingsState;
  updateSection: <K extends keyof SettingsState>(
    section: K,
    updates: Partial<SettingsState[K]>
  ) => void;
  importSettings: (next: SettingsState) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function mergeSettings(base: SettingsState, override: Partial<SettingsState>): SettingsState {
  return {
    account: { ...base.account, ...override.account },
    goals: { ...base.goals, ...override.goals },
    notifications: { ...base.notifications, ...override.notifications },
    privacy: { ...base.privacy, ...override.privacy },
    security: { ...base.security, ...override.security },
    appearance: { ...base.appearance, ...override.appearance },
    units: { ...base.units, ...override.units },
    integrations: { ...base.integrations, ...override.integrations },
  };
}

const applyThemeClass = (theme: ThemePreference, systemPrefersDark: boolean) => {
  if (typeof document === "undefined") {
    return;
  }

  const shouldUseDark = theme === "dark" || (theme === "system" && systemPrefersDark);
  document.body.classList.toggle("dark", shouldUseDark);
};

const applyAccentColor = (accent: AccentColor) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.style.setProperty("--ion-color-primary", ACCENT_COLOR_MAP[accent]);
  root.style.setProperty("--ion-color-primary-contrast", "#ffffff");
};

export const SettingsProvider: React.FC<React.PropsWithChildren<unknown>> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SettingsState>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SETTINGS;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(stored) as Partial<SettingsState>;
      return mergeSettings(DEFAULT_SETTINGS, parsed);
    } catch (error) {
      console.warn("Failed to load stored settings", error);
      return DEFAULT_SETTINGS;
    }
  });

  const systemDarkMedia = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      systemDarkMedia.current = window.matchMedia("(prefers-color-scheme: dark)");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const media = systemDarkMedia.current;
    const getSystemPreference = () => media?.matches ?? false;

    applyThemeClass(settings.appearance.theme, getSystemPreference());

    if (!media) {
      return;
    }

    const listener = (event: MediaQueryListEvent) => {
      if (settings.appearance.theme === "system") {
        applyThemeClass("system", event.matches);
      }
    };

    if (media.addEventListener) {
      media.addEventListener("change", listener);
    } else {
      media.addListener(listener);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", listener);
      } else {
        media.removeListener(listener);
      }
    };
  }, [settings.appearance.theme]);

  useEffect(() => {
    applyAccentColor(settings.appearance.accentColor);
  }, [settings.appearance.accentColor]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.dataset.largeText = settings.appearance.useLargeText ? "true" : "false";
  }, [settings.appearance.useLargeText]);

  const updateSection = useCallback(
    <K extends keyof SettingsState>(section: K, updates: Partial<SettingsState[K]>) => {
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          ...updates,
        },
      }));
    },
    []
  );

  const importSettings = useCallback((next: SettingsState) => {
    setSettings(mergeSettings(DEFAULT_SETTINGS, next));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, updateSection, importSettings, resetSettings }),
    [settings, updateSection, importSettings, resetSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

