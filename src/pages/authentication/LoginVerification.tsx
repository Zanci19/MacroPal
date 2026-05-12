import React from "react";
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
  IonSpinner,
  IonText,
  IonToast,
} from "@ionic/react";
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  RecaptchaVerifier,
  signOut,
  type PhoneMultiFactorInfo,
} from "firebase/auth";
import { useHistory } from "react-router-dom";
import { auth, trackEvent } from "../../firebase";
import { handleError } from "../../utils/handleError";
import {
  clearPendingMfaChallenge,
  getPendingMfaChallenge,
  setPendingMfaChallenge,
  type PendingMfaChallengeMethod,
} from "../../utils/mfaChallengeStore";
import "./LoginVerification.css";

const LoginVerification: React.FC = () => {
  const history = useHistory();
  const pending = getPendingMfaChallenge();
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [selectedMethod, setSelectedMethod] =
    React.useState<PendingMfaChallengeMethod>(pending?.method ?? "sms");
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: "success" | "danger" | "warning";
  }>({
    show: false,
    message: "",
    color: "success",
  });
  const mfaRecaptchaContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mfaRecaptchaVerifierRef = React.useRef<RecaptchaVerifier | null>(null);
  const lastAutoSubmittedCodeRef = React.useRef<string | null>(null);

  const showToast = React.useCallback(
    (
      message: string,
      color: "success" | "danger" | "warning" = "danger",
    ) => setToast({ show: true, message, color }),
    [],
  );

  const clearMfaRecaptcha = React.useCallback(() => {
    if (!mfaRecaptchaVerifierRef.current) return;
    try {
      mfaRecaptchaVerifierRef.current.clear();
    } catch (error) {
      console.warn("Failed to clear MFA reCAPTCHA verifier:", error);
    } finally {
      mfaRecaptchaVerifierRef.current = null;
    }
  }, []);

  const ensureMfaRecaptcha = React.useCallback(async () => {
    const container = mfaRecaptchaContainerRef.current;
    if (!container) {
      throw new Error("Security challenge is not ready yet. Please retry.");
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

  const availableMethods = React.useMemo(() => {
    if (!pending) return [] as PendingMfaChallengeMethod[];
    if (pending.availableMethods?.length) return pending.availableMethods;
    const fallbackMethods: PendingMfaChallengeMethod[] = [];
    if (pending.verificationId) fallbackMethods.push("sms");
    if (pending.totpEnrollmentId) fallbackMethods.push("authenticator");
    return fallbackMethods;
  }, [pending]);
  const phoneHint = React.useMemo(() => {
    if (!pending) return null;
    return (
      (pending.resolver.hints.find(
        (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
      ) as PhoneMultiFactorInfo | undefined) ?? null
    );
  }, [pending]);

  const maskedPhone = pending?.maskedPhone ?? null;
  const selectedMethodLabel =
    selectedMethod === "authenticator"
      ? "Authenticator app (TOTP)"
      : "SMS verification";
  const methodSwitchLabel =
    selectedMethod === "authenticator"
      ? "Use SMS instead"
      : "Use Authenticator app instead";
  const methodSwitchTarget: PendingMfaChallengeMethod =
    selectedMethod === "authenticator" ? "sms" : "authenticator";
  const selectedMethodReady = pending
    ? selectedMethod === "authenticator"
      ? Boolean(pending.totpEnrollmentId)
      : Boolean(pending.verificationId)
    : false;
  const canRequestSmsCode = selectedMethod === "sms" && Boolean(phoneHint);

  const navigateToAuthLoading = React.useCallback(() => {
    const currentPath = window.location.pathname;
    history.replace("/auth-loading");
    window.setTimeout(() => {
      if (window.location.pathname === currentPath) {
        history.replace("/auth-loading");
      }
    }, 200);
  }, [history]);

  React.useEffect(() => {
    if (pending?.method) {
      setSelectedMethod(pending.method);
    }
  }, [pending]);

  React.useEffect(() => {
    setCode("");
    lastAutoSubmittedCodeRef.current = null;
  }, [selectedMethod]);

  React.useEffect(() => {
    if (!pending) {
      history.replace("/login");
    }
  }, [history, pending]);

  React.useEffect(() => {
    return () => {
      clearMfaRecaptcha();
    };
  }, [clearMfaRecaptcha]);

  const handleResendSmsCode = React.useCallback(async () => {
    const challenge = getPendingMfaChallenge();
    if (!challenge) {
      showToast("Verification session expired. Please log in again.", "warning");
      history.replace("/login");
      return;
    }

    const hint = challenge.resolver.hints.find(
      (entry) => entry.factorId === PhoneMultiFactorGenerator.FACTOR_ID,
    ) as PhoneMultiFactorInfo | undefined;
    if (!hint) {
      showToast("SMS verification is unavailable for this account.", "warning");
      return;
    }

    setBusy(true);
    try {
      const verifier = await ensureMfaRecaptcha();
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          multiFactorHint: hint,
          session: challenge.resolver.session,
        },
        verifier,
      );
      setPendingMfaChallenge({
        ...challenge,
        method: "sms",
        verificationId,
        maskedPhone: hint.phoneNumber ?? challenge.maskedPhone,
        createdAt: Date.now(),
      });
      setCode("");
      lastAutoSubmittedCodeRef.current = null;
      trackEvent("login_mfa_sms_resent");
      showToast(
        `New code sent${hint.phoneNumber ? ` to ${hint.phoneNumber}` : "."}`,
        "success",
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      trackEvent("login_mfa_sms_resend_error", { error: err.message });
      showToast(handleError("login_mfa_challenge", err));
    } finally {
      setBusy(false);
    }
  }, [ensureMfaRecaptcha, history, showToast]);

  const handleVerify = React.useCallback(async () => {
    const challenge = getPendingMfaChallenge();
    if (!challenge) {
      showToast("Verification session expired. Please log in again.", "warning");
      history.replace("/login");
      return;
    }

    if (!selectedMethodReady) {
      showToast(
        selectedMethod === "authenticator"
          ? "Authenticator verification is unavailable for this challenge."
          : "No active SMS code yet. Tap resend code first.",
        "warning",
      );
      return;
    }

    const trimmedCode = code.trim();
    const codePattern =
      selectedMethod === "authenticator" ? /^\d{6,8}$/ : /^\d{6}$/;
    if (!codePattern.test(trimmedCode)) {
      showToast(
        selectedMethod === "authenticator"
          ? "Enter a valid code from your Authenticator app."
          : "Enter the 6-digit verification code.",
        "warning",
      );
      return;
    }

    setBusy(true);
    try {
      const assertion =
        selectedMethod === "authenticator"
          ? (() => {
              if (!challenge.totpEnrollmentId) {
                throw new Error(
                  "Authenticator verification is missing. Start the login process again.",
                );
              }
              return TotpMultiFactorGenerator.assertionForSignIn(
                challenge.totpEnrollmentId,
                trimmedCode,
              );
            })()
          : (() => {
              if (!challenge.verificationId) {
                throw new Error(
                  "SMS verification is missing. Start the login process again.",
                );
              }
              const credential = PhoneAuthProvider.credential(
                challenge.verificationId,
                trimmedCode,
              );
              return PhoneMultiFactorGenerator.assertion(credential);
            })();

      const credential = await challenge.resolver.resolveSignIn(assertion);
      trackEvent("login_mfa_success", {
        uid: credential.user.uid,
        factor_type: selectedMethod,
      });

      clearPendingMfaChallenge();

      if (!credential.user.emailVerified) {
        await signOut(auth);
        showToast("Please verify your email before continuing.", "warning");
        history.replace("/login");
        return;
      }

      showToast("Verification successful. Welcome back!", "success");
      navigateToAuthLoading();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      trackEvent("login_mfa_error", {
        error: err.message,
        factor_type: selectedMethod,
      });
      showToast(handleError("login_mfa_verify", err));
    } finally {
      setBusy(false);
    }
  }, [code, history, navigateToAuthLoading, selectedMethod, selectedMethodReady, showToast]);

  React.useEffect(() => {
    if (selectedMethod !== "sms" || !selectedMethodReady || busy) return;
    const nextCode = code.trim();
    if (nextCode.length !== 6) {
      lastAutoSubmittedCodeRef.current = null;
      return;
    }
    if (lastAutoSubmittedCodeRef.current === nextCode) {
      return;
    }
    lastAutoSubmittedCodeRef.current = nextCode;
    void handleVerify();
  }, [busy, code, handleVerify, selectedMethod, selectedMethodReady]);

  const handleCancel = () => {
    clearPendingMfaChallenge();
    history.replace("/login");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Two-step verification</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="login-verify-page" fullscreen>
        <div className="login-verify-shell">
          <div className="login-verify-card">
            <div className="login-verify-header">
              <h1 className="login-verify-title">Verify it&apos;s you</h1>
              <p className="login-verify-subtitle">
                {selectedMethod === "authenticator"
                  ? "Enter the code from your Authenticator app."
                  : `Enter the 6-digit code sent${
                      maskedPhone ? ` to ${maskedPhone}` : " to your phone"
                    }.`}
              </p>
            </div>

            <IonText color="medium">
              <p className="login-verify-meta">
                Method:{" "}
                <strong>
                  {selectedMethodLabel}
                </strong>
              </p>
            </IonText>

            {availableMethods.length > 1 && (
              <IonButton
                fill="clear"
                size="small"
                className="login-verify-method-toggle"
                onClick={() => setSelectedMethod(methodSwitchTarget)}
                disabled={busy}
              >
                {methodSwitchLabel}
              </IonButton>
            )}

            <IonItem lines="none" className="login-verify-item">
              <IonLabel position="stacked">Verification code</IonLabel>
              <IonInput
                type="tel"
                inputmode="numeric"
                maxlength={selectedMethod === "authenticator" ? 8 : 6}
                autocomplete="one-time-code"
                name="one-time-code"
                enterkeyhint="done"
                autocapitalize="off"
                autocorrect="off"
                value={code}
                placeholder={
                  selectedMethod === "authenticator" ? "Authenticator code" : "6-digit code"
                }
                onIonInput={(event) => {
                  const next = (event.detail.value ?? "")
                    .replace(/[^\d]/g, "")
                    .slice(0, selectedMethod === "authenticator" ? 8 : 6);
                  setCode(next);
                }}
                onIonChange={(event) => {
                  const next = (event.detail.value ?? "")
                    .replace(/[^\d]/g, "")
                    .slice(0, selectedMethod === "authenticator" ? 8 : 6);
                  setCode(next);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleVerify();
                  }
                }}
              />
            </IonItem>

            {!selectedMethodReady && (
              <IonText color="warning">
                <p className="login-verify-warning">
                  {selectedMethod === "sms"
                    ? "No active SMS code. Resend a new code to continue."
                    : "This verification method is unavailable. Switch methods or restart login."}
                </p>
              </IonText>
            )}

            <div className="login-verify-actions">
              {canRequestSmsCode && (
                <IonButton
                  expand="block"
                  fill="outline"
                  className="login-verify-resend"
                  onClick={() => {
                    void handleResendSmsCode();
                  }}
                  disabled={busy}
                >
                  {busy ? <IonSpinner name="dots" /> : "Resend SMS code"}
                </IonButton>
              )}
              <IonButton
                expand="block"
                className="login-verify-button"
                onClick={handleVerify}
                disabled={
                  busy ||
                  !selectedMethodReady ||
                  (selectedMethod === "authenticator"
                    ? code.trim().length < 6
                    : code.trim().length !== 6)
                }
              >
                {busy ? <IonSpinner name="dots" /> : "Verify & continue"}
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                color="medium"
                onClick={handleCancel}
                disabled={busy}
              >
                Cancel
              </IonButton>
            </div>
          </div>
        </div>

        <IonToast
          isOpen={toast.show}
          duration={2000}
          message={toast.message}
          color={toast.color}
          onDidDismiss={() => setToast((previous) => ({ ...previous, show: false }))}
        />
        <div ref={mfaRecaptchaContainerRef} className="login-verify-recaptcha" aria-hidden="true" />
      </IonContent>
    </IonPage>
  );
};

export default LoginVerification;

