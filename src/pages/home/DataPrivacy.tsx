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
  IonAlert,
  IonInput,
  IonText,
} from "@ionic/react";
import { analyticsOutline, shieldCheckmarkOutline, trashOutline, warningOutline } from "ionicons/icons";
import { useHistory } from "react-router";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { shareOrDownload } from "../../utils/exportUtils";
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser } from "firebase/auth";

const DataPrivacy: React.FC = () => {
  const history = useHistory();
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; color?: string }>({
    open: false,
    message: "",
    color: "success",
  });
  
  const [showDeleteStep1, setShowDeleteStep1] = useState(false);
  const [showDeleteStep2, setShowDeleteStep2] = useState(false);
  const [password, setPassword] = useState("");
  const [usernameConfirm, setUsernameConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteStep1 = () => {
    setPassword("");
    setUsernameConfirm("");
    setShowDeleteStep1(true);
  };

  const handleDeleteStep2 = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setToast({ open: true, message: "No user logged in.", color: "danger" });
      return;
    }

    // Verify password
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      
      // Password correct, proceed to step 2
      setShowDeleteStep1(false);
      setShowDeleteStep2(true);
    } catch (e: any) {
      setToast({
        open: true,
        message: "Incorrect password. Please try again.",
        color: "danger",
      });
    }
  };

  const handleDeleteFinal = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const expectedUsername = user.displayName || user.email || "DELETE";
    if (usernameConfirm.trim() !== expectedUsername) {
      setToast({
        open: true,
        message: "Username does not match. Please type it exactly as shown.",
        color: "danger",
      });
      return;
    }

    setDeleting(true);
    try {
      await deleteUser(user);
      setToast({ open: true, message: "Account deleted.", color: "success" });
      setTimeout(() => {
        history.replace("/login");
      }, 1500);
    } catch (e: any) {
      setDeleting(false);
      setToast({
        open: true,
        message:
          e?.message ||
          "Deletion failed. You may need to log out and back in, then try again.",
        color: "danger",
      });
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
          <IonIcon slot="start" icon={warningOutline} color="danger" />
          <IonLabel>
            <h2>Account deletion</h2>
            <p>Permanently delete your account and all stored data.</p>
            <IonText color="danger" style={{ display: "block", marginTop: 8, fontWeight: 600 }}>
              ⚠️ This CANNOT be undone
            </IonText>
          </IonLabel>
        </IonItem>
        <IonButton
          expand="block"
          color="danger"
          className="ion-margin-bottom"
          onClick={handleDeleteStep1}
        >
          <IonIcon slot="start" icon={trashOutline} />
          Delete my account
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
        
        <IonAlert
          isOpen={showDeleteStep1}
          header="Confirm your password"
          message="To delete your account, first enter your password."
          inputs={[
            {
              name: "password",
              type: "password",
              placeholder: "Your password",
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => {
                setShowDeleteStep1(false);
                setPassword("");
              },
            },
            {
              text: "Next",
              handler: (data: any) => {
                setPassword(data?.password || "");
                handleDeleteStep2();
                return false; // Prevent auto-dismiss
              },
            },
          ]}
          onDidDismiss={() => {
            if (!showDeleteStep2) {
              setShowDeleteStep1(false);
              setPassword("");
            }
          }}
        />

        <IonAlert
          isOpen={showDeleteStep2}
          header="Type your username to confirm"
          message={`To permanently delete your MacroPal account, type: "${auth.currentUser?.displayName || auth.currentUser?.email || "DELETE"}"`}
          inputs={[
            {
              name: "username",
              type: "text",
              placeholder: auth.currentUser?.displayName || auth.currentUser?.email || "DELETE",
            },
          ]}
          buttons={[
            {
              text: "Cancel",
              role: "cancel",
              handler: () => {
                setShowDeleteStep2(false);
                setPassword("");
                setUsernameConfirm("");
              },
            },
            {
              text: deleting ? "Deleting..." : "Delete Forever",
              role: "destructive",
              handler: (data: any) => {
                setUsernameConfirm(data?.username || "");
                handleDeleteFinal();
                return false; // Prevent auto-dismiss until deletion completes
              },
            },
          ]}
          onDidDismiss={() => {
            setShowDeleteStep2(false);
            setPassword("");
            setUsernameConfirm("");
          }}
        />

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
