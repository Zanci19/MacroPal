import { IonList, IonItem, IonLabel, IonToggle, IonNote } from "@ionic/react";
import { useSettings } from "../../../context/SettingsContext";

type IntegrationKey = "googleFitConnected" | "appleHealthConnected";

const SettingsIntegrations: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const { integrations } = settings;

  const toggleIntegration = (key: IntegrationKey, value: boolean) => {
    updateSection("integrations", { [key]: value } as Partial<typeof integrations>);
  };

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Google Fit</IonLabel>
        <IonToggle
          checked={integrations.googleFitConnected}
          onIonChange={(event) => toggleIntegration("googleFitConnected", event.detail.checked)}
        />
      </IonItem>
      <IonItem>
        <IonLabel>Apple Health</IonLabel>
        <IonToggle
          checked={integrations.appleHealthConnected}
          onIonChange={(event) => toggleIntegration("appleHealthConnected", event.detail.checked)}
        />
      </IonItem>
      <IonItem lines="none">
        <IonNote color="medium">
          Connection status is stored locally. When enabled MacroPal will sync steps and workouts
          into your diary.
        </IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsIntegrations;
