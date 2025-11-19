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
import { auth, db, trackEvent } from "../firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { useHistory } from "react-router";

const toNumOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

type Activity = "sedentary" | "light" | "moderate" | "very" | "extra";
type Goal = "lose" | "maintain" | "gain";
type Gender = "male" | "female";

type MacroTargets = {
  proteinG: number;
  fatG: number;
  carbsG: number;
};

type ProfileData = {
  age: number | null;
  weight: number | null;
  height: number | null;
  goal: Goal;
  gender: Gender;
  activity: Activity;
  caloriesTarget?: number;
  macroTargets?: MacroTargets;
};

const computeTargets = (
  age: number,
  weight: number,
  height: number,
  gender: Gender,
  goal: Goal,
  activity: Activity
): { calories: number; proteinG: number; fatG: number; carbsG: number } | null => {
  if (!age || !weight || !height) return null;

  // 1) BMR (Mifflin–St Jeor)
  let bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  // 2) Activity factor
  const mult =
    activity === "light"
      ? 1.375
      : activity === "moderate"
        ? 1.55
        : activity === "very"
          ? 1.725
          : activity === "extra"
            ? 1.9
            : 1.2; // sedentary

  let daily = bmr * mult;
  if (goal === "lose") daily -= 500;
  else if (goal === "gain") daily += 500;

  const calories = Math.max(800, Math.round(daily));

  const proteinG = Math.round(1.8 * weight);
  const proteinK = proteinG * 4;

  const fatByWeight = 0.8 * weight;
  const fatByPercent = (0.25 * calories) / 9; // 25% of kcal from fat
  const fatG = Math.round(Math.max(50, fatByWeight, fatByPercent));
  const fatK = fatG * 9;

  // 6) Carbs = whatever is left
  const carbsG = Math.round(Math.max(0, calories - proteinK - fatK) / 4);

  return { calories, proteinG, fatG, carbsG };
};

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [gender, setGender] = useState<Gender>("male");
  const [activity, setActivity] = useState<Activity>("sedentary");

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
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

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const load = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { profile?: ProfileData } | undefined;
        const p = data?.profile;

        trackEvent("profile_load_result", {
          has_profile: !!p,
        });

        if (!p) return;

        setAge(p.age ?? null);
        setWeight(p.weight ?? null);
        setHeight(p.height ?? null);
        setGoal((p.goal as Goal) || "maintain");
        setGender((p.gender as Gender) || "male");
        setActivity((p.activity as Activity) || "sedentary");
      } catch (e) {
        console.error("Error loading profile:", e);
        trackEvent("profile_load_error", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      trackEvent("profile_save_blocked", { reason: "no_user" });
      showToast("You must be logged in.");
      return;
    }

    // Strong validation: must have numbers
    if (age === null || age <= 0) {
      trackEvent("profile_validation_failed", { field: "age" });
      showToast("Please enter a valid age.", "warning");
      return;
    }
    if (weight === null || weight <= 0) {
      trackEvent("profile_validation_failed", { field: "weight" });
      showToast("Please enter your weight in kg.", "warning");
      return;
    }
    if (height === null || height <= 0) {
      trackEvent("profile_validation_failed", { field: "height" });
      showToast("Please enter your height in cm.", "warning");
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, "users", user.uid);

      const targets = computeTargets(age, weight, height, gender, goal, activity);

      if (targets) {
        trackEvent("profile_targets_computed", {
          uid: user.uid,
          calories: targets.calories,
          proteinG: targets.proteinG,
          fatG: targets.fatG,
          carbsG: targets.carbsG,
          goal,
          activity,
        });
      } else {
        trackEvent("profile_targets_not_computed", {
          uid: user.uid,
        });
      }

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
            ...(targets && {
              caloriesTarget: targets.calories,
              macroTargets: {
                proteinG: targets.proteinG,
                fatG: targets.fatG,
                carbsG: targets.carbsG,
              },
            }),
            updatedAt: serverTimestamp(),
          },
          uid: user.uid,
          email: user.email ?? null,
          displayName: user.displayName ?? null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      trackEvent("profile_saved", {
        uid: user.uid,
        goal,
        activity,
        gender,
      });

      showToast("Profile saved.", "success");
      history.push("/app/home");
    } catch (error: any) {
      console.error(error);
      trackEvent("profile_save_error", {
        uid: auth.currentUser?.uid || null,
        message: error?.message || "Unknown error",
      });
      showToast("Error saving profile: " + (error?.message || "Unknown error"));
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
