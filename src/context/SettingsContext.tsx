import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type MacroGoal = "lose" | "maintain" | "gain";
type ThemePreference = "light" | "dark" | "system";
type DiaryVisibility = "private" | "friends" | "public";
type EnergyUnit = "kcal" | "kJ";
type WeightUnit = "kg" | "lb";
type DistanceUnit = "km" | "mi";
type LanguageCode = "en" | "es" | "de";

type AccountSettings = {
  email: string;
  displayName: string;
  timeZone: string;
};

type GoalsSettings = {
  goal: MacroGoal;
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTarget: number;
};

type NotificationSettings = {
  dailySummary: boolean;
  pushEnabled: boolean;
  mealReminders: boolean;
  goalCheckIns: boolean;
  weeklyDigest: boolean;
};

type PrivacySettings = {
  shareAnalytics: boolean;
  diaryVisibility: DiaryVisibility;
  dataCollection: boolean;
  discoverableByEmail: boolean;
};

type SecuritySettings = {
  biometricLogin: boolean;
  twoFactorAuth: boolean;
  autoLockMinutes: number;
};

type AppearanceSettings = {
  theme: ThemePreference;
  accentColor: "blue" | "purple" | "teal" | "orange";
  textSize: "small" | "medium" | "large";
};

type UnitsSettings = {
  energy: EnergyUnit;
  weight: WeightUnit;
  distance: DistanceUnit;
  language: LanguageCode;
};

type DataSettings = {
  autoBackup: boolean;
  includeWorkouts: boolean;
  lastExport?: string;
};

type IntegrationSettings = {
  googleFit: boolean;
  appleHealth: boolean;
  fitbit: boolean;
};

type AboutSettings = {
  version: string;
  buildNumber: string;
  releaseChannel: "alpha" | "beta" | "stable";
  supportEmail: string;
  website: string;
};

export type SettingsState = {
  account: AccountSettings;
  goals: GoalsSettings;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  security: SecuritySettings;
  appearance: AppearanceSettings;
  units: UnitsSettings;
  data: DataSettings;
  integrations: IntegrationSettings;
  about: AboutSettings;
};

const STORAGE_KEY = "macropal.settings";

const createDefaultSettings = (): SettingsState => ({
  account: {
    email: "you@example.com",
    displayName: "MacroPal User",
    timeZone: "UTC",
  },
  goals: {
    goal: "maintain",
    calorieTarget: 2200,
    proteinTarget: 140,
    carbTarget: 260,
    fatTarget: 70,
    waterTarget: 3200,
  },
  notifications: {
    dailySummary: true,
    pushEnabled: false,
    mealReminders: false,
    goalCheckIns: true,
    weeklyDigest: true,
  },
  privacy: {
    shareAnalytics: true,
    diaryVisibility: "friends",
    dataCollection: true,
    discoverableByEmail: false,
  },
  security: {
    biometricLogin: false,
    twoFactorAuth: false,
    autoLockMinutes: 10,
  },
  appearance: {
    theme: "system",
    accentColor: "blue",
    textSize: "medium",
  },
  units: {
    energy: "kcal",
    weight: "kg",
    distance: "km",
    language: "en",
  },
  data: {
    autoBackup: true,
    includeWorkouts: true,
    lastExport: undefined,
  },
  integrations: {
    googleFit: false,
    appleHealth: false,
    fitbit: false,
  },
  about: {
    version: "0.2.0",
    buildNumber: "2024.04",
    releaseChannel: "alpha",
    supportEmail: "support@macropal.app",
    website: "https://macropal.app",
  },
});

type SettingsContextValue = {
  settings: SettingsState;
  updateSettings: <K extends keyof SettingsState>(
    section: K,
    updates: Partial<SettingsState[K]>
  ) => void;
  restoreSection: <K extends keyof SettingsState>(section: K) => void;
  resetSettings: () => void;
  getDefaultSection: <K extends keyof SettingsState>(section: K) => SettingsState[K];
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const loadSettings = (): SettingsState => {
  if (typeof window === "undefined") {
    return createDefaultSettings();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultSettings();
    }
    const parsed = JSON.parse(raw) as Partial<SettingsState>;
    const defaults = createDefaultSettings();
    return {
      ...defaults,
      ...parsed,
      account: { ...defaults.account, ...parsed.account },
      goals: { ...defaults.goals, ...parsed.goals },
      notifications: {
        ...defaults.notifications,
        ...parsed.notifications,
      },
      privacy: { ...defaults.privacy, ...parsed.privacy },
      security: { ...defaults.security, ...parsed.security },
      appearance: {
        ...defaults.appearance,
        ...parsed.appearance,
      },
      units: { ...defaults.units, ...parsed.units },
      data: { ...defaults.data, ...parsed.data },
      integrations: {
        ...defaults.integrations,
        ...parsed.integrations,
      },
      about: { ...defaults.about, ...parsed.about },
    };
  } catch (error) {
    console.warn("Failed to parse settings from storage", error);
    return createDefaultSettings();
  }
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = useCallback(
    <K extends keyof SettingsState>(
      section: K,
      updates: Partial<SettingsState[K]>
    ) => {
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

  const restoreSection = useCallback(
    <K extends keyof SettingsState>(section: K) => {
      const defaults = createDefaultSettings();
      setSettings((prev) => ({
        ...prev,
        [section]: defaults[section],
      }));
    },
    []
  );

  const resetSettings = useCallback(() => {
    setSettings(createDefaultSettings());
  }, []);

  const getDefaultSection = useCallback(<K extends keyof SettingsState>(section: K) => {
    const defaults = createDefaultSettings();
    return defaults[section];
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      restoreSection,
      resetSettings,
      getDefaultSection,
    }),
    [settings, updateSettings, restoreSection, resetSettings, getDefaultSection]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextValue => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export type {
  AccountSettings,
  GoalsSettings,
  NotificationSettings,
  PrivacySettings,
  SecuritySettings,
  AppearanceSettings,
  UnitsSettings,
  DataSettings,
  IntegrationSettings,
  AboutSettings,
  MacroGoal,
  ThemePreference,
  DiaryVisibility,
  EnergyUnit,
  WeightUnit,
  DistanceUnit,
  LanguageCode,
};
