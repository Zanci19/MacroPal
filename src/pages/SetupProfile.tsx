import React, { useEffect, useState } from "react";
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
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useHistory } from "react-router";

const toNumOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Activity =
  | "sedentary"
  | "light"
  | "moderate"
  | "very"
  | "extra";

type Goal = "lose" | "maintain" | "gain";
type Gender = "male" | "female";

type ProfileData = {
  age: number | null;
  weight: number | null;
  height: number | null;
  goal: Goal;
  gender: Gender;
  activity: Activity;
};

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [gender, setGender] = useState<Gender>("male");
  const [activity, setActivity] = useState<Activity>("sedentary");

  const [toast, setToast] = useState<{ show: boolean; message: string; color?: string }>({
    show: false,
    message: "",
    color: "success",
  });

  const [loading, setLoading] = useState(false);

  const history = useHistory();

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger"
  ) => setToast({ show: true, message, color });

  // OPTIONAL but important: prefill from existing profile so you don't overwrite with nulls
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const load = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { profile?: ProfileData } | undefined;
        const p = data?.profile;
        if (!p) return;

        setAge(p.age ?? null);
        setWeight(p.weight ?? null);
        setHeight(p.height ?? null);
        setGoal((p.goal as Goal) || "maintain");
        setGender((p.gender as Gender) || "male");
        setActivity((p.activity as Activity) || "sedentary");
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in.");
      return;
    }

    // Strong validation: must have numbers
    if (age === null || age <= 0) {
      showToast("Please enter a valid age.", "warning");
      return;
    }
    if (weight === null || weight <= 0) {
      showToast("Please enter your weight in kg.", "warning");
      return;
    }
    if (height === null || height <= 0) {
      showToast("Please enter your height in cm.", "warning");
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, "users", user.uid);

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
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      showToast("Profile saved.", "success");
      history.push("/app/home");
    } catch (error: any) {
      showToast("Error saving profile: " + (error?.message || "Unknown error"));
      console.error(error);
    } finally {
      setLoading(false);
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
            inputMode="numeric"
            value={age ?? ""}
            onIonChange={(e) => setAge(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Weight (kg)</IonLabel>
          <IonInput
            type="number"
            inputMode="decimal"
            value={weight ?? ""}
            onIonChange={(e) => setWeight(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Height (cm)</IonLabel>
          <IonInput
            type="number"
            inputMode="numeric"
            value={height ?? ""}
            onIonChange={(e) => setHeight(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Gender</IonLabel>
          <IonSelect
            value={gender}
            onIonChange={(e) => setGender(e.detail.value as Gender)}
          >
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
          <IonSelect
            value={activity}
            onIonChange={(e) => setActivity(e.detail.value as Activity)}
          >
            <IonSelectOption value="sedentary">
              Sedentary (little/no exercise)
            </IonSelectOption>
            <IonSelectOption value="light">
              Lightly active (1–3 days/week)
            </IonSelectOption>
            <IonSelectOption value="moderate">
              Moderately active (3–5 days/week)
            </IonSelectOption>
            <IonSelectOption value="very">
              Very active (6–7 days/week)
            </IonSelectOption>
            <IonSelectOption value="extra">
              Extra active (very hard exercise/job)
            </IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonButton
          expand="full"
          className="ion-margin-top"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Profile"}
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
