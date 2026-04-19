import React from "react";
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import changelog from "../data/changelog.json";
import { SETTINGS_ROUTES } from "../utils/settingsRoutes";

type ChangelogEntry = {
  title?: string;
  date?: string;
  changes?: string[];
};

const Changelog: React.FC = () => {
  const entries = (changelog as ChangelogEntry[]) ?? [];

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={SETTINGS_ROUTES.root} />
          </IonButtons>
          <IonTitle>Changelog</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {entries.map((entry, idx) => (
          <IonList key={`${entry.title ?? "entry"}-${idx}`} inset>
            <IonItem lines="full">
              <IonLabel>
                <h2>{entry.title || "Update"}</h2>
                {entry.date && <IonText color="medium">{entry.date}</IonText>}
              </IonLabel>
            </IonItem>
            {(entry.changes || []).map((change, changeIdx) => (
              <IonItem key={`${idx}-${changeIdx}`} lines="none">
                <IonLabel>{change}</IonLabel>
              </IonItem>
            ))}
          </IonList>
        ))}
      </IonContent>
    </IonPage>
  );
};

export default Changelog;
