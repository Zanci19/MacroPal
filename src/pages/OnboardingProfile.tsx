import React, { useEffect, useMemo, useState } from "react";
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { chevronDownOutline, chevronUpOutline } from "ionicons/icons";
import { auth, db, trackEvent } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useHistory } from "react-router";
import "./OnboardingProfile.css";
import {
  DEFAULT_UNIT_SYSTEM,
  fromMetricHeight,
  fromMetricWeight,
  getUnitSystem,
  heightLabel,
  toMetricHeight,
  toMetricWeight,
  UnitSystem,
  weightLabel,
} from "../utils/units";

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
  units?: UnitSystem;
};

const toNumOrNull = (v: any) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  const bmr =
    gender === "male"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const mult =
    activity === "light"
      ? 1.375
      : activity === "moderate"
      ? 1.55
      : activity === "very"
      ? 1.725
      : activity === "extra"
      ? 1.9
      : 1.2;

  let daily = bmr * mult;
  if (goal === "lose") daily -= 500;
  else if (goal === "gain") daily += 500;

  const calories = Math.max(800, Math.round(daily));

  const proteinG = Math.round(1.8 * weight);
  const proteinK = proteinG * 4;

  const fatByWeight = 0.8 * weight;
  const fatByPercent = (0.25 * calories) / 9;
  const fatG = Math.round(Math.max(50, fatByWeight, fatByPercent));
  const fatK = fatG * 9;

  const carbsG = Math.round(Math.max(0, calories - proteinK - fatK) / 4);

  return { calories, proteinG, fatG, carbsG };
};

