import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonText,
} from "@ionic/react";
import { ComponentType, useMemo } from "react";
import { useParams } from "react-router";
import { SETTINGS_SECTIONS } from "../Settings";
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

type Params = { section: string };

type SectionComponent = ComponentType;

const SECTION_COMPONENTS: Record<string, SectionComponent> = {
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

  const sectionConfig = useMemo(
    () => SETTINGS_SECTIONS.find((item) => item.key === section),
    [section]
  );

  const SectionContent = section ? SECTION_COMPONENTS[section] : undefined;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>{sectionConfig?.label ?? "Settings"}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {SectionContent ? (
          <SectionContent />
        ) : (
          <IonText color="medium">
            <p>This settings section could not be found.</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
};

export default SettingsSection;
