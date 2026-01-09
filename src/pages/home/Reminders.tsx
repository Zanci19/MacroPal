import React, { useEffect, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonItem,
  IonLabel,
  IonPage,
  IonToggle,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useHistory } from "react-router";
import { auth, db, trackEvent } from "../../firebase";

type ReminderBlock = {
  enabled: boolean;
  time: string;
};

type RemindersData = {
  meals?: ReminderBlock;
  weighIn?: ReminderBlock;
  workout?: ReminderBlock;
};

const normalizeTime = (value: string | null | undefined) => {
  if (!value) return "";
  if (value.includes("T")) {
    const time = value.split("T")[1];
    return time ? time.slice(0, 5) : "";
  }
  return value.slice(0, 5);
};

const Reminders: React.FC = () => {
  const history = useHistory();
  const [mealEnabled, setMealEnabled] = useState(false);
  const [mealTime, setMealTime] = useState("08:00");
  const [weighInEnabled, setWeighInEnabled] = useState(false);
  const [weighInTime, setWeighInTime] = useState("07:00");
  const [workoutEnabled, setWorkoutEnabled] = useState(false);
  const [workoutTime, setWorkoutTime] = useState("18:00");
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
        const data = snap.data() as { profile?: { reminders?: RemindersData } } | undefined;
        const reminders = data?.profile?.reminders;
        if (reminders?.meals) {
          setMealEnabled(!!reminders.meals.enabled);
          setMealTime(reminders.meals.time || "08:00");
        }
        if (reminders?.weighIn) {
          setWeighInEnabled(!!reminders.weighIn.enabled);
          setWeighInTime(reminders.weighIn.time || "07:00");
        }
        if (reminders?.workout) {
          setWorkoutEnabled(!!reminders.workout.enabled);
          setWorkoutTime(reminders.workout.time || "18:00");
        }
      } catch (err) {
        console.error("Failed to load reminders:", err);
        setToast({
          show: true,
          message: "Could not load reminders.",
          color: "danger",
        });
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    const current = auth.currentUser;
    if (!current) {
      setToast({ show: true, message: "You must be logged in." });
      return;
    }

    setSaving(true);
    const reminders: RemindersData = {
      meals: { enabled: mealEnabled, time: mealTime },
      weighIn: { enabled: weighInEnabled, time: weighInTime },
      workout: { enabled: workoutEnabled, time: workoutTime },
    };

    try {
      await updateDoc(doc(db, "users", current.uid), {
        "profile.reminders": reminders,
      });
      trackEvent("reminders_saved", {
        uid: current.uid,
        reminders,
      });
      setToast({ show: true, message: "Reminders updated.", color: "success" });
      history.push("/app/settings");
    } catch (err: any) {
      console.error("Failed to save reminders:", err);
      trackEvent("reminders_save_error", {
        uid: current.uid,
        message: err?.message || "Unknown error",
      });
      setToast({ show: true, message: "Could not save reminders." });
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
          <IonTitle>Reminders</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem lines="full">
          <IonLabel>Meal reminder</IonLabel>
          <IonToggle
            slot="end"
            checked={mealEnabled}
            onIonChange={(e) => setMealEnabled(e.detail.checked)}
          />
        </IonItem>
        <IonItem lines="full">
          <IonLabel position="stacked">Meal time</IonLabel>
          <IonDatetime
            presentation="time"
            value={mealTime}
            onIonChange={(e) => setMealTime(normalizeTime(e.detail.value))}
          />
        </IonItem>

        <IonItem lines="full">
          <IonLabel>Weigh-in reminder</IonLabel>
          <IonToggle
            slot="end"
            checked={weighInEnabled}
            onIonChange={(e) => setWeighInEnabled(e.detail.checked)}
          />
        </IonItem>
        <IonItem lines="full">
          <IonLabel position="stacked">Weigh-in time</IonLabel>
          <IonDatetime
            presentation="time"
            value={weighInTime}
            onIonChange={(e) => setWeighInTime(normalizeTime(e.detail.value))}
          />
        </IonItem>

        <IonItem lines="full">
          <IonLabel>Workout reminder</IonLabel>
          <IonToggle
            slot="end"
            checked={workoutEnabled}
            onIonChange={(e) => setWorkoutEnabled(e.detail.checked)}
          />
        </IonItem>
        <IonItem lines="full">
          <IonLabel position="stacked">Workout time</IonLabel>
          <IonDatetime
            presentation="time"
            value={workoutTime}
            onIonChange={(e) => setWorkoutTime(normalizeTime(e.detail.value))}
          />
        </IonItem>

        <IonButton
          expand="block"
          className="ion-margin-top"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save reminders"}
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

export default Reminders;
