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
} from "firebase/auth";
import { auth } from "../../firebase";
import { useHistory } from "react-router-dom";

const Login: React.FC = () => {
  const history = useHistory();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: "success" | "danger" | "warning";
    buttons?: { text: string; role?: "cancel" | "destructive"; handler?: () => void }[];
  }>({
    show: false,
    message: "",
    color: "success",
  });

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger",
    buttons?: { text: string; role?: "cancel" | "destructive"; handler?: () => void }[]
  ) => setToast({ show: true, message, color, buttons });

  const handleLogin = async () => {
    if (!email.trim() || !pw.trim()) {
      showToast("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pw);

      if (!cred.user.emailVerified) {
        const userForEmail = cred.user;
        const resend = async () => {
          try {
            await sendEmailVerification(userForEmail);
            showToast("Verification email sent. Please check your inbox.", "success");
          } catch (e) {
            showToast("Could not send verification email. Try again later.");
            console.error(e);
          }
        };

        await signOut(auth);
        showToast("Please verify your email to continue.", "warning", [
          { text: "Resend email", handler: resend },
        ]);
        return;
      }

      showToast("Welcome back!", "success");
      history.replace("/auth-loading");
    } catch (err: any) {
      const msg =
        err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password"
          ? "Incorrect email or password."
          : err?.code === "auth/user-not-found"
          ? "No account found with that email."
          : err?.message || "Login failed.";
      showToast(msg);
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

        <IonItem>
          <IonLabel position="stacked">Password</IonLabel>
          <IonInput
            type="password"
            autocomplete="current-password"
            autocapitalize="off"
            autocorrect="off"
            placeholder="Your password"
            value={pw}
            onIonInput={(e: any) => setPw(e.detail.value ?? "")}
          />
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
        <IonButton fill="clear" expand="block" onClick={() => history.push("/register")}>
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
