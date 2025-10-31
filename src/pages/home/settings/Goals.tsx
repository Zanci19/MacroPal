import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
} from "@ionic/react";

const SettingsGoals: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Goals & Preferences</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList inset>
          <IonItem>
            <IonLabel>Goal</IonLabel>
            <IonSelect interface="popover" value="maintain">
              <IonSelectOption value="lose">Lose</IonSelectOption>
              <IonSelectOption value="maintain">Maintain</IonSelectOption>
              <IonSelectOption value="gain">Gain</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Protein target (g)</IonLabel>
            <IonInput type="number" placeholder="e.g. 140" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Carb target (g)</IonLabel>
            <IonInput type="number" placeholder="e.g. 300" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Fat target (g)</IonLabel>
            <IonInput type="number" placeholder="e.g. 70" />
          </IonItem>
        </IonList>
        <IonButton expand="block" className="ion-margin-top">Save preferences</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default SettingsGoals;
