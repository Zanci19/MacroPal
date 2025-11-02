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
import { useSettings, UnitsSettings } from "../../../context/SettingsContext";

type UnitsFormState = UnitsSettings;

const SettingsUnits: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<UnitsFormState>(settings.units);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.units);
  }, [settings.units]);

  const handleSelect = <K extends keyof UnitsFormState>(
    field: K,
    event: CustomEvent<SelectChangeEventDetail<UnitsFormState[K]>>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.value,
    }));
  };

  const handleSave = () => {
    updateSettings("units", form);
    present({ message: "Units updated", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("units");
    setForm(getDefaultSection("units"));
    present({
      message: "Units reset",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Energy</IonLabel>
          <IonSelect
            interface="popover"
            value={form.energy}
            onIonChange={(event) => handleSelect("energy", event)}
          >
            <IonSelectOption value="kcal">Calories (kcal)</IonSelectOption>
            <IonSelectOption value="kJ">Kilojoules (kJ)</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonLabel>Weight</IonLabel>
          <IonSelect
            interface="popover"
            value={form.weight}
            onIonChange={(event) => handleSelect("weight", event)}
          >
            <IonSelectOption value="kg">Kilograms</IonSelectOption>
            <IonSelectOption value="lb">Pounds</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonLabel>Distance</IonLabel>
          <IonSelect
            interface="popover"
            value={form.distance}
            onIonChange={(event) => handleSelect("distance", event)}
          >
            <IonSelectOption value="km">Kilometers</IonSelectOption>
            <IonSelectOption value="mi">Miles</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonLabel>Language</IonLabel>
          <IonSelect
            interface="popover"
            value={form.language}
            onIonChange={(event) => handleSelect("language", event)}
          >
            <IonSelectOption value="en">English</IonSelectOption>
            <IonSelectOption value="es">Español</IonSelectOption>
            <IonSelectOption value="de">Deutsch</IonSelectOption>
          </IonSelect>
          <IonNote slot="helper">Language changes apply after restarting MacroPal.</IonNote>
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save preferences
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

export default SettingsUnits;
