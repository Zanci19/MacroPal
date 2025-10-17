import React, { useEffect, useState } from "react";
import {IonPage, IonContent, IonInput, IonButton, IonHeader, IonTitle, IonToolbar, IonText, IonItem} from "@ionic/react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useHistory } from "react-router";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        history.push("/home");
      }
    });
    return unsubscribe;
  }, [history]);

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      alert(error.message);
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
          <IonInput placeholder="Email" type="email" onIonChange={(e) => setEmail(e.detail.value!)}/>
        </IonItem>

        <IonItem>
          <IonInput placeholder="Password" type="password" onIonChange={(e) => setPassword(e.detail.value!)}/>
        </IonItem>

        <IonButton expand="full" onClick={handleLogin}>Login</IonButton>

        <IonText className="ion-text-center" color="medium"><p>Don't have an account?</p></IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/register")}>Create Account</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Login;
