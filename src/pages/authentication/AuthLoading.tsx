import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonContent,
  IonSpinner,
  IonText,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonProgressBar,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { auth, db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import "./AuthLoading.css";

const AuthLoading: React.FC = () => {
  const history = useHistory();
  const [message, setMessage] = useState("Checking your account…");
  const [timedOut, setTimedOut] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Check offline status immediately
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      history.replace("/offline");
      return;
    }

    // Simulate progress for better UX feedback
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 0.9) return prev; // Cap at 90% until actual completion
        return prev + 0.1;
      });
    }, 800);

    // Set a timeout to prevent infinite loading on slow connections
    const timeoutId = setTimeout(() => {
      clearInterval(progressInterval);
      setTimedOut(true);
      setMessage("Taking longer than usual. Please check your connection…");
    }, 10000); // 10 second timeout

    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        setMessage("You're not logged in. Sending you to login…");
        setTimeout(() => history.replace("/login"), 1500);
        return;
      }

      try {
        setMessage("Loading your MacroPal profile…");
        setProgress(0.3);

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        setProgress(0.6);

        let targetRoute = "/onboarding-profile";

        if (snap.exists()) {
          setMessage("Checking your profile details…");
          setProgress(0.8);

          const data: any = snap.data();
          const p = data.profile;
          const hasAcceptedTerms = Boolean(data.termsAcceptedAt);

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
          } else if (!hasAcceptedTerms) {
            targetRoute = "/onboarding-terms";
            setMessage("Please review the terms before continuing…");
          } else {
            targetRoute = "/onboarding-profile";
            setMessage("We need a few details. Opening setup…");
          }
        } else {
          setMessage("Creating your MacroPal profile…");
          setProgress(0.7);

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

          targetRoute = "/onboarding-terms";
          setMessage("Profile created. Please review the terms…");
        }

        setProgress(1);
        history.replace(targetRoute);
      } catch (e) {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
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

    // Listen for offline events
    const handleOffline = () => {
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      history.replace("/offline");
    };

    window.addEventListener("offline", handleOffline);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      window.removeEventListener("offline", handleOffline);
    };
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
          {!timedOut && <IonSpinner name="crescent" />}
          <IonText color={timedOut ? "warning" : "medium"}>
            <p style={{ marginTop: "1rem" }}>{message}</p>
          </IonText>
          {!timedOut && (
            <>
              <IonProgressBar 
                value={progress} 
                style={{ 
                  marginTop: "1rem", 
                  width: "80%", 
                  maxWidth: "300px",
                  marginLeft: "auto",
                  marginRight: "auto"
                }}
              />
              <IonText 
                color="medium" 
                style={{ 
                  marginTop: "0.5rem", 
                  fontSize: "0.75rem", 
                  opacity: 0.7,
                  display: "block"
                }}
              >
                {Math.round(progress * 100)}% • This may take longer on slow connections
              </IonText>
            </>
          )}
          {timedOut && (
            <div style={{ marginTop: "1rem" }}>
              <IonButton onClick={() => history.replace("/login")}>
                Go to Login
              </IonButton>
              <IonButton fill="outline" onClick={() => window.location.reload()}>
                Retry
              </IonButton>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AuthLoading;
