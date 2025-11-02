import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonButton,
  IonButtons,
  IonIcon,
  IonNote,
  useIonToast,
  ToggleChangeEventDetail,
} from "@ionic/react";
import { logoGoogle, logoApple, pulseOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useSettings, IntegrationSettings } from "../../../context/SettingsContext";

type IntegrationsFormState = IntegrationSettings;

const SERVICE_LABELS: Record<keyof IntegrationsFormState, string> = {
  googleFit: "Google Fit",
  appleHealth: "Apple Health",
  fitbit: "Fitbit",
};

const SettingsIntegrations: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<IntegrationsFormState>(settings.integrations);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.integrations);
  }, [settings.integrations]);

  const handleToggle = (
    field: keyof IntegrationsFormState,
    event: CustomEvent<ToggleChangeEventDetail>
  ) => {
    const value = event.detail.checked;
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    updateSettings("integrations", { [field]: value });
  };

  const handleConnect = (service: keyof IntegrationsFormState) => {
    updateSettings("integrations", { [service]: true });
    setForm((prev) => ({ ...prev, [service]: true }));
    present({
      message: `Connected to ${SERVICE_LABELS[service]}`,
      duration: 1500,
      color: "success",
    });
  };

  const handleDisconnect = (service: keyof IntegrationsFormState) => {
    updateSettings("integrations", { [service]: false });
    setForm((prev) => ({ ...prev, [service]: false }));
    present({
      message: `Disconnected from ${SERVICE_LABELS[service]}`,
      duration: 1500,
      color: "medium",
    });
  };

  const handleReset = () => {
    restoreSection("integrations");
    setForm(getDefaultSection("integrations"));
    present({
      message: "Integrations reset",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Google Fit</IonLabel>
          <IonToggle
            checked={form.googleFit}
            onIonChange={(event) => handleToggle("googleFit", event)}
          />
          <IonNote slot="helper">Sync steps and workouts automatically.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Apple Health</IonLabel>
          <IonToggle
            checked={form.appleHealth}
            onIonChange={(event) => handleToggle("appleHealth", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Fitbit</IonLabel>
          <IonToggle
            checked={form.fitbit}
            onIonChange={(event) => handleToggle("fitbit", event)}
          />
        </IonItem>
      </IonList>

      <IonButtons className="ion-padding-top ion-justify-content-around">
        <IonButton
          fill="outline"
          onClick={() =>
            form.googleFit ? handleDisconnect("googleFit") : handleConnect("googleFit")
          }
        >
          <IonIcon slot="start" icon={logoGoogle} />
          {form.googleFit ? "Disconnect" : "Connect"}
        </IonButton>
        <IonButton
          fill="outline"
          onClick={() =>
            form.appleHealth
              ? handleDisconnect("appleHealth")
              : handleConnect("appleHealth")
          }
        >
          <IonIcon slot="start" icon={logoApple} />
          {form.appleHealth ? "Disconnect" : "Connect"}
        </IonButton>
        <IonButton
          fill="outline"
          onClick={() =>
            form.fitbit ? handleDisconnect("fitbit") : handleConnect("fitbit")
          }
        >
          <IonIcon slot="start" icon={pulseOutline} />
          {form.fitbit ? "Disconnect" : "Connect"}
        </IonButton>
      </IonButtons>

      <IonButton
        expand="block"
        fill="clear"
        color="medium"
        className="ion-margin-top"
        onClick={handleReset}
      >
        Reset to defaults
      </IonButton>
    </div>
  );
};

export default SettingsIntegrations;
