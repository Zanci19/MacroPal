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
import "./AuthLoading.css";

const AuthLoading: React.FC = () => {
  const history = useHistory();
  const [message, setMessage] = useState("Checking your account…");

  useEffect(() => {
    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        setMessage("You’re not logged in. Sending you to login…");
        setTimeout(() => history.replace("/login"), 1500);
        return;
      }

      try {
        setMessage("Loading your MacroPal profile…");

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        let targetRoute = "/onboarding-profile";

        if (snap.exists()) {
          setMessage("Checking your profile details…");

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
            setMessage("All set! Opening your diary…");
          } else {
            targetRoute = "/onboarding-profile";
            setMessage("We need a few details. Opening setup…");
          }
        } else {
          setMessage("Creating your MacroPal profile…");

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

          targetRoute = "/onboarding-profile";
          setMessage("Profile created. Opening setup…");
        }

        history.replace(targetRoute);
      } catch (e) {
        console.error("AuthLoading error:", e);

        if (!navigator.onLine) {
          setMessage("No internet connection. Sending you to offline screen…");
          setTimeout(() => history.replace("/offline"), 1500);
        } else {
          setMessage("Could not load your account. Sending you back to login…");
          setTimeout(() => history.replace("/login"), 2000);
        }
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
      <IonContent className="ion-padding ion-text-center auth-loading-page">
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
