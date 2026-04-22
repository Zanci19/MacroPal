import React, { useEffect, useRef, useState } from "react";
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
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  RecaptchaVerifier,
  type MultiFactorError,
  type User,
  type PhoneMultiFactorInfo,
  type TotpMultiFactorInfo,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory, type RouteComponentProps } from "react-router-dom";
import { handleError } from "../../utils/handleError";
import { signInWithGoogleSocialLogin } from "../../utils/googleSocialLogin";
import {
  clearPendingMfaChallenge,
  setPendingMfaChallenge,
} from "../../utils/mfaChallengeStore";
import "./Login.css";

type LoginProps = {
  embedded?: boolean;
  onSwitchToRegister?: () => void;
} & Partial<RouteComponentProps>;

const Login: React.FC<LoginProps> = ({ embedded = false, onSwitchToRegister }) => {
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const mfaRecaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const mfaRecaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

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

  const showToast = React.useCallback((
    message: string,
    color: "success" | "danger" | "warning" = "danger",
    buttons?: {
      text: string;
      role?: "cancel" | "destructive";
      handler?: () => void;
    }[]
  ) => setToast({ show: true, message, color, buttons }), []);

  const clearMfaRecaptcha = React.useCallback(() => {
    if (!mfaRecaptchaVerifierRef.current) return;
    try {
      mfaRecaptchaVerifierRef.current.clear();
    } catch (error) {
      console.warn("Failed to clear login MFA reCAPTCHA verifier:", error);
    } finally {
      mfaRecaptchaVerifierRef.current = null;
    }
  }, []);

  const ensureMfaRecaptcha = React.useCallback(async () => {
    const container = mfaRecaptchaContainerRef.current;
    if (!container) {
      throw new Error("Security challenge is not ready. Please reload and try again.");
    }

    if (mfaRecaptchaVerifierRef.current) {
      return mfaRecaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, container, {
      size: "invisible",
    });
    await verifier.render();
    mfaRecaptchaVerifierRef.current = verifier;
    return verifier;
  }, []);

  const finalizeLogin = async (signedInUser: User) => {
    setFailedAttempts(0);
    setLockUntil(null);

    trackEvent("login_credentials_valid", {
      uid: signedInUser.uid,
      email_verified: signedInUser.emailVerified,
    });

    if (!signedInUser.emailVerified) {
      const userForEmail = signedInUser;
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

    trackEvent("login_success", { uid: signedInUser.uid });
    showToast("Welcome back!", "success");
    history.replace("/auth-loading");
  };

  const beginMfaSignInChallenge = React.useCallback(async (
    error: MultiFactorError,
    method: "password" | "google"
  ) => {
    try {
      const resolver = getMultiFactorResolver(auth, error);
      const phoneHints = resolver.hints.filter(
        (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      ) as PhoneMultiFactorInfo[];
      const totpHints = resolver.hints.filter(
        (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
      ) as TotpMultiFactorInfo[];

      const selectedPhoneHint = phoneHints[0];
      const selectedTotpHint = totpHints[0];
      const availableMethods = [
        ...(selectedPhoneHint ? (["sms"] as const) : []),
        ...(selectedTotpHint ? (["authenticator"] as const) : []),
      ];

      if (!availableMethods.length) {
        throw new Error("This account requires a second factor that this app does not support yet.");
      }

      let verificationId: string | null = null;
      if (selectedPhoneHint) {
        try {
          const verifier = await ensureMfaRecaptcha();
          const provider = new PhoneAuthProvider(auth);
          verificationId = await provider.verifyPhoneNumber(
            {
              multiFactorHint: selectedPhoneHint,
              session: resolver.session,
            },
            verifier
          );
        } catch (smsError) {
          if (!selectedTotpHint) {
            throw smsError;
          }
        }
      }

      const selectedMethod =
        verificationId || !selectedTotpHint ? "sms" : "authenticator";

      setPendingMfaChallenge({
        resolver,
        method: selectedMethod,
        availableMethods,
        verificationId,
        totpEnrollmentId: selectedTotpHint?.uid ?? null,
        maskedPhone: selectedPhoneHint?.phoneNumber ?? null,
        source: method,
        createdAt: Date.now(),
      });
      clearMfaRecaptcha();
      trackEvent("login_mfa_challenge_sent", {
        method,
        factor_count: resolver.hints.length,
        factor_type:
          availableMethods.length > 1
            ? "multiple"
            : availableMethods[0],
      });
      showToast("Continue on the verification page to complete sign in.", "success");
      history.replace("/login-verify");
      return;
    } catch (challengeError) {
      const err =
        challengeError instanceof Error
          ? challengeError
          : new Error(String(challengeError ?? "Unknown MFA challenge error"));
      trackEvent("login_mfa_challenge_error", {
        method,
        error: err.message,
      });
      showToast(handleError("login_mfa_challenge", err));
      clearPendingMfaChallenge();
      clearMfaRecaptcha();
    }
  }, [clearMfaRecaptcha, ensureMfaRecaptcha, history, showToast]);

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
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
        if (!active) return;
        if (err?.code === "auth/argument-error") {
          // No pending redirect result; safe to ignore on some environments.
          return;
        }
        if (err?.code === "auth/multi-factor-auth-required") {
          await beginMfaSignInChallenge(err as MultiFactorError, "google");
          return;
        }
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
  }, [beginMfaSignInChallenge, history, showToast]);

  useEffect(() => {
    clearPendingMfaChallenge();
  }, []);

  useEffect(() => {
    return () => {
      clearMfaRecaptcha();
    };
  }, [clearMfaRecaptcha]);

  const handleLogin = async () => {
    console.log(`[USER ACTION] Login: Clicked login button`, {
      hasEmail: !!email.trim(),
      hasPassword: !!pw.trim(),
      busy,
    });
    
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
      await finalizeLogin(cred.user);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };

      if (err?.code === "auth/multi-factor-auth-required") {
        await beginMfaSignInChallenge(err as MultiFactorError, "password");
        return;
      }

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
    console.log(`[USER ACTION] Login: Clicked Google sign-in button`, {
      isNativePlatform: Capacitor.isNativePlatform(),
      busy,
    });
    
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
      const popupFallbackCodes = new Set([
        "auth/operation-not-supported-in-this-environment",
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
      ]);
      trackEvent("login_google_start", {
        method: "popup_with_redirect_fallback",
      });

      try {
        const result = await signInWithPopup(auth, provider);
        trackEvent("login_google_success", { uid: result.user.uid });
        showToast("Signed in with Google.", "success");
        history.replace("/auth-loading");
      } catch (error: unknown) {
        const err = error as Error & { code?: string };
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
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      const code = err?.code || "unknown";
      const message = typeof err?.message === "string" ? err.message : "";

      if (code === "auth/multi-factor-auth-required") {
        await beginMfaSignInChallenge(err as MultiFactorError, "google");
        return;
      }

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
      if (code === "auth/unauthorized-domain") {
        showToast(
          "Google sign-in isn't enabled for this URL yet. Add this domain in Firebase Authentication > Authorized domains."
        );
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
      if (message) {
        showToast(message);
        return;
      }
      showToast(handleError("login", err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      {!embedded && (
        <IonHeader>
          <IonToolbar>
            <IonTitle>Log In</IonTitle>
          </IonToolbar>
        </IonHeader>
      )}

      <IonContent
        className={`login-page${embedded ? " login-page--embedded" : ""}`}
        fullscreen
      >
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
                onIonInput={(e) => {
                  console.log(`[USER ACTION] Login: Email input changed`, {
                    hasValue: !!e.detail.value,
                    length: e.detail.value?.length ?? 0,
                  });
                  setEmail(e.detail.value ?? "");
                }}
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
                  onIonInput={(e) => {
                    console.log(`[USER ACTION] Login: Password input changed`, {
                      hasValue: !!e.detail.value,
                      length: e.detail.value?.length ?? 0,
                    });
                    setPw(e.detail.value ?? "");
                  }}
                  className="pw-input"
                />
                <button
                  type="button"
                  className="pw-toggle-btn"
                  onClick={() => {
                    console.log(`[USER ACTION] Login: Toggled password visibility`, {
                      newState: !showPw ? "visible" : "hidden",
                    });
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
                console.log(`[USER ACTION] Login: Clicked create account link`);
                trackEvent("navigate_to_register_from_login");
                if (embedded) {
                  onSwitchToRegister?.();
                  return;
                }
                history.push("/register");
              }}
            >
              Create one
            </IonButton>
          </div>
        </div>

        <div ref={mfaRecaptchaContainerRef} className="login-mfa-recaptcha" aria-hidden="true" />

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
