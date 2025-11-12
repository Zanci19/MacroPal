// ...existing code...
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
  IonToast
} from "@ionic/react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useHistory } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import "../../styles/forms.css";
// ...existing code...

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();
  const [toast, setToast] = React.useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: '',
    color: 'success'
  });

  const handleRegister = async () => {
    // validate first so we show toast instead of browser alert
    if (!name.trim()) {
      setToast({ show: true, message: 'Please enter your name.', color: 'danger' });
      return;
    }
    if (!email.trim()) {
      setToast({ show: true, message: 'Please enter your email address.', color: 'danger' });
      return;
    }
    if (!password.trim()) {
      setToast({ show: true, message: 'Please enter your password.', color: 'danger' });
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCredential.user, { displayName: name.trim() });

      // Create user document in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name.trim(),
        email: email.trim()
      });

      setToast({ show: true, message: 'Account created. Redirecting...', color: 'success' });

      // navigate after short delay so the toast is visible
      setTimeout(() => history.push("/setup-profile"), 800);
    } catch (error: any) {
      // show firebase error in toast instead of alert
      setToast({ show: true, message: error?.message ?? 'Registration failed.', color: 'danger' });
      console.error(error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Register</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="mp-auth-content">
        <div className="mp-auth-card" role="main">
          <div className="mp-auth-card__logo" aria-hidden="true">MP</div>
          <h1>Create your account</h1>
          <p className="mp-auth-subtitle">Join MacroPal and get personalised goals tailored to your body and ambition.</p>

          <div className="mp-auth-form">
            <IonItem lines="none">
              <IonInput
                labelPlacement="stacked"
                label="Full name"
                placeholder="Jordan Smith"
                value={name}
                onIonChange={(e: any) => setName(e?.detail?.value ?? '')}
              />
            </IonItem>

            <IonItem lines="none">
              <IonInput
                labelPlacement="stacked"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')}
              />
            </IonItem>

            <IonItem lines="none">
              <IonInput
                labelPlacement="stacked"
                label="Password"
                type="password"
                placeholder="Choose a secure password"
                value={password}
                onIonChange={(e: any) => setPassword(e?.detail?.value ?? '')}
              />
            </IonItem>
          </div>

          <IonButton className="mp-auth-button" expand="block" size="large" onClick={handleRegister}>
            Sign up
          </IonButton>

          <div className="mp-auth-footer">
            <IonText className="mp-auth-muted">Already using MacroPal?</IonText>
            <IonButton fill="clear" onClick={() => history.push("/login")}>Log in</IonButton>
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

export default Register;