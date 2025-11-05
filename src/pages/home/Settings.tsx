import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonNote,
} from "@ionic/react";
import {
  personCircleOutline, createOutline, notificationsOutline, shieldCheckmarkOutline,
  lockClosedOutline, colorPaletteOutline, swapVerticalOutline, cloudUploadOutline,
  linkOutline, informationCircleOutline
} from "ionicons/icons";
import { useMemo } from "react";
import { useSettings } from "../../context/SettingsContext";

// Single source of truth for sections
export const SETTINGS_SECTIONS: { key: string; label: string; icon?: string }[] = [
  { key: "account",         label: "Account",                icon: personCircleOutline },
  { key: "goals",           label: "Goals & Preferences",    icon: createOutline },
  { key: "notifications",   label: "Notifications",          icon: notificationsOutline },
  { key: "privacy",         label: "Privacy",                icon: shieldCheckmarkOutline },
  { key: "security",        label: "Security",               icon: lockClosedOutline },
  { key: "appearance",      label: "Appearance",             icon: colorPaletteOutline },
  { key: "units",           label: "Units & Localization",   icon: swapVerticalOutline },
  { key: "data",            label: "Data & Export",          icon: cloudUploadOutline },
  { key: "integrations",    label: "Integrations",           icon: linkOutline },
  { key: "about",           label: "About",                  icon: informationCircleOutline },
];

const Settings: React.FC = () => {
  const { settings } = useSettings();

  const detailText = useMemo(() => ({
    account: settings.account.displayName || settings.account.email,
    goals: `${settings.goals.calorieTarget} kcal goal`,
    notifications: settings.notifications.dailySummary ? "Daily summary on" : "Daily summary off",
    privacy: settings.privacy.diaryPrivate ? "Diary hidden" : "Diary visible",
    security: settings.security.requirePin ? "PIN enabled" : "PIN not set",
    appearance:
      settings.appearance.theme === "system"
        ? "Theme follows system"
        : `Theme: ${settings.appearance.theme}`,
    units: `${settings.units.energy} · ${settings.units.weight}`,
    data: "Import / export",
    integrations: [
      settings.integrations.googleFitConnected ? "Google Fit" : null,
      settings.integrations.appleHealthConnected ? "Apple Health" : null,
    ]
      .filter(Boolean)
      .join(", ") || "No integrations",
    about: "Version info",
  }), [settings]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          {SETTINGS_SECTIONS.map((s) => (
            <IonItem key={s.key} detail routerLink={`/app/settings/${s.key}`}>
              {s.icon && <IonIcon slot="start" icon={s.icon} />}
              <IonLabel>
                <h2>{s.label}</h2>
                <IonNote>{detailText[s.key as keyof typeof detailText]}</IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
