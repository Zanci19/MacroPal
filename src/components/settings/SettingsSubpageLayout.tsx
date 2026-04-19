import React from "react";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import "./SettingsSubpageLayout.css";

interface SettingsSubpageLayoutProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
  className?: string;
}

const SettingsSubpageLayout: React.FC<SettingsSubpageLayoutProps> = ({
  title,
  subtitle,
  backHref = SETTINGS_ROUTES.root,
  children,
  className = "",
}) => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref={backHref} />
        </IonButtons>
        <IonTitle>{title}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className={`ion-padding settings-subpage-content ${className}`}>
      <div className="settings-subpage-shell">
        {subtitle && (
          <div className="settings-subpage-intro">
            <p>{subtitle}</p>
          </div>
        )}
        {children}
      </div>
    </IonContent>
  </IonPage>
);

export default SettingsSubpageLayout;
