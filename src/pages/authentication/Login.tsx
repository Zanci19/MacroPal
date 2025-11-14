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
  import { auth, db } from "../../firebase";
  import { useHistory } from "react-router-dom";
  import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

  const Login: React.FC = () => {
    const history = useHistory();

    const [email, setEmail] = useState("");
    const [pw, setPw] = useState("");
    const [busy, setBusy] = useState(false);

    // when set, we'll navigate after the toast closes
    const [nextRoute, setNextRoute] = useState<string | null>(null);

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

        // Block unverified users
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

        const userRef = doc(db, "users", cred.user.uid);
        const snap = await getDoc(userRef);

        let targetRoute = "/setup-profile";

        if (snap.exists()) {
          const data = snap.data();
          const p = data.profile;

          if (
            p &&
            typeof p.age === "number" &&
            typeof p.weight === "number" &&
            typeof p.height === "number" &&
            p.goal &&
            p.gender &&
            p.activity
          ) {
            targetRoute = "/app/home";
          } else {
            targetRoute = "/setup-profile";
          }
        } else {
          // Create basic user doc if missing
          await setDoc(
            userRef,
            {
              uid: cred.user.uid,
              email: cred.user.email ?? null,
              displayName: cred.user.displayName ?? null,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          targetRoute = "/setup-profile";
        }

        setNextRoute(targetRoute);
        showToast("Welcome back!", "success");
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
              placeholder="you@example.com"
              value={email}
              onIonChange={(e: any) => setEmail(e?.detail?.value ?? "")}
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Password</IonLabel>
            <IonInput
              type="password"
              autocomplete="current-password"
              placeholder="Your password"
              value={pw}
              onIonChange={(e: any) => setPw(e?.detail?.value ?? "")}
            />
          </IonItem>

          <IonButton expand="block" className="ion-margin-top" onClick={handleLogin} disabled={busy}>
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
            // For success/error toasts without buttons, auto-dismiss after 1800ms.
            duration={toast.buttons ? undefined : 1800}
            message={toast.message}
            color={toast.color}
            buttons={toast.buttons}
            onDidDismiss={() => {
              // close toast state
              setToast((s) => ({ ...s, show: false, buttons: undefined }));
              // if a post-toast navigation is pending, do it now
              if (nextRoute) {
                const go = nextRoute;
                setNextRoute(null);
                history.push(go);
              }
            }}
          />
        </IonContent>
      </IonPage>
    );
  };

  export default Login;
