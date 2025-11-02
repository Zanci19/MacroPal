import {
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonNote,
  useIonToast,
  InputChangeEventDetail,
  SelectChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings } from "../../../context/SettingsContext";

const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Ljubljana",
  "Asia/Tokyo",
  "Australia/Sydney",
];

type AccountFormState = {
  email: string;
  displayName: string;
  timeZone: string;
};

const SettingsAccount: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } = useSettings();
  const [form, setForm] = useState<AccountFormState>(settings.account);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.account);
  }, [settings.account]);

  const handleInputChange = (
    field: keyof AccountFormState,
    event: CustomEvent<InputChangeEventDetail>
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.detail.value ?? "",
    }));
  };

  const handleTimeZoneChange = (
    event: CustomEvent<SelectChangeEventDetail<string | undefined>>
  ) => {
    setForm((prev) => ({
      ...prev,
      timeZone: event.detail.value || "UTC",
    }));
  };

  const handleSave = () => {
    updateSettings("account", form);
    present({ message: "Account details saved", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("account");
    setForm(getDefaultSection("account"));
    present({
      message: "Account settings restored to defaults",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel position="stacked">Email</IonLabel>
          <IonInput
            type="email"
            value={form.email}
            placeholder="you@example.com"
            onIonChange={(event) => handleInputChange("email", event)}
            autocapitalize="off"
            autocomplete="email"
          />
          <IonNote slot="helper">We'll send account changes to this address.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Display name</IonLabel>
          <IonInput
            value={form.displayName}
            placeholder="MacroPal User"
            onIonChange={(event) => handleInputChange("displayName", event)}
            autocapitalize="words"
          />
          <IonNote slot="helper">Shown on shared meal plans and leaderboards.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Time zone</IonLabel>
          <IonSelect
            interface="popover"
            value={form.timeZone}
            onIonChange={handleTimeZoneChange}
          >
            {TIME_ZONES.map((zone) => (
              <IonSelectOption key={zone} value={zone}>
                {zone}
              </IonSelectOption>
            ))}
          </IonSelect>
          <IonNote slot="helper">Used for daily goal resets and reminders.</IonNote>
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save changes
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

export default SettingsAccount;
