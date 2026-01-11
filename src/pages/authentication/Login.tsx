import React, { useEffect, useState } from "react";
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
  IonIcon,
  IonText,
  IonToast,
  IonSpinner,
  isPlatform,
} from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import {
  logoGoogle,
} from "ionicons/icons";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory } from "react-router-dom";
import { handleError } from "../../utils/handleError";
import { signInWithGoogleSocialLogin } from "../../utils/googleSocialLogin";
import "./Login.css";

const Login: React.FC = () => {
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_failedAttempts, setFailedAttempts] = useState(0);
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

  useEffect(() => {
    let active = true;

    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!active || !result?.user) return;

        setBusy(true);
        trackEvent("login_google_success", { uid: result.user.uid });
        showToast("Signed in with Google.", "success");
        history.replace("/auth-loading");
      } catch (err: any) {
        if (!active) return;
        trackEvent("login_google_error", { code: err?.code || "unknown" });
        showToast(handleError("login", err));
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    };

    checkRedirect();

    return () => {
      active = false;
    };
  }, [history]);

  const handleLogin = async () => {
    if (busy) return;

    const trimmedEmail = email.trim();
    const trimmedPw = pw.trim();

    trackEvent("login_attempt", {
      email_present: !!trimmedEmail,
      pw_present: !!trimmedPw,
    });

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

      setFailedAttempts(0);
      setLockUntil(null);

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
      let message = "";

      if (
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/wrong-password"
      ) {
        message = "Incorrect email or password.";
      } else if (err?.code === "auth/user-not-found") {
        message = "No account found with that email.";
      } else {
        message = handleError("login", err);
      }

      trackEvent("login_error", { code: err?.code || "unknown" });

      setFailedAttempts((prev) => {
        const next = prev + 1;

        if (next >= 5) {
          const lockMs = 30 * 1000;
          setLockUntil(Date.now() + lockMs);
          trackEvent("login_rate_limited", { attempts: next, lockMs });
          showToast(
            "Too many login attempts. Please wait 30 seconds before trying again.",
            "warning"
          );
        } else {
          showToast(message);
        }

        return next;
      });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        trackEvent("login_google_start", {
          method: "social_login",
        });

        const result = await signInWithGoogleSocialLogin();
        trackEvent("login_google_success", { uid: result.user.uid });
        showToast("Signed in with Google.", "success");
        history.replace("/auth-loading");
        return;
      }

      const provider = new GoogleAuthProvider();
      const isMobileWeb = isPlatform("mobileweb");
      const useRedirect = isMobileWeb;
      const popupFallbackCodes = new Set([
        "auth/operation-not-supported-in-this-environment",
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
      ]);
      trackEvent("login_google_start", {
        method: useRedirect ? "redirect" : "popup",
      });

      if (useRedirect) {
        if (isMobileWeb && window.location.hostname === "localhost") {
          showToast(
            "Google sign-in doesn't work on localhost from a phone. Use your computer's LAN IP or the production URL.",
            "warning"
          );
          return;
        }
        await signInWithRedirect(auth, provider);
        return;
      }

      try {
        const result = await signInWithPopup(auth, provider);
        trackEvent("login_google_success", { uid: result.user.uid });
        showToast("Signed in with Google.", "success");
        history.replace("/auth-loading");
      } catch (err: any) {
        const code = err?.code || "unknown";
        if (popupFallbackCodes.has(code)) {
          trackEvent("login_google_popup_fallback_redirect", { code });
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === "auth/popup-closed-by-user") {
          showToast("Google sign-in cancelled.", "warning");
          return;
        }
        throw err;
      }
    } catch (err: any) {
      const code = err?.code || "unknown";
      trackEvent("login_google_error", { code });
      if (code === "auth/invalid-credential") {
        showToast(
          "Google sign-in was rejected. Confirm your Android SHA-1/256 and the Web client ID, then rebuild the app."
        );
        return;
      }
      if (code === "auth/account-exists-with-different-credential") {
        showToast("An account already exists with a different sign-in method.");
        return;
      }
      if (code === "auth/user-disabled") {
        showToast("This account has been disabled. Contact support.");
        return;
      }
      if (code === "auth/network-request-failed") {
        showToast("Network error. Check your connection and try again.");
        return;
      }
      if (code === "social_login_missing_tokens") {
        showToast(
          "Google sign-in didn't return tokens. Double-check your Web client ID and Android SHA-1/256, then rebuild the app."
        );
        return;
      }
      if (code === "social_login_provider_error") {
        showToast("Google sign-in failed. Please try again.");
        return;
      }
      showToast(handleError("login", err));
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

      <IonContent className="login-page" fullscreen>
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Welcome back</h1>
            <p className="login-subtitle">
              Log in to continue tracking your day.
            </p>
          </div>

          <div className="login-form">
            <IonItem lines="full" className="login-item">
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

            <IonItem lines="none" className="login-item password-item">
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
              className="login-button"
              onClick={handleLogin}
              disabled={busy}
            >
              {busy ? <IonSpinner name="dots" /> : "Log In"}
            </IonButton>
          </div>

          <div className="login-divider">
            <span>or</span>
          </div>

          <IonButton
            expand="block"
            fill="outline"
            className="login-google-button"
            onClick={handleGoogleLogin}
            disabled={busy}
          >
            <IonIcon icon={logoGoogle} slot="start" />
            Sign in with Google
          </IonButton>

          <div className="login-footer">
            <IonText color="medium">
              <p>No account?</p>
            </IonText>
            <IonButton
              fill="clear"
              expand="block"
              className="login-footer-button"
              onClick={() => {
                trackEvent("navigate_to_register_from_login");
                history.push("/register");
              }}
            >
              Create one
            </IonButton>
          </div>
        </div>

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
