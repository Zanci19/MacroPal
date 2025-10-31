import React, { useEffect, useState } from "react";
import { IonPage, IonContent, IonInput, IonButton, IonHeader, IonTitle, IonToolbar, IonText, IonItem, IonToast } from "@ionic/react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../../firebase";
import { useHistory } from "react-router";

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

      <IonContent className="ion-padding">
        <IonItem>
          <IonInput
            placeholder="Email"
            type="email"
            value={email}
            onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')}
          />
        </IonItem>

        <IonItem>
          <IonInput
            placeholder="Password"
            type="password"
            value={password}
            onIonChange={(e: any) => setPassword(e?.detail?.value ?? '')}
          />
        </IonItem>

        <IonButton expand="full" onClick={handleLogin}>Login</IonButton>

        <IonText className="ion-text-center" color="medium"><p>Don't have an account?</p></IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/register")}>Create Account</IonButton>
        <IonText className="ion-text-center" color="medium"><p>Forgot your password?</p></IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/reset-password")}>Reset Password</IonButton>

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