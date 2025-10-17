import React, { useEffect } from "react";
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton } from "@ionic/react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useHistory } from "react-router";

const Home: React.FC = () => {
  const history = useHistory();

  // If user logs out or isn’t logged in, redirect to login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        history.push("/login");
      }
    });
    return unsubscribe;
  }, [history]);

  // Log out function
  const handleLogout = async () => {
    try {
      await signOut(auth);
      history.push("/login"); // redirect after logout
    } catch (error: any) {
      alert("Error logging out: " + error.message);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Home</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding ion-text-center">
        <h2>Welcome back 👋</h2>
        <p>You are logged in as: <strong>{auth.currentUser?.email}</strong></p>

        <IonButton expand="full" color="danger" onClick={handleLogout}>
          Log Out
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Home;
