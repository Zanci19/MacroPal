// src/pages/CheckLogin.tsx
import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
  IonText,
  IonButton,
} from "@ionic/react";
import { useHistory } from "react-router";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

type Phase = "checking" | "offline" | "error";

const CheckLogin: React.FC = () => {
  const history = useHistory();
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const startCheck = () => {
    // If we're offline, don't even try – show the offline state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPhase("offline");
      return;
    }

    setPhase("checking");
    setErrorMsg("");

    const unsub = onAuthStateChanged(
      auth,
      async (user) => {
        // We only care about the first value
        unsub?.();

        // If we lost connection in the meantime, bounce back to offline
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setPhase("offline");
          return;
        }

        try {
          if (!user) {
            // No user at all → show your start screen
            history.replace("/start");
            return;
          }

          if (!user.emailVerified) {
            // Force verification before continuing
            await signOut(auth);
            history.replace("/login");
            return;
          }

          // Let /auth-loading decide between /setup-profile and /app/home
          history.replace("/auth-loading");
        } catch (e: any) {
          console.error(e);
          setErrorMsg(
            e?.message || "Unexpected error while checking your account."
          );
          setPhase("error");
        }
      },
      (err) => {
        console.error(err);
        setErrorMsg(
          err?.message || "Unexpected error while checking your account."
        );
        setPhase("error");
      }
    );
  };

  useEffect(() => {
    startCheck();

    const handleOnline = () => {
      // If we come back online while on the offline screen, user can tap "Try again"
      // (You could auto-call startCheck() here if you want auto-retry.)
    };

    const handleOffline = () => {
      setPhase("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = () => {
    // IMPORTANT: do NOT switch to "checking" if still offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPhase("offline");
      return;
    }
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
          <IonButton expand="block" onClick={handleRetry}>
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
          onClick={() => history.replace("/login")}
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

      <IonContent className="ion-padding">
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

<video
  src={"/assets/start_bg_loop.mp4"}
  muted
  playsInline
  preload="auto"
  controls={false}
  style={{ display: "none" }}
/>

export default CheckLogin;
