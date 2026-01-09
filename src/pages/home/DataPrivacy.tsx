import React, { useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonPage,
  IonTitle,
  IonToolbar,
  IonToast,
} from "@ionic/react";
import { analyticsOutline, shieldCheckmarkOutline, trashOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { shareOrDownload } from "../../utils/exportUtils";

const DataPrivacy: React.FC = () => {
  const history = useHistory();
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; color?: string }>({
    open: false,
    message: "",
    color: "success",
  });

  const exportFullData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setToast({ open: true, message: "Please log in first.", color: "warning" });
      return;
    }

    if (exporting) return;
    setExporting(true);

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const profile = userSnap.data() || {};

      const fetchCollection = async (name: string) => {
        const snap = await getDocs(collection(db, "users", user.uid, name));
        return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      };

      const [foods, weighins, workouts, plans, favorites, recentFoods, mealPresets] =
        await Promise.all([
          fetchCollection("foods"),
          fetchCollection("weighins"),
          fetchCollection("workouts"),
          fetchCollection("plans"),
          fetchCollection("favorites"),
          fetchCollection("recentFoods"),
          fetchCollection("mealPresets"),
        ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email,
        },
        profile,
        foods,
        weighins,
        workouts,
        plans,
        favorites,
        recentFoods,
        mealPresets,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const fileName = `macropal_full_export_${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([blob], fileName, { type: "application/json" });
      await shareOrDownload(file, fileName);

      setToast({ open: true, message: "Export ready." });
    } catch (err) {
      console.error("Failed to export data:", err);
      setToast({
        open: true,
        message: "Could not export data. Please try again.",
        color: "danger",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Data & Privacy</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem lines="full">
          <IonIcon slot="start" icon={analyticsOutline} />
          <IonLabel>
            <h2>Export your analytics</h2>
            <p>Export your analytics summary in PDF, JSON, or CSV.</p>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          className="ion-margin-bottom"
          onClick={() => history.push("/app/analytics")}
        >
          Open Analytics exports
        </IonButton>

        <IonItem lines="full">
          <IonIcon slot="start" icon={trashOutline} />
          <IonLabel>
            <h2>Delete your account</h2>
            <p>Remove your account and all stored data permanently.</p>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          color="danger"
          className="ion-margin-bottom"
          onClick={() => history.push("/app/settings")}
        >
          Go to account deletion
        </IonButton>

        <IonItem lines="full">
          <IonIcon slot="start" icon={analyticsOutline} />
          <IonLabel>
            <h2>Export all your data</h2>
            <p>Download a JSON backup of your foods, plans, workouts, and weigh-ins.</p>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          className="ion-margin-bottom"
          onClick={exportFullData}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "Export full data"}
        </IonButton>

        <IonItem lines="none">
          <IonIcon slot="start" icon={shieldCheckmarkOutline} />
          <IonLabel>
            <h2>Privacy</h2>
            <p>
              Your data stays tied to your MacroPal account and is only visible to
              you.
            </p>
          </IonLabel>
        </IonItem>
        <IonToast
          isOpen={toast.open}
          onDidDismiss={() => setToast((prev) => ({ ...prev, open: false }))}
          message={toast.message}
          color={toast.color}
          duration={2500}
        />
      </IonContent>
    </IonPage>
  );
};

export default DataPrivacy;
