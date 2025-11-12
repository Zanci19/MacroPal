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
import { doc, setDoc } from "firebase/firestore";
import { useHistory } from "react-router";

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<"sedentary" | "light" | "moderate" | "very" | "extra">("sedentary");

  const [toast, setToast] = useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: "",
    color: "success",
  });

  const history = useHistory();

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      setToast({ show: true, message: "Not signed in.", color: "danger" });
      return;
    }

    try {
      // ✅ Use setDoc with merge so it creates the doc if missing (avoids "No document to update")
      await setDoc(
        doc(db, "users", user.uid),
        {
          age,
          weight,
          height,
          goal,
          gender,
          activity,
          // optional: updatedAt for your own bookkeeping
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setToast({ show: true, message: "Profile saved.", color: "success" });
      history.push("/app/home");
    } catch (error: any) {
      setToast({ show: true, message: `Error saving profile: ${error.message}`, color: "danger" });
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
            placeholder="e.g., 17"
            onIonChange={(e) => setAge(e.detail.value ? Number(e.detail.value) : null)}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Weight (kg)</IonLabel>
          <IonInput
            type="number"
            inputmode="decimal"
            placeholder="e.g., 70"
            onIonChange={(e) => setWeight(e.detail.value ? Number(e.detail.value) : null)}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Height (cm)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            placeholder="e.g., 179"
            onIonChange={(e) => setHeight(e.detail.value ? Number(e.detail.value) : null)}
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
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "8px" }}>
            <IonButton expand="block" fill={goal === "lose" ? "solid" : "outline"} onClick={() => setGoal("lose")}>
              Lose
            </IonButton>
            <IonButton expand="block" fill={goal === "maintain" ? "solid" : "outline"} onClick={() => setGoal("maintain")}>
              Maintain
            </IonButton>
            <IonButton expand="block" fill={goal === "gain" ? "solid" : "outline"} onClick={() => setGoal("gain")}>
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

        <IonButton expand="block" style={{ marginTop: 16 }} onClick={handleSave}>
          Save Profile
        </IonButton>

        <IonToast
          isOpen={toast.show}
          message={toast.message}
          color={toast.color}
          duration={2200}
          onDidDismiss={() => setToast((t) => ({ ...t, show: false }))}
        />
      </IonContent>
    </IonPage>
  );
};

export default SetupProfile;
