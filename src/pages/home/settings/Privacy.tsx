import { IonList, IonItem, IonLabel, IonToggle, IonNote } from "@ionic/react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsPrivacy: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const { privacy } = settings;

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Share anonymous analytics</IonLabel>
        <IonToggle
          checked={privacy.shareAnalytics}
          onIonChange={(event) =>
            updateSection("privacy", { shareAnalytics: event.detail.checked })
          }
        />
      </IonItem>
      <IonItem>
        <IonLabel>Keep diary private</IonLabel>
        <IonToggle
          checked={privacy.diaryPrivate}
          onIonChange={(event) =>
            updateSection("privacy", { diaryPrivate: event.detail.checked })
          }
        />
      </IonItem>
      <IonItem lines="none">
        <IonNote color="medium">
          Analytics help us improve MacroPal without collecting personally identifiable data.
        </IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsPrivacy;
