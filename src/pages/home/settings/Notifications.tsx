import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonNote,
  IonButton,
  useIonToast,
  ToggleChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings } from "../../../context/SettingsContext";

type NotificationsFormState = {
  dailySummary: boolean;
  pushEnabled: boolean;
  mealReminders: boolean;
  goalCheckIns: boolean;
  weeklyDigest: boolean;
};

const SettingsNotifications: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<NotificationsFormState>(settings.notifications);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.notifications);
  }, [settings.notifications]);

  const handleToggle = (
    field: keyof NotificationsFormState,
    event: CustomEvent<ToggleChangeEventDetail>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.checked,
    }));
  };

  const handleSave = () => {
    updateSettings("notifications", form);
    present({ message: "Notification preferences updated", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("notifications");
    setForm(getDefaultSection("notifications"));
    present({
      message: "Notifications reset to defaults",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Daily summary</IonLabel>
          <IonToggle
            checked={form.dailySummary}
            onIonChange={(event) => handleToggle("dailySummary", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Push notifications</IonLabel>
          <IonToggle
            checked={form.pushEnabled}
            onIonChange={(event) => handleToggle("pushEnabled", event)}
          />
          <IonNote slot="helper">Enable to receive real-time status updates.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Meal reminders</IonLabel>
          <IonToggle
            checked={form.mealReminders}
            onIonChange={(event) => handleToggle("mealReminders", event)}
          />
          <IonNote slot="helper">Sends a gentle nudge when you usually log meals.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Goal check-ins</IonLabel>
          <IonToggle
            checked={form.goalCheckIns}
            onIonChange={(event) => handleToggle("goalCheckIns", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Weekly digest email</IonLabel>
          <IonToggle
            checked={form.weeklyDigest}
            onIonChange={(event) => handleToggle("weeklyDigest", event)}
          />
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save notifications
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

export default SettingsNotifications;
