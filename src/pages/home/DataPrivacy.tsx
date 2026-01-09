import React from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { analyticsOutline, shieldCheckmarkOutline, trashOutline } from "ionicons/icons";
import { useHistory } from "react-router";

const DataPrivacy: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Data & Privacy</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem lines="full">
          <IonIcon slot="start" icon={analyticsOutline} />
          <IonLabel>
            <h2>Export your analytics</h2>
            <p>Share your PDF or JSON exports from the Analytics tab.</p>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          className="ion-margin-bottom"
          onClick={() => history.push("/app/analytics")}
        >
          Open Analytics exports
        </IonButton>

        <IonItem lines="full">
          <IonIcon slot="start" icon={trashOutline} />
          <IonLabel>
            <h2>Delete your account</h2>
            <p>Remove your account and all stored data permanently.</p>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          color="danger"
          className="ion-margin-bottom"
          onClick={() => history.push("/app/settings")}
        >
          Go to account deletion
        </IonButton>

        <IonItem lines="none">
          <IonIcon slot="start" icon={shieldCheckmarkOutline} />
          <IonLabel>
            <h2>Privacy</h2>
            <p>
              Your data stays tied to your MacroPal account and is only visible to
              you.
            </p>
          </IonLabel>
        </IonItem>
      </IonContent>
    </IonPage>
  );
};

export default DataPrivacy;
