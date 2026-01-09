import React, { useEffect, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useHistory } from "react-router";
import { auth, db, trackEvent } from "../../firebase";

type MacroTargets = {
  proteinG: number;
  fatG: number;
  carbsG: number;
};

type ProfileData = {
  caloriesTarget?: number;
  macroTargets?: MacroTargets;
};

const toNumOrNull = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const EnergyNeeds: React.FC = () => {
  const history = useHistory();
  const [caloriesTarget, setCaloriesTarget] = useState<number | null>(null);
  const [carbsTarget, setCarbsTarget] = useState<number | null>(null);
  const [proteinTarget, setProteinTarget] = useState<number | null>(null);
  const [fatTarget, setFatTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({
    show: false,
    message: "",
    color: "success",
  });

  useEffect(() => {
    const current = auth.currentUser;
    if (!current) return;

    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "users", current.uid));
        const data = snap.data() as { profile?: ProfileData } | undefined;
        const profile = data?.profile;

        if (profile?.caloriesTarget) {
          setCaloriesTarget(profile.caloriesTarget);
        }
        if (profile?.macroTargets) {
          setCarbsTarget(profile.macroTargets.carbsG);
          setProteinTarget(profile.macroTargets.proteinG);
          setFatTarget(profile.macroTargets.fatG);
        }
      } catch (err) {
        console.error("Failed to load energy needs:", err);
        setToast({
          show: true,
          message: "Could not load energy needs.",
          color: "danger",
        });
      }
    };

    load();
  }, []);

  const showToast = (
    message: string,
    color: "success" | "danger" | "warning" = "danger"
  ) => setToast({ show: true, message, color });

  const handleSave = async () => {
    const current = auth.currentUser;
    if (!current) {
      showToast("You must be logged in.");
      return;
    }

    if (
      caloriesTarget === null ||
      carbsTarget === null ||
      proteinTarget === null ||
      fatTarget === null
    ) {
      showToast("Please fill in all target values.", "warning");
      return;
    }

    if (
      caloriesTarget <= 0 ||
      carbsTarget <= 0 ||
      proteinTarget <= 0 ||
      fatTarget <= 0
    ) {
      showToast("Targets must be greater than zero.", "warning");
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", current.uid), {
        "profile.caloriesTarget": caloriesTarget,
        "profile.macroTargets": {
          carbsG: carbsTarget,
          proteinG: proteinTarget,
          fatG: fatTarget,
        },
      });

      trackEvent("energy_needs_saved", {
        uid: current.uid,
        caloriesTarget,
        carbsTarget,
        proteinTarget,
        fatTarget,
      });

      showToast("Energy needs updated.", "success");
      history.push("/app/settings");
    } catch (err: any) {
      console.error("Failed to save energy needs:", err);
      trackEvent("energy_needs_save_error", {
        uid: current.uid,
        message: err?.message || "Unknown error",
      });
      showToast("Could not save energy needs.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Change energy needs</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonItem lines="full">
          <IonLabel position="stacked">Recommended calories</IonLabel>
          <IonInput
            type="number"
            inputMode="numeric"
            value={caloriesTarget ?? ""}
            onIonChange={(e) =>
              setCaloriesTarget(toNumOrNull(e.detail.value))
            }
          />
        </IonItem>

        <IonItem lines="full">
          <IonLabel position="stacked">Carbohydrates (g)</IonLabel>
          <IonInput
            type="number"
            inputMode="numeric"
            value={carbsTarget ?? ""}
            onIonChange={(e) => setCarbsTarget(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem lines="full">
          <IonLabel position="stacked">Protein (g)</IonLabel>
          <IonInput
            type="number"
            inputMode="numeric"
            value={proteinTarget ?? ""}
            onIonChange={(e) => setProteinTarget(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonItem lines="full">
          <IonLabel position="stacked">Fat (g)</IonLabel>
          <IonInput
            type="number"
            inputMode="numeric"
            value={fatTarget ?? ""}
            onIonChange={(e) => setFatTarget(toNumOrNull(e.detail.value))}
          />
        </IonItem>

        <IonButton
          expand="block"
          className="ion-margin-top"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save energy needs"}
        </IonButton>

        <IonToast
          isOpen={toast.show}
          onDidDismiss={() => setToast((prev) => ({ ...prev, show: false }))}
          message={toast.message}
          color={toast.color}
          duration={2500}
        />
      </IonContent>
    </IonPage>
  );
};

export default EnergyNeeds;
