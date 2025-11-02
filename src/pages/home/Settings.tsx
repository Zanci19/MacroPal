import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
} from "@ionic/react";
import {
  personCircleOutline,
  createOutline,
  notificationsOutline,
  shieldCheckmarkOutline,
  lockClosedOutline,
  colorPaletteOutline,
  swapVerticalOutline,
  cloudUploadOutline,
  linkOutline,
  informationCircleOutline,
} from "ionicons/icons";

export type SettingsSectionKey =
  | "account"
  | "goals"
  | "notifications"
  | "privacy"
  | "security"
  | "appearance"
  | "units"
  | "data"
  | "integrations"
  | "about";

export type SettingsSection = {
  key: SettingsSectionKey;
  label: string;
  description: string;
  icon: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    key: "account",
    label: "Account",
    description: "Manage your profile, contact details, and time zone.",
    icon: personCircleOutline,
  },
  {
    key: "goals",
    label: "Goals & Preferences",
    description: "Adjust calorie targets, macro ratios, and hydration goals.",
    icon: createOutline,
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Choose when MacroPal should nudge you.",
    icon: notificationsOutline,
  },
  {
    key: "privacy",
    label: "Privacy",
    description: "Control how your data and diary are shared.",
    icon: shieldCheckmarkOutline,
  },
  {
    key: "security",
    label: "Security",
    description: "Configure sign-in safety and session preferences.",
    icon: lockClosedOutline,
  },
  {
    key: "appearance",
    label: "Appearance",
    description: "Switch themes, accent colors, and reading preferences.",
    icon: colorPaletteOutline,
  },
  {
    key: "units",
    label: "Units & Localization",
    description: "Pick your measurement units and language.",
    icon: swapVerticalOutline,
  },
  {
    key: "data",
    label: "Data & Backup",
    description: "Export logs or manage backup preferences.",
    icon: cloudUploadOutline,
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Connect to health platforms and wearables.",
    icon: linkOutline,
  },
  {
    key: "about",
    label: "About MacroPal",
    description: "App version, documentation, and support.",
    icon: informationCircleOutline,
  },
];

const Settings: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonListHeader lines="none">
            <IonLabel>
              <h2>Make MacroPal yours</h2>
              <IonNote>
                Browse the categories below to personalize how the app looks,
                feels, and keeps you on track.
              </IonNote>
            </IonLabel>
          </IonListHeader>
          {SETTINGS_SECTIONS.map((section) => (
            <IonItem
              key={section.key}
              routerLink={`/app/settings/${section.key}`}
              detail
            >
              <IonIcon slot="start" icon={section.icon} />
              <IonLabel>
                <h2>{section.label}</h2>
                <p>{section.description}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
