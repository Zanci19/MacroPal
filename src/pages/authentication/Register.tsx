import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonText,
  IonItem,
  IonLabel,
  IonToast,
  IonSpinner,
} from "@ionic/react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory } from "react-router-dom";
import { handleError } from "../../utils/handleError";
import "./Register.css";

const emailOk = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const passwordStrongEnough = (s: string) =>
  s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);

const Register: React.FC = () => {
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

  const handleRegister = async () => {
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
      trackEvent("register_validation_failed", { reason: "weak_password" });
      return showToast(
        "Password must be at least 8 characters and include a letter and a number."
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

      await signOut(auth);
      trackEvent("register_signed_out_unverified", {
        uid: cred.user.uid,
      });

      showToast(
        "Verification email sent. Please check your inbox.",
        "success"
      );

      setTimeout(() => history.push("/login"), 900);
    } catch (err: any) {
      const code = err?.code || "unknown";
      trackEvent("register_error", { code });

      let msg: string;

      if (code === "auth/email-already-in-use") {
        msg = "This email is already registered.";
      } else if (code === "auth/invalid-email") {
        msg = "Invalid email address.";
      } else if (code === "auth/weak-password") {
        msg = "Password is too weak.";
      } else {
        msg = handleError("register", err);
      }

      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Create account</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="register-page" fullscreen>
        <div className="register-card">
          <div className="register-header">
            <h1 className="register-title app-typography-title">Get started</h1>
            <p className="register-subtitle app-typography-subheading">
              Create an account to start logging your meals.
            </p>
          </div>

          <div className="register-form">
            <IonItem lines="full" className="register-item">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput
                placeholder="Your name"
                value={name}
                onIonChange={(e: any) => setName(e?.detail?.value ?? "")}
              />
            </IonItem>

            <IonItem lines="full" className="register-item">
              <IonLabel position="stacked">Email</IonLabel>
              <IonInput
                type="email"
                placeholder="you@example.com"
                value={email}
                onIonChange={(e: any) => setEmail(e?.detail?.value ?? "")}
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
                onIonChange={(e: any) => setPw(e?.detail?.value ?? "")}
                autocomplete="new-password"
              />
            </IonItem>

            <IonItem lines="none" className="register-item">
              <IonLabel position="stacked">Confirm password</IonLabel>
              <IonInput
                type="password"
                placeholder="Repeat your password"
                value={pw2}
                onIonChange={(e: any) => setPw2(e?.detail?.value ?? "")}
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

          <div className="register-footer">
            <IonText color="medium">
              <p>Already have an account?</p>
            </IonText>
            <IonButton
              fill="clear"
              expand="block"
              className="register-footer-button"
              onClick={() => {
                trackEvent("navigate_to_login_from_register");
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
