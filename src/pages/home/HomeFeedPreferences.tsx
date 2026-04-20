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
  IonSpinner,
  IonText,
  IonToast,
  IonToggle,
} from "@ionic/react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db, trackEvent } from "../../firebase";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import "./HomeFeedPreferences.css";

interface UserProfile {
  showWellnessTip?: boolean;
  showAchievements?: boolean;
  showRecentItems?: boolean;
  showRecentSearches?: boolean;
}

interface UserData {
  profile?: UserProfile;
}

const HomeFeedPreferences: React.FC = () => {
  const user = auth.currentUser;
  const [loading, setLoading] = React.useState(true);
  const [showRandomQuoteEnabled, setShowRandomQuoteEnabled] = React.useState(true);
  const [showAchievementsEnabled, setShowAchievementsEnabled] = React.useState(true);
  const [showRecentItemsEnabled, setShowRecentItemsEnabled] = React.useState(true);
  const [showRecentSearchesEnabled, setShowRecentSearchesEnabled] = React.useState(true);
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

        setShowRandomQuoteEnabled(
          typeof profile?.showWellnessTip === "boolean" ? profile.showWellnessTip : true
        );
        setShowAchievementsEnabled(
          typeof profile?.showAchievements === "boolean" ? profile.showAchievements : true
        );
        setShowRecentItemsEnabled(
          typeof profile?.showRecentItems === "boolean" ? profile.showRecentItems : true
        );
        setShowRecentSearchesEnabled(
          typeof profile?.showRecentSearches === "boolean" ? profile.showRecentSearches : true
        );
      } catch (error: unknown) {
        const err = error as Error;
        setToast({
          show: true,
          message: err?.message || "Could not load home feed settings.",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateHomeFeedSetting = async (
    field:
      | "showWellnessTip"
      | "showAchievements"
      | "showRecentItems"
      | "showRecentSearches",
    checked: boolean,
    eventName:
      | "settings_show_random_quote_toggle"
      | "settings_show_achievements_toggle"
      | "settings_show_recent_items_toggle"
      | "settings_show_recent_searches_toggle",
    onErrorMessage: string,
    rollback?: () => void
  ) => {
    const current = auth.currentUser;
    if (!current) return;

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        [`profile.${field}`]: checked,
      });
      trackEvent(eventName, {
        uid: current.uid,
        enabled: checked,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to save home feed preference:", err);
      rollback?.();
      setToast({
        show: true,
        message: err?.message || onErrorMessage,
        color: "danger",
      });
    }
  };

  const restoreDefaults = async () => {
    const current = auth.currentUser;
    if (!current) return;

    const previous = {
      showWellnessTip: showRandomQuoteEnabled,
      showAchievements: showAchievementsEnabled,
      showRecentItems: showRecentItemsEnabled,
      showRecentSearches: showRecentSearchesEnabled,
    };

    setShowRandomQuoteEnabled(true);
    setShowAchievementsEnabled(true);
    setShowRecentItemsEnabled(true);
    setShowRecentSearchesEnabled(true);

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.showWellnessTip": true,
        "profile.showAchievements": true,
        "profile.showRecentItems": true,
        "profile.showRecentSearches": true,
      });
      trackEvent("settings_home_feed_reset_defaults", { uid: current.uid });
      setToast({
        show: true,
        message: "Home feed defaults restored.",
        color: "success",
      });
    } catch (error: unknown) {
      const err = error as Error;
      setShowRandomQuoteEnabled(previous.showWellnessTip);
      setShowAchievementsEnabled(previous.showAchievements);
      setShowRecentItemsEnabled(previous.showRecentItems);
      setShowRecentSearchesEnabled(previous.showRecentSearches);
      setToast({
        show: true,
        message: err?.message || "Could not restore defaults.",
        color: "danger",
      });
    }
  };

  if (!user) {
    return (
      <SettingsSubpageLayout
        title="Customize home feed"
        subtitle="Choose which helper sections appear on Home and Add Food."
        backHref={SETTINGS_ROUTES.root}
        className="home-feed-preferences-page"
      >
        <IonText color="medium">You are not logged in.</IonText>
      </SettingsSubpageLayout>
    );
  }

  return (
    <SettingsSubpageLayout
      title="Customize home feed"
      subtitle="Choose which helper sections appear on Home and Add Food."
      backHref={SETTINGS_ROUTES.root}
      className="home-feed-preferences-page"
    >
      {loading ? (
        <div className="home-feed-preferences-loading">
          <IonSpinner />
          <p>Loading preferences…</p>
        </div>
      ) : (
        <IonCard>
          <IonCardHeader>
            <IonCardTitle className="home-feed-preferences-title">Home & Add Food widgets</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonList>
              <IonItem lines="full">
                <IonLabel>Show daily quote on Home</IonLabel>
                <IonToggle
                  slot="end"
                  checked={showRandomQuoteEnabled}
                  onIonChange={(e) => {
                    const checked = e.detail.checked;
                    const previous = showRandomQuoteEnabled;
                    setShowRandomQuoteEnabled(checked);
                    void updateHomeFeedSetting(
                      "showWellnessTip",
                      checked,
                      "settings_show_random_quote_toggle",
                      "Could not update random quote setting.",
                      () => setShowRandomQuoteEnabled(previous)
                    );
                  }}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel>Show streak note on Home</IonLabel>
                <IonToggle
                  slot="end"
                  checked={showAchievementsEnabled}
                  onIonChange={(e) => {
                    const checked = e.detail.checked;
                    const previous = showAchievementsEnabled;
                    setShowAchievementsEnabled(checked);
                    void updateHomeFeedSetting(
                      "showAchievements",
                      checked,
                      "settings_show_achievements_toggle",
                      "Could not update achievements setting.",
                      () => setShowAchievementsEnabled(previous)
                    );
                  }}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel>Show history chips in Add Food</IonLabel>
                <IonToggle
                  slot="end"
                  checked={showRecentItemsEnabled}
                  onIonChange={(e) => {
                    const checked = e.detail.checked;
                    const previous = showRecentItemsEnabled;
                    setShowRecentItemsEnabled(checked);
                    void updateHomeFeedSetting(
                      "showRecentItems",
                      checked,
                      "settings_show_recent_items_toggle",
                      "Could not update recent items setting.",
                      () => setShowRecentItemsEnabled(previous)
                    );
                  }}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Show recent search chips in Add Food</IonLabel>
                <IonToggle
                  slot="end"
                  checked={showRecentSearchesEnabled}
                  onIonChange={(e) => {
                    const checked = e.detail.checked;
                    const previous = showRecentSearchesEnabled;
                    setShowRecentSearchesEnabled(checked);
                    void updateHomeFeedSetting(
                      "showRecentSearches",
                      checked,
                      "settings_show_recent_searches_toggle",
                      "Could not update recent searches setting.",
                      () => setShowRecentSearchesEnabled(previous)
                    );
                  }}
                />
              </IonItem>
            </IonList>
            <IonButton expand="block" fill="outline" onClick={() => void restoreDefaults()}>
              Restore defaults
            </IonButton>
          </IonCardContent>
        </IonCard>
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

export default HomeFeedPreferences;
