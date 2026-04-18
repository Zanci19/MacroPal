import React, { useEffect, useState } from "react";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonIcon,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonText,
  IonItem,
  IonLabel,
  IonToast,
  IonSpinner,
  isPlatform,
} from "@ionic/react";
import { Capacitor } from "@capacitor/core";
import {
  logoGoogle,
} from "ionicons/icons";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory, type RouteComponentProps } from "react-router-dom";
import { handleError } from "../../utils/handleError";
import { signInWithGoogleSocialLogin } from "../../utils/googleSocialLogin";
import "./Register.css";

const emailOk = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const passwordIssues = (s: string) => {
  const issues: string[] = [];
  if (s.length < 8) issues.push("at least 8 characters");
  if (!/[A-Za-z]/.test(s)) issues.push("a letter");
  if (!/\d/.test(s)) issues.push("a number");
  return issues;
};

const passwordStrongEnough = (s: string) => passwordIssues(s).length === 0;

const formatIssues = (issues: string[]) => {
  if (issues.length === 0) return "";
  if (issues.length === 1) return issues[0];
  if (issues.length === 2) return `${issues[0]} and ${issues[1]}`;
  return `${issues.slice(0, -1).join(", ")}, and ${issues.at(-1)}`;
};

type RegisterProps = {
  embedded?: boolean;
  onSwitchToLogin?: () => void;
} & Partial<RouteComponentProps>;

