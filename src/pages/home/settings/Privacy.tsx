import {
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonNote,
  IonButton,
  useIonToast,
  SelectChangeEventDetail,
  ToggleChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings, PrivacySettings } from "../../../context/SettingsContext";

type PrivacyFormState = PrivacySettings;

const SettingsPrivacy: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<PrivacyFormState>(settings.privacy);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.privacy);
  }, [settings.privacy]);

  const handleVisibility = (
    event: CustomEvent<SelectChangeEventDetail<PrivacyFormState["diaryVisibility"]>>
  ) => {
    setForm((prev) => ({
      ...prev,
      diaryVisibility: event.detail.value,
    }));
  };

  const handleToggle = (
    field: keyof Omit<PrivacyFormState, "diaryVisibility">,
    event: CustomEvent<ToggleChangeEventDetail>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.checked,
    }));
  };

  const handleSave = () => {
    updateSettings("privacy", form);
    present({ message: "Privacy preferences saved", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("privacy");
    setForm(getDefaultSection("privacy"));
    present({
      message: "Privacy settings reset",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Diary visibility</IonLabel>
          <IonSelect
            interface="popover"
            value={form.diaryVisibility}
            onIonChange={handleVisibility}
          >
            <IonSelectOption value="private">Private (only you)</IonSelectOption>
            <IonSelectOption value="friends">Friends</IonSelectOption>
            <IonSelectOption value="public">Public</IonSelectOption>
          </IonSelect>
          <IonNote slot="helper">Controls who can see your logged meals.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Share anonymous analytics</IonLabel>
          <IonToggle
            checked={form.shareAnalytics}
            onIonChange={(event) => handleToggle("shareAnalytics", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Allow data collection</IonLabel>
          <IonToggle
            checked={form.dataCollection}
            onIonChange={(event) => handleToggle("dataCollection", event)}
          />
          <IonNote slot="helper">Helps improve recommendations.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Discoverable by email</IonLabel>
          <IonToggle
            checked={form.discoverableByEmail}
            onIonChange={(event) => handleToggle("discoverableByEmail", event)}
          />
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save privacy settings
      </IonButton>
      <IonButton
        expand="block"
        fill="clear"
        color="medium"
        onClick={handleReset}
      >
        Reset to defaults
      </IonButton>
    </div>
  );
};

export default SettingsPrivacy;
