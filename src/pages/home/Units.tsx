import React, { useEffect, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useHistory } from "react-router";
import { auth, db, trackEvent } from "../../firebase";
import { DEFAULT_UNIT_SYSTEM, getUnitSystem, UnitSystem } from "../../utils/units";

type ProfileData = {
  units?: UnitSystem;
};

const Units: React.FC = () => {
  const history = useHistory();
  const [units, setUnits] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
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
        setUnits(getUnitSystem(profile?.units));
      } catch (err) {
        console.error("Failed to load units:", err);
        setToast({
          show: true,
          message: "Could not load units.",
          color: "danger",
        });
      }
    };

    load();
  }, []);

  const handleSave = async () => {
    console.log('[USER ACTION] Units: Save button clicked', { units });
    const current = auth.currentUser;
    if (!current) {
      setToast({ show: true, message: "You must be logged in." });
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", current.uid), {
        "profile.units": units,
      });
      trackEvent("units_saved", { uid: current.uid, units });
      setToast({ show: true, message: "Units updated.", color: "success" });
      history.push("/app/settings");
    } catch (err: any) {
      console.error("Failed to save units:", err);
      trackEvent("units_save_error", {
        uid: current.uid,
        message: err?.message || "Unknown error",
      });
      setToast({ show: true, message: "Could not save units." });
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
          <IonTitle>Units & measurements</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem lines="full">
          <IonLabel position="stacked">Unit system</IonLabel>
          <IonSegment
            value={units}
            onIonChange={(e) => {
              console.log('[USER ACTION] Units: Unit system changed', { value: e.detail.value });
              setUnits(getUnitSystem(e.detail.value as UnitSystem));
            }}
          >
            <IonSegmentButton value="metric">
              <IonLabel>Metric (kg, cm)</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="imperial">
              <IonLabel>Imperial (lb, in)</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonItem>

        <IonButton
          expand="block"
          className="ion-margin-top"
          onClick={() => {
            console.log('[USER ACTION] Units: Save units button clicked');
            handleSave();
          }}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save units"}
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

export default Units;
