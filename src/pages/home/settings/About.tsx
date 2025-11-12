import { IonList, IonItem, IonLabel, IonNote } from "@ionic/react";

const SettingsAbout: React.FC = () => {
  const version = import.meta.env.VITE_APP_VERSION ?? "0.1.0";

  return (
    <IonList inset>
      <IonItem>
        <IonLabel>
          <h2>MacroPal</h2>
          <p>Nutrition tracking made simple.</p>
        </IonLabel>
        <IonNote slot="end">v{version}</IonNote>
      </IonItem>
      <IonItem button detail href="mailto:support@macropal.app">
        <IonLabel>Contact support</IonLabel>
      </IonItem>
      <IonItem button detail href="https://macropal.app/privacy" target="_blank" rel="noopener">
        <IonLabel>Privacy policy</IonLabel>
      </IonItem>
      <IonItem button detail href="https://macropal.app/terms" target="_blank" rel="noopener">
        <IonLabel>Terms of use</IonLabel>
      </IonItem>
    </IonList>
  );
};

export default SettingsAbout;
