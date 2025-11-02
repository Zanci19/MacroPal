import {
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonButton,
  IonIcon,
  IonText,
} from "@ionic/react";
import { openOutline, mailOutline, documentTextOutline } from "ionicons/icons";
import { useSettings } from "../../../context/SettingsContext";

const SettingsAbout: React.FC = () => {
  const { settings } = useSettings();
  const { about } = settings;

  const openWebsite = () => {
    window.open(about.website, "_blank");
  };

  const contactSupport = () => {
    window.open(`mailto:${about.supportEmail}`);
  };

  const viewPolicies = () => {
    window.open(`${about.website}/privacy`, "_blank");
  };

  return (
    <div className="ion-padding">
      <IonList inset>
        <IonItem lines="none">
          <IonLabel>
            <h2>MacroPal</h2>
            <p>Version {about.version}</p>
          </IonLabel>
          <IonNote slot="end">Build {about.buildNumber}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Release channel</IonLabel>
          <IonNote slot="end">{about.releaseChannel}</IonNote>
        </IonItem>
      </IonList>

      <IonText>
        MacroPal is your companion for tracking macros, hydration, and habits.
        We’re shipping updates frequently during the {about.releaseChannel} cycle.
      </IonText>

      <IonButton expand="block" className="ion-margin-top" onClick={openWebsite}>
        <IonIcon slot="start" icon={openOutline} />
        Visit website
      </IonButton>
      <IonButton expand="block" fill="outline" onClick={contactSupport}>
        <IonIcon slot="start" icon={mailOutline} />
        Contact support
      </IonButton>
      <IonButton expand="block" fill="clear" onClick={viewPolicies}>
        <IonIcon slot="start" icon={documentTextOutline} />
        Privacy & terms
      </IonButton>
    </div>
  );
};

export default SettingsAbout;
