import React, { useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonToast,
  IonSpinner,
} from "@ionic/react";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory } from "react-router-dom";
import "./Login.css";

const Login: React.FC = () => {
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // simple rate limiting
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: "success" | "danger" | "warning";
    buttons?: {
      text: string;
      role?: "cancel" | "destructive";
      handler?: () => void;
    }[];
  }>({
    show: false,
    message: "",
    color: "success",
  });

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger",
    buttons?: {
      text: string;
      role?: "cancel" | "destructive";
      handler?: () => void;
    }[]
  ) => setToast({ show: true, message, color, buttons });

  const handleLogin = async () => {
    // extra guard: if already processing, ignore further taps
    if (busy) return;

    const trimmedEmail = email.trim();
    const trimmedPw = pw.trim();

    // track button press
    trackEvent("login_attempt", {
      email_present: !!trimmedEmail,
      pw_present: !!trimmedPw,
    });

    // rate limit check
    const now = Date.now();
    if (lockUntil && now < lockUntil) {
      const remainingSec = Math.ceil((lockUntil - now) / 1000);
      trackEvent("login_locked", { remainingSec });
      showToast(
        `Too many login attempts. Please try again in ${remainingSec}s.`,
        "warning"
      );
      return;
    }

    if (!trimmedEmail || !trimmedPw) {
      trackEvent("login_validation_failed", {
        reason: "missing_credentials",
      });
      showToast("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPw);

      // reset rate limit on successful credential use
      setFailedAttempts(0);
      setLockUntil(null);

      // credentials valid
      trackEvent("login_credentials_valid", {
        uid: cred.user.uid,
        email_verified: cred.user.emailVerified,
      });

      if (!cred.user.emailVerified) {
        const userForEmail = cred.user;
        const resend = async () => {
          try {
            await sendEmailVerification(userForEmail);
            trackEvent("verification_email_resent_from_login", {
              uid: userForEmail.uid,
            });
            showToast(
              "Verification email sent. Please check your inbox.",
              "success"
            );
          } catch (e) {
            trackEvent("verification_email_resend_error_from_login", {
              uid: userForEmail.uid,
            });
            showToast("Could not send verification email. Try again later.");
            console.error(e);
          }
        };

        await signOut(auth);
        trackEvent("login_blocked_unverified_email", {
          uid: userForEmail.uid,
        });
        showToast("Please verify your email to continue.", "warning", [
          { text: "Resend email", handler: resend },
        ]);
        return;
      }

      trackEvent("login_success", { uid: cred.user.uid });
      showToast("Welcome back!", "success");
      history.replace("/auth-loading");
    } catch (err: any) {
      const baseMsg =
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/wrong-password"
          ? "Incorrect email or password."
          : err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : err?.message || "Login failed.";

      trackEvent("login_error", {
        code: err?.code || "unknown",
      });

      setFailedAttempts((prev) => {
        const next = prev + 1;

        // lock after 5th failure
        if (next >= 5) {
          const lockMs = 30 * 1000; // 30 seconds
          setLockUntil(Date.now() + lockMs);
          trackEvent("login_rate_limited", { attempts: next, lockMs });
          showToast(
            "Too many login attempts. Please wait 30 seconds before trying again.",
            "warning"
          );
        } else {
          showToast(baseMsg);
        }

        return next;
      });

      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Log In</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Email</IonLabel>
          <IonInput
            type="email"
            inputmode="email"
            autocomplete="email"
            autocapitalize="off"
            autocorrect="off"
            placeholder="you@example.com"
            value={email}
            onIonInput={(e: any) => setEmail(e.detail.value ?? "")}
          />
        </IonItem>

        <IonItem lines="none" className="password-item">
          <IonLabel position="stacked">Password</IonLabel>

          <div className="pw-wrapper">
            <IonInput
              type={showPw ? "text" : "password"}
              autocomplete="current-password"
              autocapitalize="off"
              autocorrect="off"
              placeholder="Your password"
              value={pw}
              onIonInput={(e: any) => setPw(e.detail.value ?? "")}
              className="pw-input"
            />

            <button
              type="button"
              className="pw-toggle-btn"
              onClick={() => {
                setShowPw((v) => !v);
                trackEvent("login_toggle_password_visibility", {
                  new_state: !showPw,
                });
              }}
            >
              {showPw ? "HIDE" : "SHOW"}
            </button>
          </div>
        </IonItem>

        <IonButton
          expand="block"
          className="ion-margin-top"
          onClick={handleLogin}
          disabled={busy}
        >
          {busy ? <IonSpinner name="dots" /> : "Log In"}
        </IonButton>

        <IonText className="ion-text-center" color="medium">
          <p className="ion-margin-top">No account?</p>
        </IonText>
        <IonButton
          fill="clear"
          expand="block"
          onClick={() => {
            trackEvent("navigate_to_register_from_login");
            history.push("/register");
          }}
        >
          Create one
        </IonButton>

        <IonToast
          isOpen={toast.show}
          duration={toast.buttons ? undefined : 2000}
          message={toast.message}
          color={toast.color}
          buttons={toast.buttons}
          onDidDismiss={() =>
            setToast((s) => ({
              ...s,
              show: false,
              buttons: undefined,
            }))
          }
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
