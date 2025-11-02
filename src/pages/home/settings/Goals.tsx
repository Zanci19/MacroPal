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
  InputChangeEventDetail,
  SelectChangeEventDetail,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { useSettings } from "../../../context/SettingsContext";

type GoalsFormState = {
  goal: "lose" | "maintain" | "gain";
  calorieTarget: number;
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
  waterTarget: number;
};

const SettingsGoals: React.FC = () => {
  const { settings, updateSettings, restoreSection, getDefaultSection } =
    useSettings();
  const [form, setForm] = useState<GoalsFormState>(settings.goals);
  const [present] = useIonToast();

  useEffect(() => {
    setForm(settings.goals);
  }, [settings.goals]);

  const handleSelect = (
    event: CustomEvent<SelectChangeEventDetail<string | undefined>>
  ) => {
    setForm((prev) => ({
      ...prev,
      goal: (event.detail.value as GoalsFormState["goal"]) ?? "maintain",
    }));
  };

  const handleNumberChange = (
    field: keyof Omit<GoalsFormState, "goal">,
    event: CustomEvent<InputChangeEventDetail>
  ) => {
    const value = Number(event.detail.value);
    setForm((prev) => ({
      ...prev,
      [field]: Number.isNaN(value) ? prev[field] : Math.max(0, value),
    }));
  };

  const handleSave = () => {
    updateSettings("goals", form);
    present({ message: "Goals updated", duration: 1500, color: "success" });
  };

  const handleReset = () => {
    restoreSection("goals");
    setForm(getDefaultSection("goals"));
    present({
      message: "Goal preferences reset",
      duration: 1500,
      color: "medium",
    });
  };

  return (
    <div className="ion-padding-bottom">
      <IonList inset>
        <IonItem>
          <IonLabel>Primary goal</IonLabel>
          <IonSelect
            interface="popover"
            value={form.goal}
            onIonChange={handleSelect}
          >
            <IonSelectOption value="lose">Lose weight</IonSelectOption>
            <IonSelectOption value="maintain">Maintain weight</IonSelectOption>
            <IonSelectOption value="gain">Gain muscle</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Daily calories</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.calorieTarget}
            onIonChange={(event) => handleNumberChange("calorieTarget", event)}
          />
          <IonNote slot="helper">Recommended starting point based on your profile.</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Protein target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.proteinTarget}
            onIonChange={(event) => handleNumberChange("proteinTarget", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Carb target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.carbTarget}
            onIonChange={(event) => handleNumberChange("carbTarget", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Fat target (g)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.fatTarget}
            onIonChange={(event) => handleNumberChange("fatTarget", event)}
          />
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Water goal (ml)</IonLabel>
          <IonInput
            type="number"
            inputmode="numeric"
            value={form.waterTarget}
            onIonChange={(event) => handleNumberChange("waterTarget", event)}
          />
          <IonNote slot="helper">MacroPal will remind you to sip steadily.</IonNote>
        </IonItem>
      </IonList>

      <IonButton expand="block" className="ion-margin-top" onClick={handleSave}>
        Save preferences
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

export default SettingsGoals;
