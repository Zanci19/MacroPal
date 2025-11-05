import {
  IonList,
  IonItem,
  IonLabel,
  IonToggle,
  IonInput,
  IonButton,
  IonNote,
  useIonToast,
} from "@ionic/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsSecurity: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const [present] = useIonToast();
  const { security } = settings;
  const [pin, setPin] = useState(security.pinCode ?? "");

  useEffect(() => {
    setPin(security.pinCode ?? "");
  }, [security.pinCode]);

  const lastUpdatedText = useMemo(() => {
    if (!security.lastPasswordChange) {
      return "PIN has not been set";
    }
    return `Last updated ${new Date(security.lastPasswordChange).toLocaleDateString()}`;
  }, [security.lastPasswordChange]);

  const handlePinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pin.trim().length < 4) {
      present({
        message: "PIN must be at least 4 digits.",
        duration: 2000,
        color: "danger",
      });
      return;
    }

    updateSection("security", {
      pinCode: pin,
      requirePin: true,
      lastPasswordChange: new Date().toISOString(),
    });
    present({
      message: "PIN updated.",
      duration: 1500,
      color: "success",
    });
  };

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>Require PIN on launch</IonLabel>
        <IonToggle
          checked={security.requirePin}
          onIonChange={(event) =>
            updateSection("security", {
              requirePin: event.detail.checked,
              pinCode: event.detail.checked ? security.pinCode : null,
            })
          }
        />
      </IonItem>

      <IonItem>
        <IonLabel>Use biometrics</IonLabel>
        <IonToggle
          checked={security.biometricUnlock}
          disabled={!security.requirePin}
          onIonChange={(event) =>
            updateSection("security", { biometricUnlock: event.detail.checked })
          }
        />
      </IonItem>

      <form onSubmit={handlePinSubmit}>
        <IonItem>
          <IonLabel position="stacked">Set or update PIN</IonLabel>
          <IonInput
            type="password"
            inputmode="numeric"
            value={pin}
            disabled={!security.requirePin}
            onIonInput={(event) => setPin(event.detail.value ?? "")}
          />
          <IonNote slot="helper">Enter 4-8 digits.</IonNote>
        </IonItem>

        <IonButton
          expand="block"
          className="ion-margin-top"
          type="submit"
          disabled={!security.requirePin || pin.trim().length < 4}
        >
          Update PIN
        </IonButton>
      </form>

      <IonItem lines="none">
        <IonNote color="medium">{lastUpdatedText}</IonNote>
      </IonItem>
    </IonList>
  );
};

export default SettingsSecurity;
