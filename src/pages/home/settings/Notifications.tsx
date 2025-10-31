import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
} from "@ionic/react";
import { useState } from "react";

const SettingsNotifications: React.FC = () => {
  const [dailyReminder, setDailyReminder] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Notifications</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonItem>
            <IonLabel>Daily summary reminder</IonLabel>
            <IonToggle
              checked={dailyReminder}
              onIonChange={(e) => setDailyReminder(e.detail.checked)}
            />
          </IonItem>
          <IonItem>
            <IonLabel>Push notifications</IonLabel>
            <IonToggle
              checked={pushEnabled}
              onIonChange={(e) => setPushEnabled(e.detail.checked)}
            />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsNotifications;
