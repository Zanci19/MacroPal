import {
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonNote,
} from "@ionic/react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsAppearance: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const { appearance } = settings;

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Theme</IonLabel>
        <IonSelect
          interface="popover"
          value={appearance.theme}
          onIonChange={(event) =>
            updateSection("appearance", { theme: event.detail.value })
          }
        >
          <IonSelectOption value="light">Light</IonSelectOption>
          <IonSelectOption value="dark">Dark</IonSelectOption>
          <IonSelectOption value="system">Use system setting</IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem>
        <IonLabel>Accent colour</IonLabel>
        <IonSelect
          interface="popover"
          value={appearance.accentColor}
          onIonChange={(event) =>
            updateSection("appearance", { accentColor: event.detail.value })
          }
        >
          <IonSelectOption value="indigo">Indigo</IonSelectOption>
          <IonSelectOption value="emerald">Emerald</IonSelectOption>
          <IonSelectOption value="orange">Orange</IonSelectOption>
          <IonSelectOption value="rose">Rose</IonSelectOption>
        </IonSelect>
      </IonItem>

      <IonItem>
        <IonLabel>Large text</IonLabel>
        <IonToggle
          checked={appearance.useLargeText}
          onIonChange={(event) =>
            updateSection("appearance", { useLargeText: event.detail.checked })
          }
        />
      </IonItem>

      <IonItem lines="none">
        <IonNote color="medium">
          Theme and accent updates apply instantly and persist between sessions.
        </IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsAppearance;
