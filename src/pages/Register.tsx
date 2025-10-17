import React, { useState } from "react";
import { IonPage, IonContent, IonInput, IonButton, IonHeader, IonTitle, IonToolbar, IonText, IonItem } from "@ionic/react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "../firebase";
import { useHistory } from "react-router";
import { doc, setDoc } from "firebase/firestore";

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const history = useHistory();

  const handleRegister = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: name,
        email: email
      });

      alert("Account created successfully!");
      history.push("/login");
    } catch (error: any) {
      alert(error.message);
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
          <IonInput placeholder="Name" onIonChange={(e) => setName(e.detail.value!)} />
        </IonItem>
        <IonItem>
          <IonInput placeholder="Email" type="email" onIonChange={(e) => setEmail(e.detail.value!)} />
        </IonItem>
        <IonItem>
          <IonInput placeholder="Password" type="password" onIonChange={(e) => setPassword(e.detail.value!)} />
        </IonItem>

        <IonButton expand="full" onClick={handleRegister}>Sign Up</IonButton>

        <IonText className="ion-text-center" color="medium">
          <p>Already have an account?</p>
        </IonText>
        <IonButton fill="clear" expand="block" onClick={() => history.push("/login")}>Log In</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Register;
