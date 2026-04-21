import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
  IonProgressBar,
} from "@ionic/react";
import { useHistory } from "react-router";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import "./CheckLogin.css";

type Phase = "checking" | "offline" | "error";
const AUTH_CHECK_TIMEOUT_MS = 12000;

const CheckLogin: React.FC = () => {
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const checkCleanupRef = useRef<(() => void) | null>(null);

  const resolveUserState = useCallback(
    async (user: User | null) => {
      if (!user) {
        history.replace("/start");
        return;
      }

      if (!user.emailVerified) {
        await signOut(auth);
        history.replace("/login");
        return;
      }

      history.replace("/auth-loading");
    },
    [history]
  );

  const startCheck = useCallback(() => {
    checkCleanupRef.current?.();

    if (!navigator.onLine) {
      setErrorMsg("");
      setPhase("offline");
      checkCleanupRef.current = null;
      return;
    }

    setPhase("checking");
    setErrorMsg("");

    const knownUser = auth.currentUser;
    if (knownUser) {
      void resolveUserState(knownUser);
      checkCleanupRef.current = null;
      return;
    }

    let settled = false;
    let unsub: (() => void) | null = null;

    const finishCheck = () => {
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsub?.();
      unsub = null;
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) return;

      finishCheck();
      const fallbackUser = auth.currentUser;
      if (fallbackUser) {
        void resolveUserState(fallbackUser);
        return;
      }

      if (!navigator.onLine) {
        setErrorMsg("");
        setPhase("offline");
        return;
      }

      // Avoid dead-ending the startup flow if auth state initialization stalls.
      history.replace("/start");
    }, AUTH_CHECK_TIMEOUT_MS);

    unsub = onAuthStateChanged(
      auth,
      async (user) => {
        // We only care about the first value
        finishCheck();

        try {
          await resolveUserState(user);
        } catch (error: unknown) {
          const e = error as Error;
          console.error(e);
          setErrorMsg(
            e?.message || "Unexpected error while checking your account."
          );
          setPhase("error");
        }
      },
      (err) => {
        console.error(err);
        if (!navigator.onLine) {
          setErrorMsg("");
          setPhase("offline");
          return;
        }
        setErrorMsg(
          err?.message || "Unexpected error while checking your account."
        );
        setPhase("error");
      }
    );

    checkCleanupRef.current = () => {
      finishCheck();
    };
  }, [history, resolveUserState]);

  useEffect(() => {
    startCheck();

    const handleOnline = () => {
      // If we come back online, auto-retry the check so the user doesn't
      // have to tap "Try again" manually.
      startCheck();
    };
    const handleOffline = () => {
      checkCleanupRef.current?.();
      setErrorMsg("");
      setPhase("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      checkCleanupRef.current?.();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [startCheck]);

  useEffect(() => {
    if (phase !== "checking") {
      setShowSlowMessage(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
  }, [phase]);

  const handleRetry = () => {
    console.log('[USER ACTION] CheckLogin: Try again button clicked', { phase, isOnline: navigator.onLine });
    startCheck();
  };

  const renderBody = () => {
    if (phase === "checking") {
      return (
        <>
          <IonSpinner name="dots" />
          <IonText
            color="medium"
            style={{ marginTop: 12, display: "block" }}
          >
            Checking your account…
          </IonText>
          <IonProgressBar 
            type="indeterminate" 
            style={{ 
              marginTop: "1rem", 
              width: "80%", 
              maxWidth: "300px" 
            }}
          />
          {showSlowMessage && (
            <IonText
              color="medium"
              style={{
                marginTop: "1.5rem",
                fontSize: "0.75rem",
                opacity: 0.7,
                textAlign: "center",
              }}
            >
              This may take longer on slow connections
            </IonText>
          )}
        </>
      );
    }

    if (phase === "offline") {
      return (
        <>
          <IonText
            color="medium"
            style={{ marginBottom: 8, display: "block" }}
          >
            You seem to be offline.
          </IonText>
          <IonText
            color="medium"
            style={{
              marginBottom: 16,
              fontSize: 14,
              opacity: 0.8,
            }}
          >
            Turn on Wi-Fi or mobile data, then tap “Try again”.
          </IonText>
          <IonButton expand="block" onClick={() => {
            console.log('[USER ACTION] CheckLogin: Try again button clicked (offline/error)');
            handleRetry();
          }}>
            Try again
          </IonButton>
        </>
      );
    }

    // phase === "error"
    return (
      <>
        <IonText
          color="danger"
          style={{ marginBottom: 8, display: "block" }}
        >
          Something went wrong while checking your account.
        </IonText>
        {errorMsg && (
          <IonText
            color="medium"
            style={{
              marginBottom: 16,
              fontSize: 13,
              opacity: 0.8,
            }}
          >
            {errorMsg}
          </IonText>
        )}
        <IonButton expand="block" onClick={handleRetry}>
          Try again
        </IonButton>
        <IonButton
          expand="block"
          fill="outline"
          style={{ marginTop: 8 }}
          onClick={() => {
            console.log('[USER ACTION] CheckLogin: Go to login button clicked (error)');
            history.replace("/login");
          }}
        >
          Go to login
        </IonButton>
      </>
    );
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Checking account</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding check-login__container">
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            textAlign: "center",
          }}
        >
          {renderBody()}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default CheckLogin;
