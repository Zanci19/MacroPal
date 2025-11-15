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
} from "@ionic/react";
import {
  personCircleOutline,
  logOutOutline,
  keyOutline,
  mailOutline,
  warningOutline,
  cafeOutline,
} from "ionicons/icons"; // <-- added cafe icon
import { auth } from "../../firebase";
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
} from "firebase/auth";
import { useHistory } from "react-router-dom";

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

        {/* Account actions */}
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

          {/* ❤️ Buy me a coffee button */}
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

      {/* Alerts + Toasts (unchanged) */}
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