const DEFAULTS = {
  age: 25,
  weight: 70,
  height: 170,
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const OnboardingProfile: React.FC = () => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [activity, setActivity] = useState<Activity>("sedentary");
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
    show: false,
    message: "",
    color: "success",
  });

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

        trackEvent("onboarding_profile_load", {
          has_profile: !!p,
        });

        if (!p) return;

        setAge(p.age ?? null);
        const resolvedUnits = getUnitSystem(p.units);
        setUnitSystem(resolvedUnits);
        setWeight(
          typeof p.weight === "number"
            ? Math.round(fromMetricWeight(p.weight, resolvedUnits) * 10) / 10
            : null
        );
        setHeight(
          typeof p.height === "number"
            ? Math.round(fromMetricHeight(p.height, resolvedUnits))
            : null
        );
        setGoal((p.goal as Goal) || "maintain");
        setGender((p.gender as Gender) || null);
        setActivity((p.activity as Activity) || "sedentary");
      } catch (e) {
        console.error("Error loading profile:", e);
        trackEvent("onboarding_profile_load_error", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };

    load();
  }, []);

  const steps = useMemo(
    () => ["gender", "age", "weight", "height", "goal", "activity"],
    []
  );

  const weightDefaults =
    unitSystem === "imperial"
      ? Math.round(fromMetricWeight(DEFAULTS.weight, unitSystem))
      : DEFAULTS.weight;
  const heightDefaults =
    unitSystem === "imperial"
      ? Math.round(fromMetricHeight(DEFAULTS.height, unitSystem))
      : DEFAULTS.height;
  const weightMin = unitSystem === "imperial" ? 45 : 20;
  const weightMax = unitSystem === "imperial" ? 660 : 300;
  const heightMin = unitSystem === "imperial" ? 48 : 80;
  const heightMax = unitSystem === "imperial" ? 90 : 230;

  const isLastStep = step === steps.length - 1;

  const canProceed = useMemo(() => {
    const current = steps[step];
    if (current === "gender") return !!gender;
    if (current === "age") return !!age && age > 0;
    if (current === "weight") return !!weight && weight > 0;
    if (current === "height") return !!height && height > 0;
    return true;
  }, [steps, step, gender, age, weight, height]);

  const adjustNumber = (
    value: number | null,
    delta: number,
    min: number,
    max: number,
    fallback: number
  ) => {
    const base = value ?? fallback;
    return clampNumber(base + delta, min, max);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      showToast("You must be logged in to save your profile.");
      return;
    }

    if (!gender) {
      showToast("Please select your gender.", "warning");
      return;
    }
    if (!age || age <= 0) {
      showToast("Please enter a valid age.", "warning");
      return;
    }
    if (!weight || weight <= 0) {
      showToast(
        `Please enter your weight in ${weightLabel(unitSystem)}.`,
        "warning"
      );
      return;
    }
    if (!height || height <= 0) {
      showToast(
        `Please enter your height in ${heightLabel(unitSystem)}.`,
        "warning"
      );
      return;
    }

    setLoading(true);

    try {
      const userRef = doc(db, "users", user.uid);
      const weightMetric = toMetricWeight(weight, unitSystem);
      const heightMetric = toMetricHeight(height, unitSystem);
      const targets = computeTargets(
        age,
        weightMetric,
        heightMetric,
        gender,
        goal,
        activity
      );

      if (targets) {
        trackEvent("onboarding_targets_computed", {
          uid: user.uid,
          calories: targets.calories,
          proteinG: targets.proteinG,
          fatG: targets.fatG,
          carbsG: targets.carbsG,
          goal,
          activity,
        });
      }

      await setDoc(
        userRef,
        {
          profile: {
            age,
            weight: weightMetric,
            height: heightMetric,
            goal,
            gender,
            activity,
            units: unitSystem,
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

      trackEvent("onboarding_profile_saved", {
        uid: user.uid,
        goal,
        activity,
        gender,
      });

      showToast("Profile saved. Welcome!", "success");
      history.push("/app/home");
    } catch (error: any) {
      console.error(error);
      trackEvent("onboarding_profile_save_error", {
        uid: auth.currentUser?.uid || null,
        message: error?.message || "Unknown error",
      });
      showToast(
        "Error saving profile: " + (error?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!canProceed) {
      showToast("Please fill this in before continuing.", "warning");
      return;
    }

    if (isLastStep) {
      void handleSave();
      return;
    }

    setDirection("forward");
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setDirection("back");
    setStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Let’s get to know you</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="onboarding-profile-page" fullscreen>
        <div className="onboarding-card">
          <div
            key={step}
            className={`onboarding-step-card onboarding-${direction}`}
          >
            {steps[step] === "gender" && (
              <div className="onboarding-step">
              <p className="onboarding-intro">
                We’ll need to ask you some questions before you can proceed.
              </p>
              <h1 className="onboarding-title">What’s your gender?</h1>
              <div className="onboarding-choice-row">
                <IonButton
                  fill={gender === "male" ? "solid" : "outline"}
                  onClick={() => setGender("male")}
                >
                  Male
                </IonButton>
                <IonButton
                  fill={gender === "female" ? "solid" : "outline"}
                  onClick={() => setGender("female")}
                >
                  Female
                </IonButton>
              </div>
              </div>
            )}

            {steps[step] === "age" && (
              <div className="onboarding-step">
              <h1 className="onboarding-title">How old are you?</h1>
              <div className="onboarding-number-wrapper">
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setAge(
                      adjustNumber(age, 1, 1, 120, DEFAULTS.age)
                    )
                  }
                >
                  <IonIcon icon={chevronUpOutline} />
                </IonButton>
                <IonInput
                  className="onboarding-number-input"
                  type="number"
                  inputMode="numeric"
                  value={age ?? ""}
                  onIonChange={(e) => setAge(toNumOrNull(e.detail.value))}
                />
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setAge(
                      adjustNumber(age, -1, 1, 120, DEFAULTS.age)
                    )
                  }
                >
                  <IonIcon icon={chevronDownOutline} />
                </IonButton>
              </div>
              <p className="onboarding-helper">
                We need this to calculate your daily calorie needs.
              </p>
              </div>
            )}

            {steps[step] === "weight" && (
              <div className="onboarding-step">
              <h1 className="onboarding-title">What’s your weight?</h1>
              <div className="onboarding-number-wrapper">
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setWeight(
                      adjustNumber(weight, 1, weightMin, weightMax, weightDefaults)
                    )
                  }
                >
                  <IonIcon icon={chevronUpOutline} />
                </IonButton>
                <IonInput
                  className="onboarding-number-input"
                  type="number"
                  inputMode="decimal"
                  value={weight ?? ""}
                  onIonChange={(e) => setWeight(toNumOrNull(e.detail.value))}
                />
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setWeight(
                      adjustNumber(weight, -1, weightMin, weightMax, weightDefaults)
                    )
                  }
                >
                  <IonIcon icon={chevronDownOutline} />
                </IonButton>
              </div>
              <p className="onboarding-helper">
                In {weightLabel(unitSystem)}.
              </p>
              </div>
            )}

            {steps[step] === "height" && (
              <div className="onboarding-step">
              <h1 className="onboarding-title">How tall are you?</h1>
              <div className="onboarding-number-wrapper">
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setHeight(
                      adjustNumber(height, 1, heightMin, heightMax, heightDefaults)
                    )
                  }
                >
                  <IonIcon icon={chevronUpOutline} />
                </IonButton>
                <IonInput
                  className="onboarding-number-input"
                  type="number"
                  inputMode="numeric"
                  value={height ?? ""}
                  onIonChange={(e) => setHeight(toNumOrNull(e.detail.value))}
                />
                <IonButton
                  fill="clear"
                  className="onboarding-step-button"
                  onClick={() =>
                    setHeight(
                      adjustNumber(height, -1, heightMin, heightMax, heightDefaults)
                    )
                  }
                >
                  <IonIcon icon={chevronDownOutline} />
                </IonButton>
              </div>
              <p className="onboarding-helper">
                In {heightLabel(unitSystem)}.
              </p>
              </div>
            )}

            {steps[step] === "goal" && (
              <div className="onboarding-step">
              <h1 className="onboarding-title">What is your goal?</h1>
              <div className="onboarding-choice-row">
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
              </div>
            )}

            {steps[step] === "activity" && (
              <div className="onboarding-step">
              <h1 className="onboarding-title">What’s your activity level?</h1>
              <IonItem lines="full" className="onboarding-select">
                <IonLabel position="stacked">Activity level</IonLabel>
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
              </div>
            )}
          </div>

          <div className="onboarding-actions">
            <IonButton
              fill="clear"
              className="onboarding-back"
              onClick={handleBack}
              disabled={step === 0}
            >
              Back
            </IonButton>
            <IonButton
              className="onboarding-next"
              onClick={handleNext}
              disabled={loading}
            >
              {isLastStep ? (loading ? "Saving…" : "Finish") : "Next"}
            </IonButton>
          </div>
        </div>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((s) => ({ ...s, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={2400}
        />
      </IonContent>
    </IonPage>
  );
};

export default OnboardingProfile;
