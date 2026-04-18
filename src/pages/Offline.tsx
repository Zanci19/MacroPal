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
import { cloudOfflineOutline, refreshOutline, wifiOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import "./Offline.css";

const Offline: React.FC = () => {
  const history = useHistory();

  const goBackToCheck = () => {
    console.log('[USER ACTION] Offline: Try again button clicked');
    history.replace("/check-login");
  };

  const continueOffline = () => {
    console.log('[USER ACTION] Offline: Continue offline button clicked');
    // Route through check-login so Firebase Auth + Firestore can load from
    // their local caches and navigate to the correct screen (home or onboarding).
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

      <IonContent className="ion-padding ion-text-center offline-page">
        <div className="offline-panel">
          <IonIcon icon={wifiOutline} className="offline-icon" />
          <h2 className="offline-title">You’re offline</h2>
          <IonText color="medium">
            <p className="offline-copy">
              MacroPal can keep working offline with your cached data.
              <br />
              We’ll sync updates once you’re back online.
            </p>
          </IonText>

          <div className="offline-actions">
          <IonButton
            expand="block"
            onClick={() => {
              console.log('[USER ACTION] Offline: Try again button clicked (inline)');
              goBackToCheck();
            }}
          >
            <IonIcon slot="start" icon={refreshOutline} />
            Try again
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            onClick={() => {
              console.log('[USER ACTION] Offline: Continue offline button clicked (inline)');
              continueOffline();
            }}
          >
            <IonIcon slot="start" icon={cloudOfflineOutline} />
            Continue offline
          </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Offline;
