import { useEffect, useState } from 'react'
import { IonContent, IonSpinner } from "@ionic/react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useHistory } from "react-router";

const CheckLogin: React.FC = () => {
    const history = useHistory();

    useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            history.push("/app/home");
        } else {
            history.push("/start")
        }
    });
    return unsubscribe;
    }, [history]);
    
  return (
    <IonContent className="ion-text-center" fullscreen>
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <IonSpinner/>
      </div>
    </IonContent>
  );
};

export default CheckLogin;
