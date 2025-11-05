import React, { useEffect, useState } from "react";
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
  IonToast
} from "@ionic/react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { useHistory } from "react-router";
import "../../styles/forms.css";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();
  const [toast, setToast] = useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: '',
    color: 'success'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        history.push("/app/home");
      }
    });
    return unsubscribe;
  }, [history]);

  const handleLogin = async () => {
    if (!email.trim()) {
      setToast({ show: true, message: "Please enter your email.", color: "danger" });
      return;
    }
    if (!password) {
      setToast({ show: true, message: "Please enter your password.", color: "danger" });
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setToast({ show: true, message: "Logged in successfully.", color: "success" });
      // onAuthStateChanged will navigate to /app/home
    } catch (error: any) {
      console.error(error);
      setToast({ show: true, message: error?.message ?? "Failed to sign in.", color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Login</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="mp-auth-content">
        <div className="mp-auth-card" role="main">
          <div className="mp-auth-card__logo" aria-hidden="true">MP</div>
          <h1>Welcome back</h1>
          <p className="mp-auth-subtitle">Sign in to pick up where you left off and stay on top of your daily macros.</p>

          <div className="mp-auth-form">
            <IonItem lines="none">
              <IonInput
                labelPlacement="stacked"
                label="Email"
                placeholder="you@example.com"
                type="email"
                value={email}
                onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')}
              />
            </IonItem>

            <IonItem lines="none">
              <IonInput
                labelPlacement="stacked"
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onIonChange={(e: any) => setPassword(e?.detail?.value ?? '')}
              />
            </IonItem>
          </div>

          <IonButton className="mp-auth-button" expand="block" size="large" onClick={handleLogin}>
            Login
          </IonButton>

          <div className="mp-auth-divider" aria-hidden="true" />

          <div className="mp-auth-footer">
            <IonText className="mp-auth-muted">Don't have an account yet?</IonText>
            <IonButton fill="clear" onClick={() => history.push("/register")}>Create account</IonButton>

            <IonText className="mp-auth-muted">Forgot your password?</IonText>
            <IonButton fill="clear" onClick={() => history.push("/reset-password")}>Reset it</IonButton>
          </div>
        </div>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast(s => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={3000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;