import {
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonNote,
  useIonToast,
} from "@ionic/react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { GoalFocus, useSettings } from "../../../context/SettingsContext";

const SettingsGoals: React.FC = () => {
  const { settings, updateSection } = useSettings();
  const [present] = useIonToast();
  const [form, setForm] = useState(settings.goals);

  useEffect(() => {
    setForm(settings.goals);
  }, [settings.goals]);

  const macroCalories = useMemo(
    () => form.proteinTarget * 4 + form.carbTarget * 4 + form.fatTarget * 9,
    [form.carbTarget, form.fatTarget, form.proteinTarget]
  );

  const calorieDelta = macroCalories - form.calorieTarget;
  const macrosValid = useMemo(
    () =>
      form.proteinTarget > 0 &&
      form.carbTarget > 0 &&
      form.fatTarget > 0 &&
      form.calorieTarget >= 100,
    [form]
  );

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(settings.goals),
    [form, settings.goals]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!macrosValid) {
      present({
        message: "Targets must be positive values.",
        duration: 2000,
        color: "danger",
      });
      return;
    }

    updateSection("goals", form);
    present({
      message: "Goals updated.",
      duration: 1500,
      color: "success",
    });
  };

  const setNumericValue = (key: keyof typeof form, value: string | null | undefined) => {
    const numeric = Number(value ?? "0");
    setForm((prev) => ({ ...prev, [key]: Number.isNaN(numeric) ? 0 : numeric }));
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <IonList inset>
        <IonItem>
          <IonLabel>Goal focus</IonLabel>
          <IonSelect
            interface="popover"
            value={form.focus}
            onIonChange={(event) =>
              setForm((prev) => ({ ...prev, focus: event.detail.value as GoalFocus }))
            }
          >
            <IonSelectOption value="lose">Lose weight</IonSelectOption>
            <IonSelectOption value="maintain">Maintain weight</IonSelectOption>
            <IonSelectOption value="gain">Gain weight</IonSelectOption>
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Daily calorie target</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.calorieTarget}
            min="100"
            onIonInput={(event) => setNumericValue("calorieTarget", event.detail.value)}
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Protein target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.proteinTarget}
            min="0"
            onIonInput={(event) => setNumericValue("proteinTarget", event.detail.value)}
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Carb target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.carbTarget}
            min="0"
            onIonInput={(event) => setNumericValue("carbTarget", event.detail.value)}
            required
          />
        </IonItem>

        <IonItem>
          <IonLabel position="stacked">Fat target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.fatTarget}
            min="0"
            onIonInput={(event) => setNumericValue("fatTarget", event.detail.value)}
            required
          />
        </IonItem>

        <IonItem lines="none">
          <IonNote slot="end" color={calorieDelta === 0 ? "success" : "warning"}>
            {calorieDelta === 0
              ? "Macros align with calorie target"
              : `${Math.abs(calorieDelta)} kcal ${calorieDelta > 0 ? "over" : "under"}`}
          </IonNote>
        </IonItem>
      </IonList>

      <IonButton
        expand="block"
        className="ion-margin-top"
        type="submit"
        disabled={!isDirty || !macrosValid}
      >
        Save preferences
      </IonButton>
    </form>
  );
};

export default SettingsGoals;
