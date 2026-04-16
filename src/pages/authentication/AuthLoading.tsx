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
import { applyProfilePreferences } from "../../utils/preferences";
import "./AuthLoading.css";

// Progress stage constants for better maintainability
const PROGRESS_STAGES = {
  INITIAL: 0,
  LOADING_PROFILE: 0.3,
  PROFILE_LOADED: 0.45,
  PREFERENCES_APPLIED: 0.6,
  CREATING_PROFILE: 0.7,
  CHECKING_DETAILS: 0.8,
  COMPLETE: 1.0,
  MAX_SIMULATED: 0.9, // Cap simulated progress until actual completion
};

const PROGRESS_INTERVAL_MS = 800;
const TIMEOUT_MS = 10000;
const SLOW_CONNECTION_MESSAGE = "This may take longer on slow connections";

const AuthLoading: React.FC = () => {
  const history = useHistory();
  const [message, setMessage] = useState("Checking your account…");
  const [timedOut, setTimedOut] = useState(false);
  const [progress, setProgress] = useState(PROGRESS_STAGES.INITIAL);
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    let progressInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let slowMessageTimer: NodeJS.Timeout | null = null;

    slowMessageTimer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 3000);

    // Simulate progress for better UX feedback
    progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= PROGRESS_STAGES.MAX_SIMULATED) return prev; // Cap at 90% until actual completion
        return prev + 0.1;
      });
    }, PROGRESS_INTERVAL_MS);

    // Set a timeout to prevent infinite loading on slow connections
    timeoutId = setTimeout(() => {
      if (progressInterval) clearInterval(progressInterval);
      setTimedOut(true);
      setMessage("Taking longer than usual. Please check your connection…");
    }, TIMEOUT_MS);

    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        if (timeoutId) clearTimeout(timeoutId);
        if (progressInterval) clearInterval(progressInterval);
        setMessage("You're not logged in. Sending you to login…");
        setTimeout(() => history.replace("/login"), 1500);
        return;
      }

      try {
        setMessage("Loading your MacroPal profile…");
        setProgress(PROGRESS_STAGES.LOADING_PROFILE);

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (timeoutId) clearTimeout(timeoutId);
        if (progressInterval) clearInterval(progressInterval);
        setProgress(PROGRESS_STAGES.PROFILE_LOADED);

        let targetRoute = "/onboarding-profile";

        if (snap.exists()) {
          const data = snap.data();
          if (!data.role) {
            await setDoc(
              userRef,
              {
                role: "user",
              },
              { merge: true }
            );
          }
          const profile = data.profile as Record<string, unknown> | undefined;
          applyProfilePreferences(profile);
          setProgress(PROGRESS_STAGES.PREFERENCES_APPLIED);
          setMessage("Checking your profile details…");
          setProgress(PROGRESS_STAGES.CHECKING_DETAILS);

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
          setProgress(PROGRESS_STAGES.CREATING_PROFILE);

          await setDoc(
            userRef,
            {
              uid: user.uid,
              email: user.email ?? null,
              displayName: user.displayName ?? null,
              createdAt: serverTimestamp(),
              announcementNum: 0,
              role: "user",
            },
            { merge: true }
          );

          targetRoute = "/onboarding-terms";
          setMessage("Profile created. Please review the terms…");
        }

        setProgress(PROGRESS_STAGES.COMPLETE);
        history.replace(targetRoute);
      } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        if (progressInterval) clearInterval(progressInterval);
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

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (progressInterval) clearInterval(progressInterval);
      if (slowMessageTimer) clearTimeout(slowMessageTimer);
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
                  display: "block",
                }}
              >
                {Math.round(progress * 100)}%
              </IonText>
              {showSlowMessage && (
                <IonText
                  color="medium"
                  style={{
                    marginTop: "1.5rem",
                    fontSize: "0.75rem",
                    opacity: 0.7,
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  {SLOW_CONNECTION_MESSAGE}
                </IonText>
              )}
            </>
          )}
          {timedOut && (
            <div style={{ marginTop: "1rem" }}>
              <IonButton onClick={() => {
                console.log(`[USER ACTION] Auth Loading: Clicked go to login button (timeout)`);
                history.replace("/login");
              }}>
                Go to Login
              </IonButton>
              <IonButton fill="outline" onClick={() => {
                console.log(`[USER ACTION] Auth Loading: Clicked retry button (timeout)`);
                window.location.reload();
              }}>
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
