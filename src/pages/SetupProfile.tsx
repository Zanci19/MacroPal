import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonToast,
} from "@ionic/react";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useHistory } from "react-router";

const toNumOrNull = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<
    "sedentary" | "light" | "moderate" | "very" | "extra"
  >("sedentary");
  const [toast, setToast] = useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: "",
    color: "success",
  });

  const history = useHistory();

  const showToast = (message: string, color: "success" | "danger" | "warning" = "danger") =>
    setToast({ show: true, message, color });

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in.");
      return;
    }

    try {
      const userRef = doc(db, "users", user.uid);

      // Upsert profile (create if missing, update if exists)
      await setDoc(
        userRef,
        {
          profile: {
            age,
            weight,
            height,
            goal,
            gender,
            activity,
            updatedAt: serverTimestamp(),
          },
          // Helpful base fields in case the doc didn’t exist yet:
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          createdAt: serverTimestamp(), // set once; merge won’t overwrite existing value
        },
        { merge: true }
      );

      showToast("Profile saved.", "success");
      history.push("/app/home");
    } catch (error: any) {
      showToast("Error saving profile: " + (error?.message || "Unknown error"));
      console.error(error);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Setup Profile</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Age</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            onIonChange={(e) => setAge(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Weight (kg)</IonLabel>
          <IonInput
            type="number"
            inputmode="decimal"
            onIonChange={(e) => setWeight(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Height (cm)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            onIonChange={(e) => setHeight(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Gender</IonLabel>
          <IonSelect value={gender} onIonChange={(e) => setGender(e.detail.value)}>
            <IonSelectOption value="male">Male</IonSelectOption>
            <IonSelectOption value="female">Female</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Goal</IonLabel>
          <div className="ion-margin-top" style={{ display: "flex", gap: 8 }}>
            <IonButton
              fill={goal === "lose" ? "solid" : "outline"}
              onClick={() => setGoal("lose")}
            >
              Lose
            </IonButton>
            <IonButton
              fill={goal === "maintain" ? "solid" : "outline"}
              onClick={() => setGoal("maintain")}
            >
              Maintain
            </IonButton>
            <IonButton
              fill={goal === "gain" ? "solid" : "outline"}
              onClick={() => setGoal("gain")}
            >
              Gain
            </IonButton>
          </div>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Activity Level</IonLabel>
          <IonSelect value={activity} onIonChange={(e) => setActivity(e.detail.value)}>
            <IonSelectOption value="sedentary">Sedentary (little/no exercise)</IonSelectOption>
            <IonSelectOption value="light">Lightly active (1–3 days/week)</IonSelectOption>
            <IonSelectOption value="moderate">Moderately active (3–5 days/week)</IonSelectOption>
            <IonSelectOption value="very">Very active (6–7 days/week)</IonSelectOption>
            <IonSelectOption value="extra">Extra active (very hard exercise/job)</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonButton expand="full" className="ion-margin-top" onClick={handleSave}>
          Save Profile
        </IonButton>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((s) => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={2500}
        />
      </IonContent>
    </IonPage>
  );
};

export default SetupProfile;
