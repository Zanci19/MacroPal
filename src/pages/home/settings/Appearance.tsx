import {
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonButton,
  useIonToast,
  SelectChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings, AppearanceSettings } from "../../../context/SettingsContext";

type AppearanceFormState = AppearanceSettings;

const SettingsAppearance: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<AppearanceFormState>(settings.appearance);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.appearance);
  }, [settings.appearance]);

  const handleSelect = <K extends keyof AppearanceFormState>(
    field: K,
    event: CustomEvent<SelectChangeEventDetail<AppearanceFormState[K]>>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.value,
    }));
  };

  const handleSave = () => {
    updateSettings("appearance", form);
    present({ message: "Appearance updated", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("appearance");
    setForm(getDefaultSection("appearance"));
    present({
      message: "Appearance reset",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Theme</IonLabel>
          <IonSelect
            interface="popover"
            value={form.theme}
            onIonChange={(event) => handleSelect("theme", event)}
          >
            <IonSelectOption value="light">Light</IonSelectOption>
            <IonSelectOption value="dark">Dark</IonSelectOption>
            <IonSelectOption value="system">Use system default</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonLabel>Accent color</IonLabel>
          <IonSelect
            interface="popover"
            value={form.accentColor}
            onIonChange={(event) => handleSelect("accentColor", event)}
          >
            <IonSelectOption value="blue">Ocean blue</IonSelectOption>
            <IonSelectOption value="purple">Grape purple</IonSelectOption>
            <IonSelectOption value="teal">Mint teal</IonSelectOption>
            <IonSelectOption value="orange">Sunset orange</IonSelectOption>
          </IonSelect>
          <IonNote slot="helper">Affects graphs, buttons, and highlights.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Text size</IonLabel>
          <IonSelect
            interface="popover"
            value={form.textSize}
            onIonChange={(event) => handleSelect("textSize", event)}
          >
            <IonSelectOption value="small">Compact</IonSelectOption>
            <IonSelectOption value="medium">Comfortable</IonSelectOption>
            <IonSelectOption value="large">Large</IonSelectOption>
          </IonSelect>
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Apply appearance
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

export default SettingsAppearance;
