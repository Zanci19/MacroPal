import React, { useMemo, useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToast,
} from "@ionic/react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db, trackEvent } from "../../firebase";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import { sanitizeInput } from "../../utils/validation";
import { handleError } from "../../utils/handleError";

type FeedbackCategory = "bug" | "feature" | "ux" | "other";

const Feedback: React.FC = () => {
  const user = auth.currentUser;
  const defaultEmail = useMemo(() => user?.email ?? "", [user?.email]);
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color: "success" | "danger" | "warning";
  }>({
    show: false,
    message: "",
    color: "success",
  });

  const submitFeedback = async () => {
    const current = auth.currentUser;
    if (!current) {
      setToast({
        show: true,
        message: "You must be logged in to send feedback.",
        color: "warning",
      });
      return;
    }

    const sanitizedMessage = sanitizeInput(message, 2000);
    const sanitizedContactEmail = sanitizeInput(contactEmail, 120);
    if (sanitizedMessage.length < 10) {
      setToast({
        show: true,
        message: "Please enter at least 10 characters.",
        color: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        uid: current.uid,
        userEmail: current.email ?? null,
        displayName: current.displayName ?? null,
        category,
        message: sanitizedMessage,
        contactEmail: sanitizedContactEmail || null,
        source: "settings_feedback",
        status: "new",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      trackEvent("feedback_submitted", {
        uid: current.uid,
        category,
        messageLength: sanitizedMessage.length,
      });

      setMessage("");
      setContactEmail(current.email ?? "");
      setToast({
        show: true,
        message: "Thanks! Your feedback has been sent.",
        color: "success",
      });
    } catch (error) {
      setToast({
        show: true,
        message: handleError("feedback_submit", error),
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSubpageLayout
      title="Feedback"
      subtitle="Tell us what to improve. Reports from here are sent directly to MacroPal feedback."
      backHref={SETTINGS_ROUTES.root}
    >
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Send feedback</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonList>
            <IonItem lines="full">
              <IonLabel position="stacked">Type</IonLabel>
              <IonSelect
                value={category}
                interface="popover"
                onIonChange={(event) => {
                  setCategory((event.detail.value as FeedbackCategory) || "other");
                }}
              >
                <IonSelectOption value="bug">Bug report</IonSelectOption>
                <IonSelectOption value="feature">Feature request</IonSelectOption>
                <IonSelectOption value="ux">UX/UI feedback</IonSelectOption>
                <IonSelectOption value="other">Other</IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Message</IonLabel>
              <IonTextarea
                autoGrow
                rows={6}
                maxlength={2000}
                value={message}
                placeholder="Describe what happened or what you'd like to see improved..."
                onIonInput={(event) => setMessage(event.detail.value ?? "")}
              />
            </IonItem>

            <IonItem lines="none">
              <IonLabel position="stacked">Contact email (optional)</IonLabel>
              <IonInput
                type="email"
                value={contactEmail}
                placeholder="you@example.com"
                onIonInput={(event) => setContactEmail(event.detail.value ?? "")}
              />
            </IonItem>
          </IonList>
        </IonCardContent>
      </IonCard>

      <IonButton
        expand="block"
        className="settings-subpage-primary-action"
        onClick={() => {
          void submitFeedback();
        }}
        disabled={saving}
      >
        {saving ? "Sending..." : "Send feedback"}
      </IonButton>

      <IonToast
        isOpen={toast.show}
        onDidDismiss={() => setToast((prev) => ({ ...prev, show: false }))}
        message={toast.message}
        color={toast.color}
        duration={2500}
      />
    </SettingsSubpageLayout>
  );
};

export default Feedback;
