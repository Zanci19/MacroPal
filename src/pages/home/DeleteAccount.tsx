import React from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonToast,
} from "@ionic/react";
import { deleteUser } from "firebase/auth";
import { useHistory } from "react-router-dom";
import { auth, trackEvent } from "../../firebase";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import "./DeleteAccount.css";

type DeleteStep = "intro" | "confirm";

const DeleteAccount: React.FC = () => {
  const history = useHistory();
  const user = auth.currentUser;
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [step, setStep] = React.useState<DeleteStep>("intro");
  const [typedName, setTypedName] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const requiredValue = user?.displayName || user?.email || "DELETE";
  const canDelete = typedName.trim() === requiredValue && !deleting && !isDemoMode;

  const handleDeleteAccount = async () => {
    const current = auth.currentUser;
    if (!current || !canDelete) return;

    setDeleting(true);
    try {
      await deleteUser(current);
      trackEvent("settings_delete_account_success", { uid: current.uid });
      history.replace("/start");
    } catch (error: unknown) {
      const err = error as Error;
      trackEvent("settings_delete_account_error", {
        uid: current.uid,
        error: err?.message || "unknown",
      });
      setToast({
        show: true,
        message:
          err?.message ||
          "Deletion failed. You may need to log out and back in, then try again.",
        color: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!user) {
    return (
      <SettingsSubpageLayout
        title="Delete account"
        subtitle="Permanent action"
        backHref={SETTINGS_ROUTES.root}
        className="delete-account-page"
      >
        <IonText color="medium">You are not logged in.</IonText>
      </SettingsSubpageLayout>
    );
  }

  return (
    <SettingsSubpageLayout
      title="Delete account"
      subtitle="This action is permanent and cannot be undone."
      backHref={SETTINGS_ROUTES.root}
      className="delete-account-page"
    >
      <IonCard className="delete-account-card">
        <IonCardHeader>
          <IonCardTitle className="delete-account-title">Danger zone</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          {step === "intro" ? (
            <div className="delete-account-flow">
              <p>
                Deleting your account permanently removes your profile and access to this MacroPal
                account.
              </p>
              {isDemoMode && (
                <IonText color="medium">
                  <p>Delete account is disabled in demo mode.</p>
                </IonText>
              )}
              <IonButton
                expand="block"
                color="danger"
                disabled={isDemoMode}
                onClick={() => setStep("confirm")}
              >
                Continue
              </IonButton>
            </div>
          ) : (
            <div className="delete-account-flow">
              <p>
                Type <strong>{requiredValue}</strong> to confirm deletion.
              </p>
              <IonItem lines="full">
                <IonLabel position="stacked">Confirmation text</IonLabel>
                <IonInput
                  value={typedName}
                  placeholder={requiredValue}
                  onIonInput={(event) => setTypedName(event.detail.value ?? "")}
                />
              </IonItem>
              <IonButton
                expand="block"
                color="danger"
                disabled={!canDelete}
                onClick={() => {
                  void handleDeleteAccount();
                }}
              >
                {deleting ? <IonSpinner name="crescent" /> : "Delete my account"}
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                color="medium"
                disabled={deleting}
                onClick={() => {
                  setStep("intro");
                  setTypedName("");
                }}
              >
                Back
              </IonButton>
            </div>
          )}
        </IonCardContent>
      </IonCard>

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2600}
        onDidDismiss={() => setToast((t) => ({ ...t, show: false, message: "" }))}
      />
    </SettingsSubpageLayout>
  );
};

export default DeleteAccount;
