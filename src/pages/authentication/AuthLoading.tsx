import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonText,
  IonHeader,
  IonToolbar,
  IonTitle,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthLoading: React.FC = () => {
  const history = useHistory();
  const [message, setMessage] = useState("Checking your account...");

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        setMessage("Not logged in. Redirecting...");
        setTimeout(() => history.replace("/login"), 1500);
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        let targetRoute = "/setup-profile";

        if (snap.exists()) {
          const data: any = snap.data();
          const p = data.profile;

          const hasFullProfile =
            p &&
            typeof p.age === "number" &&
            typeof p.weight === "number" &&
            typeof p.height === "number" &&
            p.goal &&
            p.gender &&
            p.activity;

          if (hasFullProfile) {
            targetRoute = "/app/home";
          } else {
            targetRoute = "/setup-profile";
          }
        } else {
          // Create basic doc if missing
          await setDoc(
            userRef,
            {
              uid: user.uid,
              email: user.email ?? null,
              displayName: user.displayName ?? null,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          targetRoute = "/setup-profile";
        }

        history.replace(targetRoute);
      } catch (e) {
        console.error("AuthLoading error:", e);
        setMessage("Could not load your account. Sending you back to login...");
        setTimeout(() => history.replace("/login"), 2000);
      }
    };

    run();
  }, [history]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Loading</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding ion-text-center">
        <div style={{ marginTop: "30vh" }}>
          <IonSpinner name="crescent" />
          <IonText color="medium">
            <p style={{ marginTop: "1rem" }}>{message}</p>
          </IonText>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthLoading;
