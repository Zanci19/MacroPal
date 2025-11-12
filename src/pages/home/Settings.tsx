// src/pages/settings/Settings.tsx
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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from "@ionic/react";
import {
  personCircleOutline,
  logOutOutline,
  keyOutline,
  mailOutline,
  warningOutline,
} from "ionicons/icons";
import { auth, db } from "../../firebase";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useHistory } from "react-router-dom";

type GoalValue = "lose" | "maintain" | "gain";
type ActivityValue = "sedentary" | "light" | "moderate" | "very" | "extra";

const Settings: React.FC = () => {
  const history = useHistory();
  const [authUser, setAuthUser] = React.useState(() => auth.currentUser);
  const [profileData, setProfileData] = React.useState<{
    weight: number | null;
    goal: GoalValue;
    activity: ActivityValue;
    waterTarget: number | null;
  }>({ weight: null, goal: "maintain", activity: "sedentary", waterTarget: 2000 });
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const user = authUser;

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, (next) => setAuthUser(next));
    return () => unsub();
  }, []);

  React.useEffect(() => {
    let active = true;
    if (!authUser) {
      if (active) {
        setProfileData({ weight: null, goal: "maintain", activity: "sedentary", waterTarget: 2000 });
        setProfileLoading(false);
      }
      return () => {
        active = false;
      };
    }

    setProfileLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", authUser.uid));
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data() as any;
          setProfileData({
            weight: typeof data.weight === "number" ? data.weight : null,
            goal: (data.goal as GoalValue) || "maintain",
            activity: (data.activity as ActivityValue) || "sedentary",
            waterTarget:
              typeof data.waterTarget === "number" && data.waterTarget > 0
                ? data.waterTarget
                : 2000,
          });
        } else {
          setProfileData({ weight: null, goal: "maintain", activity: "sedentary", waterTarget: 2000 });
        }
      } catch (e) {
        console.error(e);
        if (active) {
          setToast({ show: true, message: "Couldn't load goals.", color: "danger" });
          setProfileData({ weight: null, goal: "maintain", activity: "sedentary", waterTarget: 2000 });
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [authUser]);

  const handleVerifyEmail = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setToast({ show: true, message: "Verification email sent.", color: "success" });
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
      setToast({ show: true, message: "No email on account.", color: "danger" });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setToast({ show: true, message: "Password reset email sent.", color: "success" });
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

  const saveDailyGoals = async () => {
    if (!user) return;
    if (!profileData.waterTarget || profileData.waterTarget <= 0) {
      setToast({ show: true, message: "Enter a positive water goal.", color: "danger" });
      return;
    }

    setSavingProfile(true);
    try {
      const payload: Record<string, any> = {
        goal: profileData.goal,
        activity: profileData.activity,
        waterTarget: Math.round(profileData.waterTarget),
      };

      if (typeof profileData.weight === "number" && !Number.isNaN(profileData.weight)) {
        payload.weight = profileData.weight;
      }

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
      setToast({ show: true, message: "Daily goals updated.", color: "success" });
    } catch (e: any) {
      console.error(e);
      setToast({ show: true, message: e?.message || "Could not update goals.", color: "danger" });
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonText color="medium">Please log in.</IonText>
          <IonButton className="ion-margin-top" onClick={() => history.push("/login")}>
            Go to Login
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }

  const verified = !!user?.emailVerified;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Profile summary */}
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

        {/* Account actions (only working features) */}
        <IonList>
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

          <IonItem lines="full" button onClick={async () => await signOut(auth)}>
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

        <IonCard className="ion-margin-top">
          <IonCardHeader>
            <IonCardTitle>Daily goals</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {profileLoading ? (
              <div className="ion-text-center" style={{ padding: "16px 0" }}>
                <IonSpinner name="dots" />
              </div>
            ) : (
              <>
                <IonItem lines="full">
                  <IonLabel position="stacked">Current weight (kg)</IonLabel>
                  <IonInput
                    type="number"
                    inputmode="decimal"
                    value={profileData.weight ?? ""}
                    onIonChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        weight: e.detail.value ? Number(e.detail.value) : null,
                      }))
                    }
                  />
                </IonItem>

                <IonItem lines="full">
                  <IonLabel position="stacked">Goal</IonLabel>
                  <IonSelect
                    value={profileData.goal}
                    onIonChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        goal: (e.detail.value as GoalValue) || prev.goal,
                      }))
                    }
                  >
                    <IonSelectOption value="lose">Lose weight</IonSelectOption>
                    <IonSelectOption value="maintain">Maintain</IonSelectOption>
                    <IonSelectOption value="gain">Gain</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem lines="full">
                  <IonLabel position="stacked">Activity</IonLabel>
                  <IonSelect
                    value={profileData.activity}
                    onIonChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        activity: (e.detail.value as ActivityValue) || prev.activity,
                      }))
                    }
                  >
                    <IonSelectOption value="sedentary">Sedentary (little/no exercise)</IonSelectOption>
                    <IonSelectOption value="light">Lightly active (1–3 days/week)</IonSelectOption>
                    <IonSelectOption value="moderate">Moderate (3–5 days/week)</IonSelectOption>
                    <IonSelectOption value="very">Very active (6–7 days/week)</IonSelectOption>
                    <IonSelectOption value="extra">Extra active (hard exercise/job)</IonSelectOption>
                  </IonSelect>
                </IonItem>

                <IonItem lines="full">
                  <IonLabel position="stacked">Water goal (ml)</IonLabel>
                  <IonInput
                    type="number"
                    inputmode="numeric"
                    value={profileData.waterTarget ?? ""}
                    onIonChange={(e) =>
                      setProfileData((prev) => ({
                        ...prev,
                        waterTarget: e.detail.value ? Number(e.detail.value) : null,
                      }))
                    }
                  />
                </IonItem>

                <IonText color="medium">
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    Hydration goal powers the tracker on your Home dashboard.
                  </p>
                </IonText>

                <IonButton
                  expand="block"
                  className="ion-margin-top"
                  onClick={saveDailyGoals}
                  disabled={savingProfile}
                >
                  {savingProfile ? <IonSpinner name="dots" /> : "Save changes"}
                </IonButton>
              </>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>

      {/* Confirm delete */}
      <IonAlert
        isOpen={confirmDelete}
        header="Delete account?"
        message="This is permanent and cannot be undone."
        buttons={[
          { text: "Cancel", role: "cancel", handler: () => setConfirmDelete(false) },
          {
            text: "Delete",
            role: "destructive",
            handler: async () => {
              setConfirmDelete(false);
              await handleDeleteAccount();
            },
          },
        ]}
        onDidDismiss={() => setConfirmDelete(false)}
      />

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2200}
        onDidDismiss={() => setToast({ show: false, message: "" })}
      />
    </IonPage>
  );
};

export default Settings;
