import React, { useState } from "react";
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonInput, IonButton, IonItem, IonLabel, IonSelect, IonSelectOption } from "@ionic/react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useHistory } from "react-router";

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<"sedentary" | "light" | "moderate" | "very" | "extra">("sedentary");
  const history = useHistory();

  const handleSave = async () => {
    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        age,
        weight,
        height,
        goal,
        gender,
        activity
      });
      history.push("/app/home");
    } catch (error: any) {
      alert("Error saving profile: " + error.message);
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
          <IonInput type="number" onIonChange={e => setAge(Number(e.detail.value))} />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Weight (kg)</IonLabel>
          <IonInput type="number" onIonChange={e => setWeight(Number(e.detail.value))} />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Height (cm)</IonLabel>
          <IonInput type="number" onIonChange={e => setHeight(Number(e.detail.value))} />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Gender</IonLabel>
          <IonSelect value={gender} onIonChange={e => setGender(e.detail.value)}>
            <IonSelectOption value="male">Male</IonSelectOption>
            <IonSelectOption value="female">Female</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Goal</IonLabel>
          <IonButton fill={goal === "lose" ? "solid" : "outline"} onClick={() => setGoal("lose")}>Lose</IonButton>
          <IonButton fill={goal === "maintain" ? "solid" : "outline"} onClick={() => setGoal("maintain")}>Maintain</IonButton>
          <IonButton fill={goal === "gain" ? "solid" : "outline"} onClick={() => setGoal("gain")}>Gain</IonButton>
        </IonItem>

        <IonItem>
            <IonLabel position="stacked">Activity Level</IonLabel>
            <IonSelect value={activity} onIonChange={e => setActivity(e.detail.value)}>
                <IonSelectOption value="sedentary">Sedentary (little/no exercise)</IonSelectOption>
                <IonSelectOption value="light">Lightly active (1–3 days/week)</IonSelectOption>
                <IonSelectOption value="moderate">Moderately active (3–5 days/week)</IonSelectOption>
                <IonSelectOption value="very">Very active (6–7 days/week)</IonSelectOption>
                <IonSelectOption value="extra">Extra active (very hard exercise/job)</IonSelectOption>
            </IonSelect>
        </IonItem>
        <IonButton expand="full" onClick={handleSave}>Save Profile</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default SetupProfile;
