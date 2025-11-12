// src/pages/auth/Register.tsx
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
import { auth } from "../../firebase";
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

  const showToast = (message: string, color: "success" | "danger" | "warning" = "danger") =>
    setToast({ show: true, message, color });

  const handleRegister = async () => {
    // Client-side validation (fail fast with clear messages)
    if (!name.trim()) return showToast("Please enter your name.");
    if (!emailOk(email)) return showToast("Please enter a valid email address.");
    if (!passwordStrongEnough(pw))
      return showToast("Password must be at least 8 characters and include a letter and a number.");
    if (pw !== pw2) return showToast("Passwords do not match.");

    try {
      // Create auth user
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);

      // Attach display name (safe to do pre-verification)
      await updateProfile(cred.user, { displayName: name.trim() });

      // Send verification email (ActionCodeSettings optional; keep simple default)
      await sendEmailVerification(cred.user);

      // Important: DO NOT create Firestore user doc yet.
      // We only create profile data after the user confirms ownership (emailVerified).
      // You can do this on first verified login, or on a dedicated /setup-profile step
      // that rechecks `auth.currentUser.emailVerified === true`.

      // Immediately sign out so unverified users cannot continue into the app
      await signOut(auth);

      showToast("Verification email sent. Please check your inbox.", "success");

      // Short delay so the toast is visible, then return to login
      setTimeout(() => history.push("/login"), 900);
    } catch (err: any) {
      // Friendly error mapping
      const msg =
        err?.code === "auth/email-already-in-use"
          ? "This email is already registered."
          : err?.code === "auth/invalid-email"
          ? "Invalid email address."
          : err?.code === "auth/weak-password"
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

        <IonButton expand="block" className="ion-margin-top" onClick={handleRegister}>
          Sign Up
        </IonButton>

        <IonText className="ion-text-center" color="medium">
          <p className="ion-margin-top">Already have an account?</p>
        </IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/login")}>
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
