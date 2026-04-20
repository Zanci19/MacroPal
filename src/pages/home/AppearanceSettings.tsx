import React from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonText,
  IonToast,
  IonToggle,
} from "@ionic/react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, trackEvent } from "../../firebase";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import {
  applyAnimationPreference,
  applyAutoExpandMealsPreference,
  applyChartAnimationPreference,
  applyDebugOverlayPreference,
  applyLazyLoadPreference,
  applyMealCountPreference,
  applyTheme,
  getAnimationPreference,
  getAutoExpandMealsPreference,
  getChartAnimationPreference,
  getDebugOverlayPreference,
  getLazyLoadPreference,
  getMealCountPreference,
  getStoredThemeMode,
  THEME_MODES,
  type ThemeMode,
} from "../../utils/preferences";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import "./AppearanceSettings.css";

interface UserProfile {
  themeMode?: string;
  tabAnimationsEnabled?: boolean;
  chartAnimationsEnabled?: boolean;
  debugOverlayEnabled?: boolean;
  lazyLoadEnabled?: boolean;
  autoExpandMeals?: boolean;
  showMealCounts?: boolean;
}

interface UserData {
  profile?: UserProfile;
}

const AppearanceSettings: React.FC = () => {
  const user = auth.currentUser;
  const [loading, setLoading] = React.useState(true);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => getStoredThemeMode());
  const [tabAnimationsEnabled, setTabAnimationsEnabled] = React.useState<boolean>(() =>
    getAnimationPreference()
  );
  const [chartAnimationsEnabled, setChartAnimationsEnabled] = React.useState<boolean>(() =>
    getChartAnimationPreference()
  );
  const [debugOverlayEnabled, setDebugOverlayEnabled] = React.useState<boolean>(() =>
    getDebugOverlayPreference()
  );
  const [lazyLoadEnabled, setLazyLoadEnabled] = React.useState<boolean>(() =>
    getLazyLoadPreference()
  );
  const [autoExpandMealsEnabled, setAutoExpandMealsEnabled] = React.useState<boolean>(() =>
    getAutoExpandMealsPreference()
  );
  const [showMealCountsEnabled, setShowMealCountsEnabled] = React.useState<boolean>(() =>
    getMealCountPreference()
  );
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  React.useEffect(() => {
    const load = async () => {
      const current = auth.currentUser;
      if (!current) {
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "users", current.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as UserData | undefined;
        const profile = data?.profile;

        const savedTheme = profile?.themeMode;
        if (savedTheme && THEME_MODES.includes(savedTheme as ThemeMode)) {
          const nextTheme = savedTheme as ThemeMode;
          setThemeMode(nextTheme);
          applyTheme(nextTheme);
        }

        const savedAnimationPref = profile?.tabAnimationsEnabled;
        if (typeof savedAnimationPref === "boolean") {
          setTabAnimationsEnabled(savedAnimationPref);
          applyAnimationPreference(savedAnimationPref);
        }

        const savedChartAnimationPref = profile?.chartAnimationsEnabled;
        if (typeof savedChartAnimationPref === "boolean") {
          setChartAnimationsEnabled(savedChartAnimationPref);
          applyChartAnimationPreference(savedChartAnimationPref);
        }

        const savedDebugOverlayPref = profile?.debugOverlayEnabled;
        if (typeof savedDebugOverlayPref === "boolean") {
          setDebugOverlayEnabled(savedDebugOverlayPref);
          applyDebugOverlayPreference(savedDebugOverlayPref);
        }

        const savedLazyLoadPref = profile?.lazyLoadEnabled;
        if (typeof savedLazyLoadPref === "boolean") {
          setLazyLoadEnabled(savedLazyLoadPref);
          applyLazyLoadPreference(savedLazyLoadPref);
        }

        const savedAutoExpandMealsPref = profile?.autoExpandMeals;
        if (typeof savedAutoExpandMealsPref === "boolean") {
          setAutoExpandMealsEnabled(savedAutoExpandMealsPref);
          applyAutoExpandMealsPreference(savedAutoExpandMealsPref);
        }

        const savedMealCountsPref = profile?.showMealCounts;
        if (typeof savedMealCountsPref === "boolean") {
          setShowMealCountsEnabled(savedMealCountsPref);
          applyMealCountPreference(savedMealCountsPref);
        }
      } catch (error: unknown) {
        const err = error as Error;
        setToast({
          show: true,
          message: err?.message || "Could not load appearance settings.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateProfilePreference = async (
    updates: Record<string, unknown>,
    eventName: string,
    eventData?: Record<string, unknown>
  ) => {
    const current = auth.currentUser;
    if (!current) return;

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, updates);
      trackEvent(eventName, {
        uid: current.uid,
        ...(eventData || {}),
      });
    } catch (error: unknown) {
      const err = error as Error;
      throw new Error(err?.message || "Could not save settings.");
    }
  };

  const handleThemeChange = async (newTheme: ThemeMode) => {
    const previousTheme = themeMode;
    setThemeMode(newTheme);
    applyTheme(newTheme);
    try {
      await updateProfilePreference(
        { "profile.themeMode": newTheme },
        "settings_theme_change",
        { theme: newTheme }
      );
    } catch (error: unknown) {
      const err = error as Error;
      setThemeMode(previousTheme);
      applyTheme(previousTheme);
      setToast({
        show: true,
        message: err?.message || "Could not save theme preference.",
        color: "danger",
      });
    }
  };

  const handleBooleanPreference = async (
    checked: boolean,
    currentValue: boolean,
    setValue: React.Dispatch<React.SetStateAction<boolean>>,
    applyValue: (enabled: boolean) => void,
    profileField:
      | "profile.tabAnimationsEnabled"
      | "profile.chartAnimationsEnabled"
      | "profile.debugOverlayEnabled"
      | "profile.lazyLoadEnabled"
      | "profile.autoExpandMeals"
      | "profile.showMealCounts",
    eventName: string,
    errorMessage: string
  ) => {
    setValue(checked);
    applyValue(checked);
    try {
      await updateProfilePreference(
        { [profileField]: checked },
        eventName,
        { enabled: checked }
      );
    } catch (error: unknown) {
      const err = error as Error;
      setValue(currentValue);
      applyValue(currentValue);
      setToast({
        show: true,
        message: err?.message || errorMessage,
        color: "danger",
      });
    }
  };

  const handleClearCachedPreferences = async () => {
    if (typeof window === "undefined") return;
    const keys = [
      "mp_theme",
      "mp_tab_animations",
      "mp_debug_overlay",
      "mp_lazy_load",
      "mp_chart_animations",
      "mp_auto_expand_meals",
      "mp_meal_counts",
    ];
    keys.forEach((key) => window.localStorage.removeItem(key));

    const nextTheme = getStoredThemeMode();
    const nextAnimations = getAnimationPreference();
    const nextChartAnimations = getChartAnimationPreference();
    const nextDebugOverlay = getDebugOverlayPreference();
    const nextLazyLoad = getLazyLoadPreference();
    const nextAutoExpand = getAutoExpandMealsPreference();
    const nextMealCounts = getMealCountPreference();

    setThemeMode(nextTheme);
    setTabAnimationsEnabled(nextAnimations);
    setChartAnimationsEnabled(nextChartAnimations);
    setDebugOverlayEnabled(nextDebugOverlay);
    setLazyLoadEnabled(nextLazyLoad);
    setAutoExpandMealsEnabled(nextAutoExpand);
    setShowMealCountsEnabled(nextMealCounts);

    applyTheme(nextTheme);
    applyAnimationPreference(nextAnimations);
    applyChartAnimationPreference(nextChartAnimations);
    applyDebugOverlayPreference(nextDebugOverlay);
    applyLazyLoadPreference(nextLazyLoad);
    applyAutoExpandMealsPreference(nextAutoExpand);
    applyMealCountPreference(nextMealCounts);

    try {
      await updateProfilePreference(
        {
          "profile.themeMode": nextTheme,
          "profile.tabAnimationsEnabled": nextAnimations,
          "profile.chartAnimationsEnabled": nextChartAnimations,
          "profile.debugOverlayEnabled": nextDebugOverlay,
          "profile.lazyLoadEnabled": nextLazyLoad,
          "profile.autoExpandMeals": nextAutoExpand,
          "profile.showMealCounts": nextMealCounts,
        },
        "settings_clear_cached_preferences",
        {
          theme: nextTheme,
        }
      );
      setToast({
        show: true,
        message: "Appearance and performance settings reset.",
        color: "success",
      });
    } catch (error: unknown) {
      const err = error as Error;
      setToast({
        show: true,
        message: err?.message || "Could not reset settings.",
        color: "danger",
      });
    }
  };

  if (!user) {
    return (
      <SettingsSubpageLayout
        title="Appearance & performance"
        subtitle="Customize visuals and performance behavior."
        backHref={SETTINGS_ROUTES.root}
        className="appearance-settings-page"
      >
        <IonText color="medium">You are not logged in.</IonText>
      </SettingsSubpageLayout>
    );
  }

  return (
    <SettingsSubpageLayout
      title="Appearance & performance"
      subtitle="Customize visuals and performance behavior."
      backHref={SETTINGS_ROUTES.root}
      className="appearance-settings-page"
    >
      {loading ? (
        <IonCard>
          <IonCardContent>Loading appearance settings…</IonCardContent>
        </IonCard>
      ) : (
        <>
          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="appearance-settings-title">Appearance</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="none">
                  <IonLabel>App theme</IonLabel>
                  <IonSelect
                    slot="end"
                    interface="popover"
                    value={themeMode}
                    onIonChange={(e) => {
                      void handleThemeChange(e.detail.value as ThemeMode);
                    }}
                  >
                    <IonSelectOption value="system">System Default</IonSelectOption>
                    <IonSelectOption value="light">Light</IonSelectOption>
                    <IonSelectOption value="dark">Dark</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="appearance-settings-title">Performance</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <IonLabel>Tab sliding animations</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={tabAnimationsEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        tabAnimationsEnabled,
                        setTabAnimationsEnabled,
                        applyAnimationPreference,
                        "profile.tabAnimationsEnabled",
                        "settings_tab_animations_toggle",
                        "Could not update tab animation setting."
                      );
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Chart animations</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={chartAnimationsEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        chartAnimationsEnabled,
                        setChartAnimationsEnabled,
                        applyChartAnimationPreference,
                        "profile.chartAnimationsEnabled",
                        "settings_chart_animations_toggle",
                        "Could not update chart animation setting."
                      );
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Show meal counts in Home</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showMealCountsEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        showMealCountsEnabled,
                        setShowMealCountsEnabled,
                        applyMealCountPreference,
                        "profile.showMealCounts",
                        "settings_show_meal_counts_toggle",
                        "Could not update meal counts setting."
                      );
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Auto-expand meals with food</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={autoExpandMealsEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        autoExpandMealsEnabled,
                        setAutoExpandMealsEnabled,
                        applyAutoExpandMealsPreference,
                        "profile.autoExpandMeals",
                        "settings_auto_expand_meals_toggle",
                        "Could not update auto expand setting."
                      );
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Debug overlay</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={debugOverlayEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        debugOverlayEnabled,
                        setDebugOverlayEnabled,
                        applyDebugOverlayPreference,
                        "profile.debugOverlayEnabled",
                        "settings_debug_overlay_toggle",
                        "Could not update debug overlay setting."
                      );
                    }}
                  />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel>Lazy load routes</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={lazyLoadEnabled}
                    onIonChange={(e) => {
                      void handleBooleanPreference(
                        e.detail.checked,
                        lazyLoadEnabled,
                        setLazyLoadEnabled,
                        applyLazyLoadPreference,
                        "profile.lazyLoadEnabled",
                        "settings_lazy_load_toggle",
                        "Could not update lazy load setting."
                      );
                    }}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="appearance-settings-title">Reset</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonButton expand="block" fill="outline" onClick={() => {
                void handleClearCachedPreferences();
              }}>
                Reset appearance/performance settings
              </IonButton>
            </IonCardContent>
          </IonCard>
        </>
      )}

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2200}
        onDidDismiss={() => setToast((t) => ({ ...t, show: false, message: "" }))}
      />
    </SettingsSubpageLayout>
  );
};

export default AppearanceSettings;