const Register: React.FC<RegisterProps> = ({
  embedded = false,
  onSwitchToLogin,
}) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useHistory();

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
    show: false,
    message: "",
    color: "success",
  });

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger"
  ) => setToast({ show: true, message, color });

  useEffect(() => {
    let active = true;

    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!active || !result?.user) return;

        setBusy(true);
        trackEvent("register_google_success", { uid: result.user.uid });
        showToast("Signed up with Google.", "success");
        history.replace("/auth-loading");
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        if (!active) return;
        if (err?.code === "auth/argument-error") {
          // No pending redirect result; safe to ignore on some environments.
          return;
        }
        trackEvent("register_google_error", { code: err?.code || "unknown" });
        showToast(handleError("register", err));
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

  const handleRegister = async () => {
    console.log(`[USER ACTION] Register: Clicked sign up button`, {
      hasName: !!name.trim(),
      hasEmail: !!email.trim(),
      hasPassword: !!pw?.trim(),
      hasConfirmPassword: !!pw2?.trim(),
      busy,
    });
    
    if (busy) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPw = (pw ?? "").trim();
    const cleanPw2 = (pw2 ?? "").trim();

    trackEvent("register_attempt", {
      has_name: !!cleanName,
      has_email: !!cleanEmail,
      pw_len: cleanPw.length,
      pw2_len: cleanPw2.length,
      pw_match: cleanPw === cleanPw2,
    });

    if (!cleanName) {
      trackEvent("register_validation_failed", { reason: "name_empty" });
      return showToast("Please enter your name.");
    }
    if (!emailOk(cleanEmail)) {
      trackEvent("register_validation_failed", { reason: "invalid_email" });
      return showToast("Please enter a valid email address.");
    }
    if (!cleanPw) {
      trackEvent("register_validation_failed", { reason: "password_empty" });
      return showToast("Please enter a password.");
    }
    if (!passwordStrongEnough(cleanPw)) {
      const issues = formatIssues(passwordIssues(cleanPw));
      trackEvent("register_validation_failed", { reason: "weak_password" });
      return showToast(
        `Password isn't strong enough. Add ${issues}.`
      );
    }
    if (!cleanPw2) {
      trackEvent("register_validation_failed", { reason: "confirm_empty" });
      return showToast("Please confirm your password.");
    }
    if (cleanPw !== cleanPw2) {
      trackEvent("register_validation_failed", { reason: "password_mismatch" });
      return showToast("Passwords do not match.");
    }

    try {
      setBusy(true);

      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPw
      );

      await updateProfile(cred.user, { displayName: cleanName });

      await sendEmailVerification(cred.user);

      trackEvent("register_success", {
        uid: cred.user.uid,
        has_display_name: !!cleanName,
      });

      showToast(
        "Verification email sent. Please check your inbox.",
        "success"
      );
      history.replace("/verify-email");
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      const code = err?.code || "unknown";
      trackEvent("register_error", { code });

      let msg: string;

      if (code === "auth/email-already-in-use") {
        msg = "This email is already registered.";
      } else if (code === "auth/invalid-email") {
        msg = "Invalid email address.";
      } else if (code === "auth/weak-password") {
        const issues = formatIssues(passwordIssues(cleanPw));
        msg = issues
          ? `Password isn't strong enough. Add ${issues}.`
          : "Password is too weak.";
      } else {
        msg = handleError("register", err);
      }

      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleRegister = async () => {
    console.log(`[USER ACTION] Register: Clicked Google register button`, {
      isNativePlatform: Capacitor.isNativePlatform(),
      busy,
    });
    
    if (busy) return;
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        trackEvent("register_google_start", {
          method: "social_login",
        });

        const result = await signInWithGoogleSocialLogin();
        trackEvent("register_google_success", { uid: result.user.uid });
        showToast("Signed up with Google.", "success");
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
      trackEvent("register_google_start", {
        method: useRedirect ? "redirect" : "popup",
      });

      if (useRedirect) {
        if (isMobileWeb && window.location.hostname === "localhost") {
          showToast(
            "Google sign-up doesn't work on localhost from a phone. Use your computer's LAN IP or the production URL.",
            "warning"
          );
          return;
        }
        await signInWithRedirect(auth, provider);
        return;
      }

      try {
        const result = await signInWithPopup(auth, provider);
        trackEvent("register_google_success", { uid: result.user.uid });
        showToast("Signed up with Google.", "success");
        history.replace("/auth-loading");
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        const code = err?.code || "unknown";
        if (popupFallbackCodes.has(code)) {
          trackEvent("register_google_popup_fallback_redirect", { code });
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === "auth/popup-closed-by-user") {
          showToast("Google sign-up cancelled.", "warning");
          return;
        }
        throw err;
      }
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      const code = err?.code || "unknown";
      const message = typeof err?.message === "string" ? err.message : "";
      trackEvent("register_google_error", { code });
      if (code === "auth/invalid-credential") {
        showToast(
          "Google sign-up was rejected. Confirm your Android SHA-1/256 and the Web client ID, then rebuild the app."
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
          "Google sign-up didn't return tokens. Double-check your Web client ID and Android SHA-1/256, then rebuild the app."
        );
        return;
      }
      if (code === "social_login_provider_error") {
        showToast("Google sign-up failed. Please try again.");
        return;
      }
      if (message) {
        showToast(message);
        return;
      }
      showToast(handleError("register", err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      {!embedded && (
        <IonHeader>
          <IonToolbar>
            <IonTitle>Create account</IonTitle>
          </IonToolbar>
        </IonHeader>
      )}

      <IonContent
        className={`register-page${embedded ? " register-page--embedded" : ""}`}
        fullscreen
      >
        <div className="register-card">
          <div className="register-header">
            <h1 className="register-title">Get started</h1>
            <p className="register-subtitle">
              Create an account to start logging your meals.
            </p>
          </div>

          <div className="register-form">
            <IonItem lines="full" className="register-item">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput
                placeholder="Your name"
                value={name}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] Register: Name input changed`, {
                    hasValue: !!e?.detail?.value,
                    length: e?.detail?.value?.length ?? 0,
                  });
                  setName(e?.detail?.value ?? "");
                }}
              />
            </IonItem>

            <IonItem lines="full" className="register-item">
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                type="email"
                placeholder="you@example.com"
                value={email}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] Register: Email input changed`, {
                    hasValue: !!e?.detail?.value,
                    length: e?.detail?.value?.length ?? 0,
                  });
                  setEmail(e?.detail?.value ?? "");
                }}
                inputmode="email"
                autocomplete="email"
              />
            </IonItem>

            <IonItem lines="full" className="register-item">
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                placeholder="At least 8 characters, include a number"
                value={pw}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] Register: Password input changed`, {
                    hasValue: !!e?.detail?.value,
                    length: e?.detail?.value?.length ?? 0,
                  });
                  setPw(e?.detail?.value ?? "");
                }}
                autocomplete="new-password"
              />
            </IonItem>

            <IonItem lines="none" className="register-item">
              <IonLabel position="stacked">Confirm password</IonLabel>
              <IonInput
                type="password"
                placeholder="Repeat your password"
                value={pw2}
                onIonChange={(e) => {
                  console.log(`[USER ACTION] Register: Confirm password input changed`, {
                    hasValue: !!e?.detail?.value,
                    length: e?.detail?.value?.length ?? 0,
                  });
                  setPw2(e?.detail?.value ?? "");
                }}
                autocomplete="new-password"
              />
            </IonItem>

            <IonButton
              expand="block"
              className="register-button"
              onClick={handleRegister}
              disabled={busy}
            >
              {busy ? <IonSpinner name="dots" /> : "Sign Up"}
            </IonButton>
          </div>

          <div className="register-divider">
            <span>or</span>
          </div>

          <IonButton
            expand="block"
            fill="outline"
            className="register-google-button"
            onClick={handleGoogleRegister}
            disabled={busy}
          >
            <IonIcon icon={logoGoogle} slot="start" />
            Register with Google
          </IonButton>

          <div className="register-footer">
            <IonText color="medium">
              <p>Already have an account?</p>
            </IonText>
            <IonButton
              fill="clear"
              expand="block"
              className="register-footer-button"
              onClick={() => {
                console.log(`[USER ACTION] Register: Clicked login link`);
                trackEvent("navigate_to_login_from_register");
                if (embedded) {
                  onSwitchToLogin?.();
                  return;
                }
                history.push("/login");
              }}
            >
              Log In
            </IonButton>
          </div>
        </div>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((s) => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={2800}
        />
      </IonContent>
    </IonPage>
  );
};

export default Register;
