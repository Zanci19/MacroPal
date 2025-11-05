import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonInput,
  IonButton,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonText
} from "@ionic/react";
import { auth, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useHistory } from "react-router";
import "../styles/forms.css";

const SetupProfile: React.FC = () => {
  const [age, setAge] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [goal, setGoal] = useState<"lose" | "maintain" | "gain">("maintain");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [activity, setActivity] = useState<"sedentary" | "light" | "moderate" | "very" | "extra">("sedentary");
  const history = useHistory();

  const handleSave = async () => {
    if (!auth.currentUser) return;

    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        age,
        weight,
        height,
        goal,
        gender,
        activity
      });
      history.push("/app/home");
    } catch (error: any) {
      alert("Error saving profile: " + error.message);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Setup Profile</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="mp-auth-content">
        <div className="mp-auth-card mp-auth-card--wider" role="main">
          <div className="mp-auth-card__logo" aria-hidden="true">MP</div>
          <h1>Complete your profile</h1>
          <p className="mp-auth-subtitle">
            Tell us a little about yourself so MacroPal can craft the perfect daily macro and calorie targets for you.
          </p>

          <div className="mp-auth-form">
            <div className="mp-auth-grid">
              <IonItem lines="none">
                <IonLabel position="stacked">Age</IonLabel>
                <IonInput
                  type="number"
                  min="0"
                  inputmode="numeric"
                  value={age ?? ""}
                  placeholder="27"
                  onIonChange={e => {
                    const value = e.detail.value;
                    setAge(value === undefined || value === null || value === "" ? null : Number(value));
                  }}
                />
              </IonItem>

              <IonItem lines="none">
                <IonLabel position="stacked">Weight (kg)</IonLabel>
                <IonInput
                  type="number"
                  min="0"
                  inputmode="decimal"
                  value={weight ?? ""}
                  placeholder="72"
                  onIonChange={e => {
                    const value = e.detail.value;
                    setWeight(value === undefined || value === null || value === "" ? null : Number(value));
                  }}
                />
              </IonItem>

              <IonItem lines="none">
                <IonLabel position="stacked">Height (cm)</IonLabel>
                <IonInput
                  type="number"
                  min="0"
                  inputmode="numeric"
                  value={height ?? ""}
                  placeholder="178"
                  onIonChange={e => {
                    const value = e.detail.value;
                    setHeight(value === undefined || value === null || value === "" ? null : Number(value));
                  }}
                />
              </IonItem>

              <IonItem lines="none">
                <IonLabel position="stacked">Gender</IonLabel>
                <IonSelect value={gender} onIonChange={e => setGender(e.detail.value)} interface="popover">
                  <IonSelectOption value="male">Male</IonSelectOption>
                  <IonSelectOption value="female">Female</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            <div>
              <IonText className="mp-auth-muted">Goal focus</IonText>
              <div className="mp-pill-group" role="group" aria-label="Select your goal">
                <IonButton className={`mp-pill ${goal === "lose" ? "is-active" : ""}`} fill="clear" onClick={() => setGoal("lose")}>Lose</IonButton>
                <IonButton className={`mp-pill ${goal === "maintain" ? "is-active" : ""}`} fill="clear" onClick={() => setGoal("maintain")}>Maintain</IonButton>
                <IonButton className={`mp-pill ${goal === "gain" ? "is-active" : ""}`} fill="clear" onClick={() => setGoal("gain")}>Gain</IonButton>
              </div>
            </div>

            <div>
              <IonText className="mp-auth-muted">Activity level</IonText>
              <IonItem lines="none">
                <IonSelect
                  value={activity}
                  onIonChange={e => setActivity(e.detail.value)}
                  interface="popover"
                  placeholder="Choose the option that suits you"
                >
                  <IonSelectOption value="sedentary">Sedentary · little or no exercise</IonSelectOption>
                  <IonSelectOption value="light">Lightly active · 1–3 days / week</IonSelectOption>
                  <IonSelectOption value="moderate">Moderately active · 3–5 days / week</IonSelectOption>
                  <IonSelectOption value="very">Very active · 6–7 days / week</IonSelectOption>
                  <IonSelectOption value="extra">Extra active · physical job or athlete</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>
          </div>

          <IonButton className="mp-auth-button" expand="block" size="large" onClick={handleSave}>
            Save profile
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SetupProfile;
