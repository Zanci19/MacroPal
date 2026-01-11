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
import { Capacitor, registerPlugin } from "@capacitor/core";
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

const REMINDER_IDS = {
  meals: 4101,
  weighIn: 4102,
  workout: 4103,
};

type LocalNotificationSchedule = {
  on: { hour: number; minute: number };
  repeats?: boolean;
  allowWhileIdle?: boolean;
};

type LocalNotificationRequest = {
  id: number;
  title: string;
  body: string;
  schedule?: LocalNotificationSchedule;
};

type LocalNotificationsPlugin = {
  checkPermissions(): Promise<{ display: string }>;
  requestPermissions(): Promise<{ display: string }>;
  schedule(options: { notifications: LocalNotificationRequest[] }): Promise<void>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
};

const LocalNotifications = registerPlugin<LocalNotificationsPlugin>("LocalNotifications");

const normalizeTime = (value: string | string[] | null | undefined) => {
  if (!value) return "";
  // Handle string array from IonDatetime
  const stringValue = Array.isArray(value) ? value[0] : value;
  if (!stringValue) return "";
  if (stringValue.includes("T")) {
    const time = stringValue.split("T")[1];
    return time ? time.slice(0, 5) : "";
  }
  return stringValue.slice(0, 5);
};

const parseTime = (value: string) => {
  const [hour, minute] = value.split(":").map((entry) => Number(entry));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return { hour, minute };
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

  const ensureNotificationPermission = async () => {
    if (!Capacitor.isNativePlatform()) return false;
    const current = await LocalNotifications.checkPermissions();
    if (current.display === "granted") return true;
    const requested = await LocalNotifications.requestPermissions();
    return requested.display === "granted";
  };

  const scheduleReminder = async (
    id: number,
    title: string,
    body: string,
    time: string,
    enabled: boolean
  ) => {
    if (!Capacitor.isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    if (!enabled) return;

    const parsed = parseTime(time);
    if (!parsed) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: {
            on: { hour: parsed.hour, minute: parsed.minute },
            repeats: true,
            allowWhileIdle: true,
          },
        },
      ],
    });
  };

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
      const needsPermission = mealEnabled || weighInEnabled || workoutEnabled;
      if (needsPermission) {
        const granted = await ensureNotificationPermission();
        if (!granted) {
          setToast({
            show: true,
            message: "Enable notifications to receive reminders.",
            color: "warning",
          });
          setSaving(false);
          return;
        }
      }

      if (Capacitor.isNativePlatform()) {
        await scheduleReminder(
          REMINDER_IDS.meals,
          "MacroPal meal reminder",
          "Time to log your meal.",
          mealTime,
          mealEnabled
        );
        await scheduleReminder(
          REMINDER_IDS.weighIn,
          "MacroPal weigh-in reminder",
          "Log your weigh-in to track progress.",
          weighInTime,
          weighInEnabled
        );
        await scheduleReminder(
          REMINDER_IDS.workout,
          "MacroPal workout reminder",
          "Log your workout when you're done.",
          workoutTime,
          workoutEnabled
        );
      } else if (needsPermission) {
        setToast({
          show: true,
          message: "Reminders will appear when running on a device.",
          color: "warning",
        });
      }

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
