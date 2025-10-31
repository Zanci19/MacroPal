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
  IonInput,
  IonButton,
} from "@ionic/react";

const SettingsAccount: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Account</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonList inset>
          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput type="email" value="" placeholder="you@example.com" />
          </IonItem>
          <IonItem>
            <IonLabel position="stacked">Display name</IonLabel>
            <IonInput value="" placeholder="Your name" />
          </IonItem>
        </IonList>
        <IonButton expand="block" className="ion-margin-top">Save changes</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default SettingsAccount;
