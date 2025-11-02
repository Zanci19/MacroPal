import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonNote,
  IonButton,
  IonIcon,
  useIonToast,
  ToggleChangeEventDetail,
} from "@ionic/react";
import { cloudDownloadOutline, cloudUploadOutline, trashOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import { useSettings, DataSettings } from "../../../context/SettingsContext";

type DataFormState = DataSettings;

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) {
    return "No exports yet";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown export time";
  }
  return date.toLocaleString();
};

const SettingsData: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<DataFormState>(settings.data);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.data);
  }, [settings.data]);

  const handleToggle = (
    field: keyof Omit<DataFormState, "lastExport">,
    event: CustomEvent<ToggleChangeEventDetail>
  ) => {
    const checked = event.detail.checked;
    setForm((prev) => ({
      ...prev,
      [field]: checked,
    }));
  };

  const persist = (updates: Partial<DataFormState>, message: string) => {
    setForm((prev) => {
      const next = { ...prev, ...updates };
      updateSettings("data", next);
      return next;
    });
    present({ message, duration: 1500, color: "success" });
  };

  const handleExport = (format: "csv" | "json") => {
    const timestamp = new Date().toISOString();
    persist({ lastExport: timestamp }, `Exporting diary as ${format.toUpperCase()}…`);
  };

  const handleImport = () => {
    present({ message: "Import flow coming soon", duration: 1500, color: "medium" });
  };

  const handleSave = () => {
    updateSettings("data", form);
    present({ message: "Data settings saved", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("data");
    setForm(getDefaultSection("data"));
    present({
      message: "Data preferences reset",
      duration: 1500,
      color: "medium",
    });
  };

  const handleClearExports = () => {
    persist({ lastExport: undefined }, "Export history cleared");
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Automatic backup</IonLabel>
          <IonToggle
            checked={form.autoBackup}
            onIonChange={(event) => handleToggle("autoBackup", event)}
          />
          <IonNote slot="helper">BETA: syncs your diary once per day.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Include workouts in exports</IonLabel>
          <IonToggle
            checked={form.includeWorkouts}
            onIonChange={(event) => handleToggle("includeWorkouts", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Last export</IonLabel>
          <IonNote slot="end">{formatTimestamp(form.lastExport)}</IonNote>
        </IonItem>
      </IonList>

      <div className="ion-padding-top ion-text-center">
        <IonButton onClick={() => handleExport("csv")}>
          <IonIcon icon={cloudDownloadOutline} slot="start" />
          Export CSV
        </IonButton>
        <IonButton onClick={() => handleExport("json")}>
          <IonIcon icon={cloudDownloadOutline} slot="start" />
          Export JSON
        </IonButton>
      </div>

      <div className="ion-padding-top ion-text-center">
        <IonButton fill="outline" onClick={handleImport}>
          <IonIcon icon={cloudUploadOutline} slot="start" />
          Import data
        </IonButton>
        <IonButton color="danger" fill="outline" onClick={handleClearExports}>
          <IonIcon icon={trashOutline} slot="start" />
          Clear history
        </IonButton>
      </div>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save backup settings
      </IonButton>
      <IonButton
        expand="block"
        fill="clear"
        color="medium"
        onClick={handleReset}
      >
        Reset to defaults
      </IonButton>
    </div>
  );
};

export default SettingsData;
