import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonButton,
  IonIcon,
  IonAlert,
  IonToast,
  IonText,
  IonToggle,
} from "@ionic/react";
import {
  personCircleOutline,
  logOutOutline,
  keyOutline,
  mailOutline,
  warningOutline,
  cafeOutline,
  trashOutline,
  logoGoogle,
} from "ionicons/icons";
import { auth, db, trackEvent } from "../../firebase";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
} from "firebase/auth";
import { useHistory } from "react-router-dom";
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import "./Settings.css";
import { ensureGoogleFitAccess, isGoogleFitSupported } from "../../utils/googleFit";


const Settings: React.FC = () => {
  const history = useHistory();
  const user = auth.currentUser;

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = React.useState(false);

  const [smartRecommendationEnabled, setSmartRecommendationEnabled] = React.useState(true);
  const [showWellnessTipEnabled, setShowWellnessTipEnabled] = React.useState(true);
  const [showRecentItemsEnabled, setShowRecentItemsEnabled] = React.useState(true);
  const [showRecentSearchesEnabled, setShowRecentSearchesEnabled] = React.useState(true);
  const [confirmClearRecent, setConfirmClearRecent] = React.useState(false);
  const [clearingRecent, setClearingRecent] = React.useState(false);
  const [googleFitAutoImport, setGoogleFitAutoImport] = React.useState(false);
  const [checkingGoogleFit, setCheckingGoogleFit] = React.useState(false);
  const [googleFitStatus, setGoogleFitStatus] = React.useState<string>("");
  const googleFitSupported = isGoogleFitSupported();

  const handleVerifyEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setToast({
        show: true,
        message: "Verification email sent.",
        color: "success",
      });
    } catch (e: any) {
      setToast({
        show: true,
        message: e?.message || "Could not send verification email.",
        color: "danger",
      });
    }
  };

  const handleResetPassword = async () => {
    const email = auth.currentUser?.email || "";
    if (!email) {
      setToast({
        show: true,
        message: "No email on account.",
        color: "danger",
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setToast({
        show: true,
        message: "Password reset email sent.",
        color: "success",
      });
    } catch (e: any) {
      setToast({
        show: true,
        message: e?.message || "Could not send password reset email.",
        color: "danger",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    try {
      await deleteUser(auth.currentUser);
      setToast({ show: true, message: "Account deleted.", color: "success" });
      history.replace("/login");
    } catch (e: any) {
      setToast({
        show: true,
        message:
          e?.message ||
          "Deletion failed. You may need to log out and back in, then try again (recent login required).",
        color: "danger",
      });
    }
  };

  const handleClearRecentFoods = async () => {
    if (!auth.currentUser) return;
    try {
      setClearingRecent(true);
      const recentRef = collection(
        db,
        "users",
        auth.currentUser.uid,
        "recentFoods"
      );
      const snap = await getDocs(recentRef);

      const deletions = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletions);

      setToast({
        show: true,
        message: "Recent foods history cleared.",
        color: "success",
      });
    } catch (e: any) {
      setToast({
        show: true,
        message: e?.message || "Could not clear recent foods.",
        color: "danger",
      });
    } finally {
      setClearingRecent(false);
    }
  };

  const handleGoogleFitToggle = async (checked: boolean) => {
    const current = auth.currentUser;
    if (!current) return;

    let nextStatus = "";

    if (checked) {
      setCheckingGoogleFit(true);
      const status = await ensureGoogleFitAccess();
      setCheckingGoogleFit(false);

      if (!status.ready) {
        const message =
          status.reason === "unavailable"
            ? "Google Fit works on Android native builds with the plugin installed."
            : status.reason === "not_installed"
              ? "Please install Google Fit to turn on auto-import."
              : status.reason === "denied"
                ? "Permission denied. Please allow Google Fit access."
                : "Couldn't connect to Google Fit right now.";

        setToast({ show: true, message, color: "warning" });
        setGoogleFitAutoImport(false);
        return;
      }

      nextStatus = "Connected to Google Fit. Calories will auto-import.";
    }

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.googleFitAutoImport": checked,
      });

      setGoogleFitAutoImport(checked);
      setGoogleFitStatus(nextStatus);
      trackEvent("settings_google_fit_auto_import_toggle", {
        uid: current.uid,
        enabled: checked,
      });
    } catch (err: any) {
      console.error("Failed to save Google Fit auto import:", err);
      setToast({
        show: true,
        message: err?.message || "Could not update Google Fit setting.",
        color: "danger",
      });
      setGoogleFitAutoImport((prev) => !checked ? prev : false);
      setGoogleFitStatus((prev) => (checked ? prev : "Connected to Google Fit."));
    }
  };

  React.useEffect(() => {
    const load = async () => {
      const current = auth.currentUser;
      if (!current) return;

      try {
        const ref = doc(db, "users", current.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as any | undefined;
        const profile = data?.profile;

        const enabled =
          profile && typeof profile.smartRecommendationEnabled === "boolean"
            ? profile.smartRecommendationEnabled
            : true;

        setSmartRecommendationEnabled(
          typeof (profile as any).smartRecommendationEnabled === "boolean"
            ? (profile as any).smartRecommendationEnabled
            : true
        );

        setShowWellnessTipEnabled(
          typeof (profile as any).showWellnessTip === "boolean"
            ? (profile as any).showWellnessTip
            : true
        );


        setShowRecentItemsEnabled(
          typeof (profile as any).showRecentItems === "boolean"
            ? (profile as any).showRecentItems
            : true
        );

        setShowRecentSearchesEnabled(
          typeof (profile as any).showRecentSearches === "boolean"
            ? (profile as any).showRecentSearches
            : true
        );

        const googleFitEnabled =
          typeof (profile as any).googleFitAutoImport === "boolean"
            ? (profile as any).googleFitAutoImport
            : false;
        setGoogleFitAutoImport(googleFitEnabled);
        setGoogleFitStatus(
          googleFitEnabled
            ? "Auto-import is on. We'll pull calories from Google Fit when available."
            : ""
        );

        setSmartRecommendationEnabled(enabled);
      } catch (e) {
        console.error("Failed to load smartRecommendationEnabled:", e);
      }
    };

    load();
  }, []);

  if (!user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding tabbed-content settings-page">
          <IonText color="medium">Please log in.</IonText>
          <IonButton
            className="ion-margin-top"
            onClick={() => history.push("/login")}
          >
            Go to Login
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }

  const verified = !!user.emailVerified;
  const usernameToType = user.displayName || user.email || "DELETE";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding tabbed-content settings-page">
        <IonList>
          <IonItem lines="full">
            <IonIcon slot="start" icon={personCircleOutline} />
            <IonLabel>
              <h2>{user.displayName || "Unnamed User"}</h2>
              <p>{user.email}</p>
            </IonLabel>
            <IonNote slot="end" color={verified ? "success" : "warning"}>
              {verified ? "Verified" : "Unverified"}
            </IonNote>
          </IonItem>
        </IonList>

        <IonList>
          <IonItem
            lines="full"
            button
            onClick={() => history.push("/setup-profile")}
          >
            <IonLabel>Profile, goals & targets</IonLabel>
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Show smart recommendation</IonLabel>
            <IonToggle
              slot="end"
              checked={smartRecommendationEnabled}
              onIonChange={async (e) => {
                const checked = e.detail.checked;
                setSmartRecommendationEnabled(checked);

                const current = auth.currentUser;
                if (!current) return;

                const ref = doc(db, "users", current.uid);


                try {
                  await updateDoc(ref, {
                    "profile.smartRecommendationEnabled": checked,
                  });

                  trackEvent("settings_smart_recommendation_toggle", {
                    uid: current.uid,
                    enabled: checked,
                  });
                } catch (err: any) {
                  console.error("Failed to save smartRecommendationEnabled:", err);
                  setToast({
                    show: true,
                    message:
                      err?.message ||
                      "Could not update smart recommendation setting.",
                    color: "danger",
                  });
                }
              }}
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Show wellness tip</IonLabel>
            <IonToggle
              slot="end"
              checked={showWellnessTipEnabled}
              onIonChange={async (e) => {
                const checked = e.detail.checked;
                setShowWellnessTipEnabled(checked);

                const current = auth.currentUser;
                if (!current) return;

                const ref = doc(db, "users", current.uid);

                try {
                  await updateDoc(ref, {
                    "profile.showWellnessTip": checked,
                  });

                  trackEvent("settings_show_wellness_tip_toggle", {
                    uid: current.uid,
                    enabled: checked,
                  });
                } catch (err: any) {
                  console.error("Failed to save showWellnessTip:", err);
                  setToast({
                    show: true,
                    message:
                      err?.message ||
                      "Could not update wellness tip setting.",
                    color: "danger",
                  });
                }
              }}
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Show recently added foods</IonLabel>
            <IonToggle
              slot="end"
              checked={showRecentItemsEnabled}
              onIonChange={async (e) => {
                const checked = e.detail.checked;
                setShowRecentItemsEnabled(checked);

                const current = auth.currentUser;
                if (!current) return;

                const ref = doc(db, "users", current.uid);

                try {
                  await updateDoc(ref, {
                    "profile.showRecentItems": checked,
                  });

                  trackEvent("settings_show_recent_items_toggle", {
                    uid: current.uid,
                    enabled: checked,
                  });
                } catch (err: any) {
                  console.error("Failed to save showRecentItems:", err);
                  setToast({
                    show: true,
                    message:
                      err?.message ||
                      "Could not update recent items setting.",
                    color: "danger",
                  });
                }
              }}
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Show recently searched items</IonLabel>
            <IonToggle
              slot="end"
              checked={showRecentSearchesEnabled}
              onIonChange={async (e) => {
                const checked = e.detail.checked;
                setShowRecentSearchesEnabled(checked);

                const current = auth.currentUser;
                if (!current) return;

                const ref = doc(db, "users", current.uid);

                try {
                  await updateDoc(ref, {
                    "profile.showRecentSearches": checked,
                  });

                  trackEvent("settings_show_recent_searches_toggle", {
                    uid: current.uid,
                    enabled: checked,
                  });
                } catch (err: any) {
                  console.error("Failed to save showRecentSearches:", err);
                  setToast({
                    show: true,
                    message:
                      err?.message ||
                      "Could not update recent searches setting.",
                    color: "danger",
                  });
                }
              }}
            />
          </IonItem>

          <IonItem lines="full">
            <IonIcon slot="start" icon={logoGoogle} />
            <IonLabel>
              <h2>Google Fit calories</h2>
              <p>Automatically import burned calories into workouts.</p>
              <IonNote color="medium">
                {googleFitSupported
                  ? googleFitStatus ||
                    "Requires Google Fit on Android. We'll sync once it's enabled."
                  : "Requires the Android app with the Google Fit plugin installed."}
              </IonNote>
            </IonLabel>
            <IonToggle
              slot="end"
              disabled={!googleFitSupported || checkingGoogleFit}
              checked={googleFitAutoImport}
              onIonChange={(e) => void handleGoogleFitToggle(e.detail.checked)}
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Email verification</IonLabel>
            <IonButton
              fill="outline"
              onClick={handleVerifyEmail}
              disabled={verified}
            >
              <IonIcon slot="start" icon={mailOutline} />
              {verified ? "Verified" : "Send link"}
            </IonButton>
          </IonItem>

          <IonItem lines="full">
            <IonLabel>Password</IonLabel>
            <IonButton onClick={handleResetPassword}>
              <IonIcon slot="start" icon={keyOutline} />
              Send reset email
            </IonButton>
          </IonItem>

          <IonItem
            lines="full"
            button
            onClick={() =>
              window.open("https://buymeacoffee.com/zanci19", "_blank")
            }
          >
            <IonIcon slot="start" icon={cafeOutline} />
            <IonLabel>Buy me a coffee ☕</IonLabel>
          </IonItem>

          <IonItem
            lines="full"
            button
            disabled={clearingRecent}
            onClick={() => setConfirmClearRecent(true)}
          >
            <IonIcon slot="start" icon={trashOutline} />
            <IonLabel>Clear recent foods history</IonLabel>
            {clearingRecent && (
              <IonNote slot="end" color="medium">
                Clearing…
              </IonNote>
            )}
          </IonItem>

          <IonItem
            lines="full"
            button
            onClick={async () => {
              await signOut(auth);
            }}
          >
            <IonIcon slot="start" icon={logOutOutline} />
            <IonLabel>Sign out</IonLabel>
          </IonItem>

          <IonItem lines="none">
            <IonButton color="danger" onClick={() => setConfirmDelete(true)}>
              <IonIcon slot="start" icon={warningOutline} />
              Delete account
            </IonButton>
          </IonItem>
        </IonList>
      </IonContent>

      {/* Alerts + Toasts unchanged */}
      <IonAlert
        isOpen={confirmDelete}
        header="Delete account?"
        message="This is permanent and cannot be undone."
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => setConfirmDelete(false),
          },
          {
            text: "Continue",
            role: "destructive",
            handler: () => {
              setConfirmDelete(false);
              setConfirmDeleteName(true);
            },
          },
        ]}
        onDidDismiss={() => setConfirmDelete(false)}
      />

      <IonAlert
        isOpen={confirmClearRecent}
        header="Clear recent foods?"
        message="This will remove your recent foods history. Favorites and diary entries will stay."
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => setConfirmClearRecent(false),
          },
          {
            text: "Clear",
            role: "destructive",
            handler: () => {
              setConfirmClearRecent(false);
              void handleClearRecentFoods();
            },
          },
        ]}
        onDidDismiss={() => setConfirmClearRecent(false)}
      />

      <IonAlert
        isOpen={confirmDeleteName}
        header="Type your name to confirm"
        message={`To permanently delete your MacroPal account, please type: "${usernameToType}"`}
        inputs={[
          {
            name: "typedName",
            placeholder: usernameToType,
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              setConfirmDeleteName(false);
            },
          },
          {
            text: "Delete",
            role: "destructive",
            handler: (data: any) => {
              const typed = (data?.typedName || "").trim();
              if (typed !== usernameToType) {
                setToast({
                  show: true,
                  message:
                    "Name does not match. Please type it exactly as shown.",
                  color: "danger",
                });
                return false;
              }
              setConfirmDeleteName(false);
              void handleDeleteAccount();
            },
          },
        ]}
        onDidDismiss={() => setConfirmDeleteName(false)}
      />

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2200}
        onDidDismiss={() =>
          setToast((t) => ({ ...t, show: false, message: "" }))
        }
      />
    </IonPage>
  );
};

export default Settings;