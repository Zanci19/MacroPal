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
} from "@ionic/react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { useHistory } from "react-router-dom";

// Small helpers
const emailOk = (s: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const passwordStrongEnough = (s: string) =>
  s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
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
    trackEvent("register_attempt", {
      has_name: !!name.trim(),
      has_email: !!email.trim(),
    });

    // Client-side validation (fail fast with clear messages)
    if (!name.trim()) {
      trackEvent("register_validation_failed", { reason: "name_empty" });
      return showToast("Please enter your name.");
    }
    if (!emailOk(email)) {
      trackEvent("register_validation_failed", { reason: "invalid_email" });
      return showToast("Please enter a valid email address.");
    }
    if (!passwordStrongEnough(pw)) {
      trackEvent("register_validation_failed", { reason: "weak_password" });
      return showToast(
        "Password must be at least 8 characters and include a letter and a number."
      );
    }
    if (pw !== pw2) {
      trackEvent("register_validation_failed", { reason: "password_mismatch" });
      return showToast("Passwords do not match.");
    }

    try {
      // Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);

      // Attach display name (safe to do pre-verification)
      await updateProfile(cred.user, { displayName: name.trim() });

      // Send verification email (ActionCodeSettings optional; keep simple default)
      await sendEmailVerification(cred.user);

      trackEvent("register_success", {
        uid: cred.user.uid,
        has_display_name: !!name.trim(),
      });

      // Immediately sign out so unverified users cannot continue into the app
      await signOut(auth);
      trackEvent("register_signed_out_unverified", {
        uid: cred.user.uid,
      });
      
      showToast("Verification email sent. Please check your inbox.", "success");

      // Short delay so the toast is visible, then return to login
      setTimeout(() => history.push("/login"), 900);
    } catch (err: any) {
      const code = err?.code || "unknown";
      trackEvent("register_error", { code });

      // Friendly error mapping
      const msg =
        code === "auth/email-already-in-use"
          ? "This email is already registered."
          : code === "auth/invalid-email"
          ? "Invalid email address."
          : code === "auth/weak-password"
          ? "Password is too weak."
          : err?.message || "Registration failed.";
      showToast(msg);
      console.error(err);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Create account</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Name</IonLabel>
          <IonInput
            placeholder="Your name"
            value={name}
            onIonChange={(e: any) => setName(e?.detail?.value ?? "")}
          />
        </IonItem>

        <IonItem>
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

        <IonItem>
          <IonLabel position="stacked">Password</IonLabel>
          <IonInput
            type="password"
            placeholder="At least 8 characters, include a number!"
            value={pw}
            onIonChange={(e: any) => setPw(e?.detail?.value ?? "")}
            autocomplete="new-password"
          />
        </IonItem>

        <IonItem>
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
          className="ion-margin-top"
          onClick={handleRegister}
        >
          Sign Up
        </IonButton>

        <IonText className="ion-text-center" color="medium">
          <p className="ion-margin-top">Already have an account?</p>
        </IonText>
        <IonButton
          fill="clear"
          expand="block"
          onClick={() => {
            trackEvent("navigate_to_login_from_register");
            history.push("/login");
          }}
        >
          Log In
        </IonButton>

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
