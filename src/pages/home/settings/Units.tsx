import {
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonNote,
} from "@ionic/react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsUnits: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const { units } = settings;

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Energy unit</IonLabel>
        <IonSelect
          interface="popover"
          value={units.energy}
          onIonChange={(event) =>
            updateSection("units", { energy: event.detail.value })
          }
        >
          <IonSelectOption value="kcal">Kilocalories (kcal)</IonSelectOption>
          <IonSelectOption value="kJ">Kilojoules (kJ)</IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem>
        <IonLabel>Weight unit</IonLabel>
        <IonSelect
          interface="popover"
          value={units.weight}
          onIonChange={(event) =>
            updateSection("units", { weight: event.detail.value })
          }
        >
          <IonSelectOption value="kg">Kilograms (kg)</IonSelectOption>
          <IonSelectOption value="lb">Pounds (lb)</IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem>
        <IonLabel>Language</IonLabel>
        <IonSelect
          interface="popover"
          value={units.language}
          onIonChange={(event) =>
            updateSection("units", { language: event.detail.value })
          }
        >
          <IonSelectOption value="en">English</IonSelectOption>
          <IonSelectOption value="es">Español</IonSelectOption>
          <IonSelectOption value="sl">Slovenščina</IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem lines="none">
        <IonNote color="medium">
          Changes here update nutrition summaries and localisation across the app.
        </IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsUnits;
