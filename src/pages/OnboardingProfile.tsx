import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonToast,
} from "@ionic/react";
import { chevronDownOutline, chevronUpOutline } from "ionicons/icons";
import { auth, db, storage, trackEvent } from "../firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useHistory } from "react-router";
import "./OnboardingProfile.css";
import {
  dataUrlToBlob,
  isDataUrl,
  normalizePhotoUrl,
  resizeImageFile,
  sanitizeFileName,
} from "../utils/image";
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

const toNumOrNull = (v: string | number | null | undefined) => {
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

const STEP_SUMMARY: Record<string, string> = {
  gender: "Tell us who you are",
  age: "We use this for calorie estimates",
  weight: "Used to personalize macro targets",
  height: "Improves your daily calorie baseline",
  goal: "Choose your desired outcome",
  activity: "Set your average weekly activity",
  photo: "Optional profile photo",
};

const OnboardingProfile: React.FC = () => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState<number | null>(DEFAULTS.age);
  const [weight, setWeight] = useState<number | null>(DEFAULTS.weight);
  const [height, setHeight] = useState<number | null>(DEFAULTS.height);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
  const [goal, setGoal] = useState<Goal>("maintain");
  const [activity, setActivity] = useState<Activity>("sedentary");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const history = useHistory();
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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

  // Ensure step resets to 0 when component mounts (fixes multi-account setup issue)
  useEffect(() => {
    setStep(0);
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const load = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { profile?: ProfileData } | undefined;
        const p = data?.profile;
        const googlePhoto = normalizePhotoUrl(user.photoURL);

        trackEvent("onboarding_profile_load", {
          has_profile: !!p,
        });

        if (!p) {
          setProfilePhotoUrl(googlePhoto);
          return;
        }

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
        const storedPhoto =
          typeof (p as { photoUrl?: unknown })?.photoUrl === "string"
            ? normalizePhotoUrl((p as { photoUrl?: string }).photoUrl)
            : null;
        // Use stored photo first, then Google profile photo, then null
        const photoToUse = storedPhoto || googlePhoto || null;
        setProfilePhotoUrl(photoToUse);
      } catch (e) {
        console.error("Error loading profile:", e);
        trackEvent("onboarding_profile_load_error", {
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };

    load();
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const steps = useMemo(
    () => ["gender", "age", "weight", "height", "goal", "activity", "photo"],
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
  const currentStep = steps[step] ?? steps[0];
  const stepNumber = step + 1;
  const progressValue = Math.round((stepNumber / steps.length) * 100);
  const currentStepSummary =
    STEP_SUMMARY[currentStep] ?? "Let’s set up your profile.";

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
    console.log('[USER ACTION] OnboardingProfile: Save profile clicked', { gender, age, weight, height, goal, activity, unitSystem });
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

      const timestamp = Date.now();
      let photoToSave: string | null = null;

      if (profilePhotoFile) {
        const resizedBlob = await resizeImageFile(profilePhotoFile);
        const storagePath = `users/${user.uid}/profile-photos/${timestamp}_${sanitizeFileName(
          profilePhotoFile.name
        )}.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, resizedBlob, {
          contentType: resizedBlob.type,
        });
        photoToSave = await getDownloadURL(storageRef);
      } else if (profilePhotoUrl && isDataUrl(profilePhotoUrl)) {
        const blob = await dataUrlToBlob(profilePhotoUrl);
        const storagePath = `users/${user.uid}/profile-photos/${timestamp}_profile-photo.jpg`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, blob, { contentType: blob.type });
        photoToSave = await getDownloadURL(storageRef);
      } else if (profilePhotoUrl) {
        photoToSave = profilePhotoUrl;
      } else if (typeof user.photoURL === "string" && user.photoURL.length > 0) {
        photoToSave = normalizePhotoUrl(user.photoURL);
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
            ...(photoToSave ? { photoUrl: photoToSave } : {}),
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
          hasViewedTutorial: false,
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
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
      trackEvent("onboarding_profile_save_error", {
        uid: auth.currentUser?.uid || null,
        message: err?.message || "Unknown error",
      });
      showToast(
        "Error saving profile: " + (err?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    console.log('[USER ACTION] OnboardingProfile: Next button clicked', { step, currentStepName: steps[step], canProceed });
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

  const handlePhotoChange = (file?: File | null) => {
    console.log('[USER ACTION] OnboardingProfile: Photo file selected', { fileType: file?.type, fileSize: file?.size });
    if (!file) return;
    if (photoPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setPhotoPreviewUrl(preview);
    setProfilePhotoFile(file);
  };

  const handleBack = () => {
    console.log('[USER ACTION] OnboardingProfile: Back button clicked', { step, currentStepName: steps[step] });
    setDirection("back");
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const displayedPhotoUrl = photoPreviewUrl ?? profilePhotoUrl;

  return (
    <IonPage>
      <IonContent className="onboarding-profile-page" fullscreen>
        <div className="onboarding-shell">
          <header className="onboarding-shell-header">
            <p className="onboarding-shell-kicker">Profile setup</p>
            <p className="onboarding-shell-step">
              Step {stepNumber} of {steps.length}
            </p>
          </header>
          <div className="onboarding-progress" aria-hidden="true">
            <span style={{ width: `${progressValue}%` }} />
          </div>
          <p className="onboarding-shell-summary">{currentStepSummary}</p>

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
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Gender selected', { gender: 'male' });
                      setGender("male");
                    }}
                  >
                    Male
                  </IonButton>
                  <IonButton
                    fill={gender === "female" ? "solid" : "outline"}
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Gender selected', { gender: 'female' });
                      setGender("female");
                    }}
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
                    onClick={() => {
                      const newValue = adjustNumber(age, 1, 1, 120, DEFAULTS.age);
                      console.log('[USER ACTION] OnboardingProfile: Age increased', { from: age, to: newValue });
                      setAge(newValue);
                    }}
                  >
                    <IonIcon icon={chevronUpOutline} />
                  </IonButton>
                  <IonInput
                    className="onboarding-number-input"
                    type="number"
                    inputMode="numeric"
                    value={age ?? ""}
                    onIonChange={(e) => {
                      console.log('[USER ACTION] OnboardingProfile: Age input changed', { value: e.detail.value });
                      setAge(toNumOrNull(e.detail.value));
                    }}
                  />
                  <IonButton
                    fill="clear"
                    className="onboarding-step-button"
                    onClick={() => {
                      const newValue = adjustNumber(age, -1, 1, 120, DEFAULTS.age);
                      console.log('[USER ACTION] OnboardingProfile: Age decreased', { from: age, to: newValue });
                      setAge(newValue);
                    }}
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
                    onClick={() => {
                      const newValue = adjustNumber(weight, 1, weightMin, weightMax, weightDefaults);
                      console.log('[USER ACTION] OnboardingProfile: Weight increased', { from: weight, to: newValue, unit: weightLabel(unitSystem) });
                      setWeight(newValue);
                    }}
                  >
                    <IonIcon icon={chevronUpOutline} />
                  </IonButton>
                  <IonInput
                    className="onboarding-number-input"
                    type="number"
                    inputMode="decimal"
                    value={weight ?? ""}
                    onIonChange={(e) => {
                      console.log('[USER ACTION] OnboardingProfile: Weight input changed', { value: e.detail.value, unit: weightLabel(unitSystem) });
                      setWeight(toNumOrNull(e.detail.value));
                    }}
                  />
                  <IonButton
                    fill="clear"
                    className="onboarding-step-button"
                    onClick={() => {
                      const newValue = adjustNumber(weight, -1, weightMin, weightMax, weightDefaults);
                      console.log('[USER ACTION] OnboardingProfile: Weight decreased', { from: weight, to: newValue, unit: weightLabel(unitSystem) });
                      setWeight(newValue);
                    }}
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
                    onClick={() => {
                      const newValue = adjustNumber(height, 1, heightMin, heightMax, heightDefaults);
                      console.log('[USER ACTION] OnboardingProfile: Height increased', { from: height, to: newValue, unit: heightLabel(unitSystem) });
                      setHeight(newValue);
                    }}
                  >
                    <IonIcon icon={chevronUpOutline} />
                  </IonButton>
                  <IonInput
                    className="onboarding-number-input"
                    type="number"
                    inputMode="numeric"
                    value={height ?? ""}
                    onIonChange={(e) => {
                      console.log('[USER ACTION] OnboardingProfile: Height input changed', { value: e.detail.value, unit: heightLabel(unitSystem) });
                      setHeight(toNumOrNull(e.detail.value));
                    }}
                  />
                  <IonButton
                    fill="clear"
                    className="onboarding-step-button"
                    onClick={() => {
                      const newValue = adjustNumber(height, -1, heightMin, heightMax, heightDefaults);
                      console.log('[USER ACTION] OnboardingProfile: Height decreased', { from: height, to: newValue, unit: heightLabel(unitSystem) });
                      setHeight(newValue);
                    }}
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
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Goal selected', { goal: 'lose' });
                      setGoal("lose");
                    }}
                  >
                    Lose
                  </IonButton>
                  <IonButton
                    fill={goal === "maintain" ? "solid" : "outline"}
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Goal selected', { goal: 'maintain' });
                      setGoal("maintain");
                    }}
                  >
                    Maintain
                  </IonButton>
                  <IonButton
                    fill={goal === "gain" ? "solid" : "outline"}
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Goal selected', { goal: 'gain' });
                      setGoal("gain");
                    }}
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
                    onIonChange={(e) => {
                      console.log('[USER ACTION] OnboardingProfile: Activity level changed', { value: e.detail.value });
                      setActivity(e.detail.value as Activity);
                    }}
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

              {steps[step] === "photo" && (
                <div className="onboarding-step">
                  <h1 className="onboarding-title">
                    Would you like to add a profile picture?
                  </h1>
                  <p className="onboarding-helper">
                    Optional. You can always change it later in Settings.
                  </p>
                  <div className="onboarding-photo-wrapper">
                    {displayedPhotoUrl ? (
                      <>
                        <div className="onboarding-photo-preview">
                          <img src={displayedPhotoUrl} alt="Profile preview" />
                        </div>
                        <p className="onboarding-photo-message">
                          There! You look beautiful!
                        </p>
                      </>
                    ) : (
                      <p className="onboarding-helper">No photo selected yet.</p>
                    )}
                  </div>
                  <IonButton
                    className="onboarding-photo-button"
                    onClick={() => {
                      console.log('[USER ACTION] OnboardingProfile: Add/Replace photo button clicked', { hasPhoto: !!displayedPhotoUrl });
                      photoInputRef.current?.click();
                    }}
                  >
                    {displayedPhotoUrl ? "Replace photo" : "Add photo"}
                  </IonButton>
                  {displayedPhotoUrl && (
                    <IonButton
                      fill="clear"
                      className="onboarding-photo-remove"
                      onClick={() => {
                        console.log('[USER ACTION] OnboardingProfile: Remove photo button clicked');
                        if (photoPreviewUrl?.startsWith("blob:")) {
                          URL.revokeObjectURL(photoPreviewUrl);
                        }
                        setPhotoPreviewUrl(null);
                        setProfilePhotoFile(null);
                        setProfilePhotoUrl(null);
                      }}
                    >
                      Remove photo
                    </IonButton>
                  )}
                  <input
                    ref={photoInputRef}
                    className="onboarding-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      console.log('[USER ACTION] OnboardingProfile: Photo file input changed', { hasFile: !!event.target.files?.[0] });
                      handlePhotoChange(event.target.files?.[0] ?? null);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="onboarding-actions">
              <IonButton
                fill="clear"
                className="onboarding-back-button"
                onClick={() => {
                  console.log('[USER ACTION] OnboardingProfile: Back navigation button clicked');
                  handleBack();
                }}
                disabled={step === 0}
              >
                Back
              </IonButton>
              <IonButton
                className="onboarding-next"
                onClick={() => {
                  console.log('[USER ACTION] OnboardingProfile: Next/Finish button clicked (bottom)', { isLastStep, loading });
                  handleNext();
                }}
                disabled={loading}
              >
                {isLastStep ? (loading ? "Saving…" : "Finish") : "Next"}
              </IonButton>
            </div>
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
