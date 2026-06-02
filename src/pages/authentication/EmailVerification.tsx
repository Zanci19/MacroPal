import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonPage,
  IonSpinner,
  IonText,
  IonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { sendEmailVerification, signOut } from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import "./EmailVerification.css";

const EmailVerification: React.FC = () => {
  const history = useHistory();
  const [checking, setChecking] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
    show: false,
    message: "",
    color: "success",
  });

  const userEmail = useMemo(() => auth.currentUser?.email ?? null, []);

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger"
  ) => setToast({ show: true, message, color });

  const checkVerification = useCallback(
    async (silent = false) => {
      const user = auth.currentUser;
      if (!user) {
        history.replace("/login");
        return;
      }

      if (!silent) {
        setChecking(true);
      }

      try {
        await user.reload();
        if (user.emailVerified) {
          trackEvent("verification_email_confirmed", { uid: user.uid });
          history.replace("/auth-loading");
          return;
        }
        if (!silent) {
          showToast("Still waiting on email verification.", "warning");
        }
      } catch (error: unknown) {
        const err = error as Error;
        if (!silent) {
          showToast(
            err?.message || "Could not check verification status.",
            "danger"
          );
        }
      } finally {
        if (!silent) {
          setChecking(false);
        }
      }
    },
    [history]
  );

  const resendVerification = async () => {
    console.log(`[USER ACTION] Email Verification: Clicked resend email button`);
    
    const user = auth.currentUser;
    if (!user) {
      history.replace("/login");
      return;
    }

    setChecking(true);
    try {
      await sendEmailVerification(user);
      trackEvent("verification_email_resent", { uid: user.uid });
      showToast("Verification email resent.", "success");
    } catch (error: unknown) {
      const err = error as Error;
      showToast(err?.message || "Could not resend verification email.");
    } finally {
      setChecking(false);
    }
  };

  const handleBackToLogin = async () => {
    console.log(`[USER ACTION] Email Verification: Clicked back to login button`);
    
    try {
      setChecking(true);
      await signOut(auth);
      trackEvent("verification_back_to_login");
      history.replace("/login");
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Error signing out:", err);
      showToast(err?.message || "Could not sign out.", "danger");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) {
      history.replace("/login");
      return;
    }

    const intervalId = window.setInterval(() => {
      void checkVerification(true);
    }, 8000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkVerification, history]);

  return (
    <IonPage>
      <IonContent className="ion-padding verification-page">
        <div className="verification-card">
          <IonText className="verification-title">
            <h2>We sent you a verification email</h2>
          </IonText>
          <IonText color="medium">
            <p>
              {userEmail
                ? `Check ${userEmail} and click the link to verify your account.`
                : "Check your inbox and click the link to verify your account."}
            </p>
          </IonText>

          <div className="verification-actions">
            <IonButton expand="block" onClick={() => {
              console.log(`[USER ACTION] Email Verification: Clicked I've verified button`, {
                checking,
              });
              checkVerification();
            }}>
              {checking ? <IonSpinner name="dots" /> : "I've verified"}
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={resendVerification}
              disabled={checking}
            >
              Resend email
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              onClick={handleBackToLogin}
              disabled={checking}
              color="medium"
            >
              Back to login
            </IonButton>
          </div>

          <IonText color="medium" className="verification-hint">
            <p>
              We’ll keep checking automatically while this screen is open.
            </p>
          </IonText>
        </div>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((s) => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={2400}
        />
      </IonContent>
    </IonPage>
  );
};

export default EmailVerification;
