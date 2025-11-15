import React, { useEffect } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonText,
  IonIcon,
} from "@ionic/react";
import { wifiOutline, refreshOutline } from "ionicons/icons";
import { useHistory } from "react-router";

const Offline: React.FC = () => {
  const history = useHistory();

  const goBackToCheck = () => {
    history.replace("/check-login");
  };

  useEffect(() => {
    const onOnline = () => {
      // As soon as we get connectivity back, rerun the login check
      history.replace("/check-login");
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", onOnline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
    };
  }, [history]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>No Internet Connection</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding ion-text-center">
        <div style={{ marginTop: "20vh" }}>
          <IonIcon icon={wifiOutline} style={{ fontSize: 64, opacity: 0.7 }} />
          <h2 style={{ marginTop: 12 }}>You’re offline</h2>
          <IonText color="medium">
            <p style={{ marginTop: 8 }}>
              MacroPal needs an internet connection to work.
              <br />
              Please turn on Wi-Fi or mobile data, then try again.
            </p>
          </IonText>

          <IonButton
            expand="block"
            style={{ marginTop: 24 }}
            onClick={goBackToCheck}
          >
            <IonIcon slot="start" icon={refreshOutline} />
            Try again
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Offline;