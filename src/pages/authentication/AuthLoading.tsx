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
import {
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
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
const TIMEOUT_MS = 25000;
const FIRESTORE_OP_TIMEOUT_MS = 12000;
const RECOVERY_ROUTE_DELAY_MS = 1200;
const CACHE_READ_TIMEOUT_MS = 2500;
const AUTH_LOADING_TIMEOUT_ERROR = "AuthLoadingTimeoutError";
const SLOW_CONNECTION_MESSAGE = "This may take longer on slow connections";

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  context: string
): Promise<T> => {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = setTimeout(() => {
          const error = new Error(`Timed out while ${context}.`);
          error.name = AUTH_LOADING_TIMEOUT_ERROR;
          reject(error);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
};

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
    let navigationTimer: NodeJS.Timeout | null = null;
    let hasTimedOut = false;

    const scheduleNavigation = (path: string, delayMs: number) => {
      if (navigationTimer) clearTimeout(navigationTimer);
      navigationTimer = setTimeout(() => {
        history.replace(path);
      }, delayMs);
    };

    const stopLoadingIndicators = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };

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
      hasTimedOut = true;
      stopLoadingIndicators();
      setTimedOut(true);
      if (!navigator.onLine) {
        setMessage("No internet connection. Sending you to offline screen…");
        scheduleNavigation("/offline", RECOVERY_ROUTE_DELAY_MS);
        return;
      }

      if (auth.currentUser) {
        setMessage("Still signing you in. Opening your home screen…");
        scheduleNavigation("/app/home", RECOVERY_ROUTE_DELAY_MS);
        return;
      }

      setMessage("Taking longer than usual. Sending you to login…");
      scheduleNavigation("/login", RECOVERY_ROUTE_DELAY_MS);
    }, TIMEOUT_MS);

    const run = async () => {
      const user = auth.currentUser;

      if (!user) {
        stopLoadingIndicators();
        setMessage("You're not logged in. Sending you to login…");
        scheduleNavigation("/login", 1500);
        return;
      }

      try {
        setMessage("Loading your MacroPal profile…");
        setProgress(PROGRESS_STAGES.LOADING_PROFILE);

        const userRef = doc(db, "users", user.uid);
        let snap;
        try {
          snap = await withTimeout(
            getDoc(userRef),
            FIRESTORE_OP_TIMEOUT_MS,
            "loading your profile"
          );
        } catch (error) {
          const isTimeoutError =
            error instanceof Error && error.name === AUTH_LOADING_TIMEOUT_ERROR;
          if (!isTimeoutError) throw error;

          setMessage("Network is slow. Trying cached account data…");
          snap = await withTimeout(
            getDocFromCache(userRef),
            CACHE_READ_TIMEOUT_MS,
            "reading cached profile"
          );
        }

        if (hasTimedOut) return;

        stopLoadingIndicators();
        setProgress(PROGRESS_STAGES.PROFILE_LOADED);

        let targetRoute = "/onboarding-profile";

        if (snap.exists()) {
          const data = snap.data();
          if (!data.role) {
            await withTimeout(
              setDoc(
                userRef,
                {
                  role: "user",
                },
                { merge: true }
              ),
              FIRESTORE_OP_TIMEOUT_MS,
              "updating your account role"
            );
          }
          if (hasTimedOut) return;

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

          await withTimeout(
            setDoc(
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
            ),
            FIRESTORE_OP_TIMEOUT_MS,
            "creating your profile"
          );
          if (hasTimedOut) return;

          targetRoute = "/onboarding-terms";
          setMessage("Profile created. Please review the terms…");
        }

        if (hasTimedOut) return;
        setProgress(PROGRESS_STAGES.COMPLETE);
        history.replace(targetRoute);
      } catch (e) {
        if (hasTimedOut) return;

        stopLoadingIndicators();
        console.error("AuthLoading error:", e);

        const isTimeoutError =
          e instanceof Error && e.name === AUTH_LOADING_TIMEOUT_ERROR;
        if (isTimeoutError) {
          setTimedOut(true);
          if (!navigator.onLine) {
            setMessage("No internet connection. Sending you to offline screen…");
            scheduleNavigation("/offline", RECOVERY_ROUTE_DELAY_MS);
            return;
          }

          if (auth.currentUser) {
            setMessage("Sign-in is taking longer than usual. Opening your home screen…");
            scheduleNavigation("/app/home", RECOVERY_ROUTE_DELAY_MS);
            return;
          }

          setMessage("Could not verify your account in time. Sending you to login…");
          scheduleNavigation("/login", RECOVERY_ROUTE_DELAY_MS);
          return;
        }

        if (!navigator.onLine) {
          setMessage("No internet connection. Sending you to offline screen…");
          scheduleNavigation("/offline", 1500);
        } else {
          setMessage("Could not load your account. Sending you back to login…");
          scheduleNavigation("/login", 2000);
        }
      }
    };

    run();

    return () => {
      hasTimedOut = true;
      stopLoadingIndicators();
      if (slowMessageTimer) clearTimeout(slowMessageTimer);
      if (navigationTimer) clearTimeout(navigationTimer);
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
        <div className="auth-loading-panel">
          {!timedOut && <IonSpinner name="crescent" />}
          <IonText color={timedOut ? "warning" : "medium"}>
            <p className="auth-loading-message">{message}</p>
          </IonText>
          {!timedOut && (
            <>
              <IonProgressBar value={progress} className="auth-loading-progress" />
              <IonText
                color="medium"
                className="auth-loading-percent"
              >
                {Math.round(progress * 100)}%
              </IonText>
              {showSlowMessage && (
                <IonText
                  color="medium"
                  className="auth-loading-slow"
                >
                  {SLOW_CONNECTION_MESSAGE}
                </IonText>
              )}
            </>
          )}
          {timedOut && (
            <div className="auth-loading-actions">
              <IonButton expand="block" onClick={() => {
                console.log(`[USER ACTION] Auth Loading: Clicked go to login button (timeout)`);
                history.replace("/login");
              }}>
                Go to Login
              </IonButton>
              <IonButton expand="block" fill="outline" onClick={() => {
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
