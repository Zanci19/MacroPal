import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
} from "@ionic/react";
import type { FC } from "react";
import { useMemo } from "react";
import { useParams } from "react-router";
import { SETTINGS_SECTIONS, SettingsSectionKey } from "../Settings";
import SettingsAccount from "./Account";
import SettingsGoals from "./Goals";
import SettingsNotifications from "./Notifications";
import SettingsPrivacy from "./Privacy";
import SettingsSecurity from "./Security";
import SettingsAppearance from "./Appearance";
import SettingsUnits from "./Units";
import SettingsData from "./Data";
import SettingsIntegrations from "./Integrations";
import SettingsAbout from "./About";

type Params = {
  section: SettingsSectionKey;
};

type SectionComponentMap = Partial<Record<SettingsSectionKey, FC>>;

const SECTION_COMPONENTS: SectionComponentMap = {
  account: SettingsAccount,
  goals: SettingsGoals,
  notifications: SettingsNotifications,
  privacy: SettingsPrivacy,
  security: SettingsSecurity,
  appearance: SettingsAppearance,
  units: SettingsUnits,
  data: SettingsData,
  integrations: SettingsIntegrations,
  about: SettingsAbout,
};

const SettingsSection: React.FC = () => {
  const { section } = useParams<Params>();

  const SectionTitle = useMemo(() => {
    const match = SETTINGS_SECTIONS.find((entry) => entry.key === section);
    return match?.label ?? "Settings";
  }, [section]);

  const SectionComponent = SECTION_COMPONENTS[section];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>{SectionTitle}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {SectionComponent ? (
          <SectionComponent />
        ) : (
          <IonList inset>
            <IonItem lines="none">
              <IonLabel>
                <h2>Section not found</h2>
                <p>Try selecting a different settings category.</p>
              </IonLabel>
            </IonItem>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default SettingsSection;
