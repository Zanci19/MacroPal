// ...existing code...
import React, { useState } from "react";
import { IonPage, IonContent, IonInput, IonButton, IonHeader, IonTitle, IonToolbar, IonText, IonItem, IonToast } from "@ionic/react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useHistory } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
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

      <IonContent className="ion-padding">
        <IonItem>
          <IonInput placeholder="Name" value={name} onIonChange={(e: any) => setName(e?.detail?.value ?? '')} />
        </IonItem>
        <IonItem>
          <IonInput placeholder="Email" type="email" value={email} onIonChange={(e: any) => setEmail(e?.detail?.value ?? '')} />
        </IonItem>
        <IonItem>
          <IonInput placeholder="Password" type="password" value={password} onIonChange={(e: any) => setPassword(e?.detail?.value ?? '')} />
        </IonItem>

        <IonButton expand="full" onClick={handleRegister}>Sign Up</IonButton>

        <IonText className="ion-text-center" color="medium">
          <p>Already have an account?</p>
        </IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/login")}>Log In</IonButton>

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