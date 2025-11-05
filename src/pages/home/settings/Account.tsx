import {
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonNote,
  useIonToast,
} from "@ionic/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSettings } from "../../../context/SettingsContext";

const SettingsAccount: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const [present] = useIonToast();
  const [form, setForm] = useState(settings.account);

  useEffect(() => {
    setForm(settings.account);
  }, [settings.account]);

  const emailValid = useMemo(() => /.+@.+\..+/.test(form.email.trim()), [form.email]);
  const displayNameValid = useMemo(() => form.displayName.trim().length >= 2, [form.displayName]);

  const isDirty = useMemo(
    () =>
      form.email !== settings.account.email ||
      form.displayName !== settings.account.displayName,
    [form, settings.account]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!emailValid || !displayNameValid) {
      present({
        message: "Please provide a valid email and display name.",
        duration: 2000,
        color: "danger",
      });
      return;
    }

    updateSection("account", form);
    present({
      message: "Account details saved.",
      duration: 1500,
      color: "success",
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <IonList inset>
        <IonItem>
          <IonLabel position="stacked">Email</IonLabel>
          <IonInput
            type="email"
            value={form.email}
            onIonInput={(event) =>
              setForm((prev) => ({ ...prev, email: event.detail.value ?? "" }))
            }
            required
          />
          {!emailValid && (
            <IonNote slot="helper" color="danger">
              Enter a valid email address.
            </IonNote>
          )}
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Display name</IonLabel>
          <IonInput
            value={form.displayName}
            onIonInput={(event) =>
              setForm((prev) => ({ ...prev, displayName: event.detail.value ?? "" }))
            }
            required
          />
          {!displayNameValid && (
            <IonNote slot="helper" color="danger">
              Display name must be at least 2 characters.
            </IonNote>
          )}
        </IonItem>
      </IonList>

      <IonButton
        expand="block"
        className="ion-margin-top"
        type="submit"
        disabled={!isDirty || !emailValid || !displayNameValid}
      >
        Save changes
      </IonButton>
    </form>
  );
};

export default SettingsAccount;
