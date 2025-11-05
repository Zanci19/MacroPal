import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonInput,
  IonNote,
} from "@ionic/react";
import { useMemo } from "react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsNotifications: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const { notifications } = settings;

  const reminderDescription = useMemo(() => {
    if (!notifications.dailySummary) {
      return "Reminders disabled";
    }
    return `Daily at ${notifications.reminderTime}`;
  }, [notifications.dailySummary, notifications.reminderTime]);

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Daily summary reminder</IonLabel>
        <IonToggle
          checked={notifications.dailySummary}
          onIonChange={(event) =>
            updateSection("notifications", { dailySummary: event.detail.checked })
          }
        />
      </IonItem>
      <IonItem>
        <IonLabel position="stacked">Reminder time</IonLabel>
        <IonInput
          type="time"
          value={notifications.reminderTime}
          disabled={!notifications.dailySummary}
          onIonChange={(event) =>
            updateSection("notifications", { reminderTime: event.detail.value ?? "20:00" })
          }
        />
        <IonNote slot="helper">Used for push and email reminders.</IonNote>
      </IonItem>
      <IonItem>
        <IonLabel>Push notifications</IonLabel>
        <IonToggle
          checked={notifications.pushEnabled}
          onIonChange={(event) =>
            updateSection("notifications", { pushEnabled: event.detail.checked })
          }
        />
      </IonItem>
      <IonItem lines="none">
        <IonNote color="medium">{reminderDescription}</IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsNotifications;
