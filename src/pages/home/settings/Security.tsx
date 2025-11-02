import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonNote,
  useIonToast,
  ToggleChangeEventDetail,
  SelectChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings, SecuritySettings } from "../../../context/SettingsContext";

type SecurityFormState = SecuritySettings;

const AUTO_LOCK_OPTIONS = [1, 5, 10, 30];

const SettingsSecurity: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<SecurityFormState>(settings.security);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.security);
  }, [settings.security]);

  const handleToggle = (
    field: keyof Omit<SecurityFormState, "autoLockMinutes">,
    event: CustomEvent<ToggleChangeEventDetail>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.checked,
    }));
  };

  const handleAutoLock = (
    event: CustomEvent<SelectChangeEventDetail<number | string | undefined>>
  ) => {
    const minutes = Number(event.detail.value ?? form.autoLockMinutes);
    setForm((prev) => ({
      ...prev,
      autoLockMinutes: Number.isNaN(minutes) ? prev.autoLockMinutes : minutes,
    }));
  };

  const handleSave = () => {
    updateSettings("security", form);
    present({ message: "Security preferences updated", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("security");
    setForm(getDefaultSection("security"));
    present({
      message: "Security reset to defaults",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Biometric login</IonLabel>
          <IonToggle
            checked={form.biometricLogin}
            onIonChange={(event) => handleToggle("biometricLogin", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel>Two-factor authentication</IonLabel>
          <IonToggle
            checked={form.twoFactorAuth}
            onIonChange={(event) => handleToggle("twoFactorAuth", event)}
          />
          <IonNote slot="helper">We'll guide you through setup on save.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Auto-lock</IonLabel>
          <IonSelect
            interface="popover"
            value={form.autoLockMinutes}
            onIonChange={handleAutoLock}
          >
            {AUTO_LOCK_OPTIONS.map((option) => (
              <IonSelectOption key={option} value={option}>
                {option} minute{option === 1 ? "" : "s"}
              </IonSelectOption>
            ))}
          </IonSelect>
          <IonNote slot="helper">Lock MacroPal after inactivity.</IonNote>
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save security settings
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

export default SettingsSecurity;
