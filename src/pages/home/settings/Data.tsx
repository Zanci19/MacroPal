import {
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonNote,
  useIonToast,
} from "@ionic/react";
import { downloadOutline, refreshOutline, cloudUploadOutline } from "ionicons/icons";
import { ChangeEvent, useRef } from "react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsData: React.FC = () => {
  const { settings, importSettings, resetSettings } = useSettings();
  const [present] = useIonToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      importSettings(parsed);
      present({
        message: "Settings imported.",
        duration: 1500,
        color: "success",
      });
    } catch (error) {
      console.error(error);
      present({
        message: "Import failed. Please select a valid MacroPal settings file.",
        duration: 2500,
        color: "danger",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `macropal-settings-${new Date().toISOString().split("T")[0]}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    present({
      message: "Settings exported to downloads.",
      duration: 1500,
      color: "success",
    });
  };

  const handleReset = () => {
    resetSettings();
    present({
      message: "Settings restored to defaults.",
      duration: 1500,
      color: "success",
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleImport}
      />
      <IonList inset>
        <IonItem button detail onClick={handleExport}>
          <IonIcon slot="start" icon={downloadOutline} />
          <IonLabel>Export settings (JSON)</IonLabel>
        </IonItem>
        <IonItem button detail onClick={triggerFileDialog}>
          <IonIcon slot="start" icon={cloudUploadOutline} />
          <IonLabel>Import settings</IonLabel>
        </IonItem>
        <IonItem button detail onClick={handleReset}>
          <IonIcon slot="start" icon={refreshOutline} />
          <IonLabel color="danger">Reset to defaults</IonLabel>
        </IonItem>
        <IonItem lines="none">
          <IonNote color="medium">
            Export includes nutrition goals, preferences and integration flags. Reset restores the
            built-in MacroPal defaults.
          </IonNote>
        </IonItem>
      </IonList>
    </>
  );
};

export default SettingsData;
