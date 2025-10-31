import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon
} from "@ionic/react";
import {
  personCircleOutline, createOutline, notificationsOutline, shieldCheckmarkOutline,
  lockClosedOutline, colorPaletteOutline, swapVerticalOutline, cloudUploadOutline,
  linkOutline, informationCircleOutline
} from "ionicons/icons";

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
              <IonLabel>{s.label}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
