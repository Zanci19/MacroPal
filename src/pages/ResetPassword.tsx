import React from "react";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  IonToast,
  IonLabel,
} from "@ionic/react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useHistory } from "react-router-dom";
import { auth } from "../firebase";
import "./ResetPassword.css";

const COOLDOWN_MS_DEFAULT = 60_000;
const COOLDOWN_MS_RATE_LIMIT = 5 * 60_000;
const LS_KEY = "resetPasswordCooldownUntil";

const ResetPassword: React.FC = () => {
  const [email, setEmail] = React.useState<string>("");
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
    show: false,
    message: "",
    color: "success",
  });
  const [cooldownMsLeft, setCooldownMsLeft] = React.useState<number>(0);
  const [sending, setSending] = React.useState<boolean>(false);
  const history = useHistory();

  React.useEffect(() => {
    const until = Number(localStorage.getItem(LS_KEY) || "0");
    const now = Date.now();
    if (until > now) {
      setCooldownMsLeft(until - now);
    }
  }, []);

  React.useEffect(() => {
    if (cooldownMsLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownMsLeft((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) {
          localStorage.removeItem(LS_KEY);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownMsLeft]);

  const startCooldown = (durationMs: number) => {
    const until = Date.now() + durationMs;
    localStorage.setItem(LS_KEY, String(until));
    setCooldownMsLeft(durationMs);
  };

  const formatSeconds = (ms: number) => Math.ceil(ms / 1000);

  const handleRecoverPassword = async () => {
    console.log(`[USER ACTION] Reset Password: Clicked send reset email button`, {
      hasEmail: !!email.trim(),
      cooldownActive: cooldownMsLeft > 0,
    });
    
    if (!email.trim()) {
      setToast({
        show: true,
        message: "Please enter your email address.",
        color: "danger",
      });
      return;
    }
    if (cooldownMsLeft > 0) {
      setToast({
        show: true,
        message: `Please wait ${formatSeconds(
          cooldownMsLeft
        )}s before requesting again.`,
        color: "warning",
      });
      return;
    }

    try {
      setSending(true);
      await sendPasswordResetEmail(auth, email.trim());
      setToast({
        show: true,
        message: "Password reset email sent. Check your inbox.",
        color: "success",
      });
      startCooldown(COOLDOWN_MS_DEFAULT);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      const code = error?.code as string | undefined;

      if (code === "auth/too-many-requests") {
        startCooldown(COOLDOWN_MS_RATE_LIMIT);
        setToast({
          show: true,
          message: "Too many attempts. Please try again in a few minutes.",
          color: "danger",
        });
      } else {
        const message =
          error?.message ?? "Failed to send password reset email.";
        setToast({ show: true, message, color: "danger" });
      }
    } finally {
      setSending(false);
    }
  };

  const secondsLeft = formatSeconds(cooldownMsLeft);
  const buttonDisabled = sending || cooldownMsLeft > 0;
  const buttonLabel = sending
    ? "Sending…"
    : cooldownMsLeft > 0
    ? `Resend in ${secondsLeft}s`
    : "Recover Password";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Reset Password</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="reset-password-page" fullscreen>
        <div className="reset-card">
          <div className="reset-header">
            <h1 className="reset-title">Forgot your password?</h1>
            <p className="reset-subtitle">
              Enter the email linked to your account and we&apos;ll send you a
              reset link.
            </p>
          </div>

          <div className="reset-form">
            <IonItem lines="full" className="reset-item">
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                value={email}
                placeholder="you@example.com"
                type="email"
                inputMode="email"
                autocomplete="email"
                onIonChange={(e: any) => {
                  console.log(`[USER ACTION] Reset Password: Email input changed`, {
                    hasValue: !!e?.detail?.value,
                    length: e?.detail?.value?.length ?? 0,
                  });
                  setEmail(e?.detail?.value ?? "");
                }}
                disabled={sending}
              />
            </IonItem>

            <IonButton
              expand="block"
              className="reset-button"
              onClick={handleRecoverPassword}
              disabled={buttonDisabled}
            >
              {buttonLabel}
            </IonButton>

            {cooldownMsLeft > 0 && (
              <IonText color="medium">
                <p className="reset-cooldown-text">
                  You can request another reset email in {secondsLeft}s.
                </p>
              </IonText>
            )}

            <div className="reset-footer">
              <IonText color="medium">
                <p className="reset-footer-text">Remember your password?</p>
              </IonText>
              <IonButton
                fill="clear"
                expand="block"
                onClick={() => {
                  console.log(`[USER ACTION] Reset Password: Clicked log in link`);
                  history.push("/login");
                }}
                disabled={sending}
                className="reset-footer-button"
              >
                Log In
              </IonButton>
            </div>
          </div>
        </div>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() =>
            setToast((s) => ({
              ...s,
              show: false,
            }))
          }
          message={toast.message}
          color={toast.color}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default ResetPassword;
