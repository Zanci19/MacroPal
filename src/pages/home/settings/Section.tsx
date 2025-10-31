import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonList, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
  IonToggle, IonButton
} from "@ionic/react";
import { useParams } from "react-router";
import { SETTINGS_SECTIONS } from "../Settings";

type Params = { section: string };

const SectionTitle = (key: string) => {
  const found = SETTINGS_SECTIONS.find(s => s.key === key);
  return found?.label ?? "Settings";
};

const SettingsSection: React.FC = () => {
  const { section } = useParams<Params>();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>{SectionTitle(section)}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {section === "account" && (
          <>
            <IonList inset>
              <IonItem>
                <IonLabel position="stacked">Email</IonLabel>
                <IonInput type="email" placeholder="you@example.com" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Display name</IonLabel>
                <IonInput placeholder="Your name" />
              </IonItem>
            </IonList>
            <IonButton expand="block" className="ion-margin-top">Save changes</IonButton>
          </>
        )}

        {section === "goals" && (
          <>
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
          </>
        )}

        {section === "notifications" && (
          <IonList inset>
            <IonItem>
              <IonLabel>Daily summary reminder</IonLabel>
              <IonToggle checked />
            </IonItem>
            <IonItem>
              <IonLabel>Push notifications</IonLabel>
              <IonToggle />
            </IonItem>
          </IonList>
        )}

        {section === "privacy" && (
          <IonList inset>
            <IonItem>
              <IonLabel>Share anonymous analytics</IonLabel>
              <IonToggle />
            </IonItem>
            <IonItem>
              <IonLabel>Make diary private</IonLabel>
              <IonToggle />
            </IonItem>
          </IonList>
        )}

        {section === "security" && (
          <>
            <IonList inset>
              <IonItem>
                <IonLabel position="stacked">Current password</IonLabel>
                <IonInput type="password" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">New password</IonLabel>
                <IonInput type="password" />
              </IonItem>
              <IonItem>
                <IonLabel position="stacked">Confirm new password</IonLabel>
                <IonInput type="password" />
              </IonItem>
            </IonList>
            <IonButton expand="block" className="ion-margin-top">Update password</IonButton>
          </>
        )}

        {section === "appearance" && (
          <IonList inset>
            <IonItem>
              <IonLabel>Theme</IonLabel>
              <IonSelect interface="popover" value="system">
                <IonSelectOption value="light">Light</IonSelectOption>
                <IonSelectOption value="dark">Dark</IonSelectOption>
                <IonSelectOption value="system">System</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>
        )}

        {section === "units" && (
          <IonList inset>
            <IonItem>
              <IonLabel>Energy</IonLabel>
              <IonSelect interface="popover" value="kcal">
                <IonSelectOption value="kcal">kcal</IonSelectOption>
                <IonSelectOption value="kJ">kJ</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Weight</IonLabel>
              <IonSelect interface="popover" value="kg">
                <IonSelectOption value="kg">kg</IonSelectOption>
                <IonSelectOption value="lb">lb</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Language</IonLabel>
              <IonSelect interface="popover" value="en">
                <IonSelectOption value="en">English</IonSelectOption>
                <IonSelectOption value="sl">Slovenščina</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>
        )}

        {section === "data" && (
          <IonList inset>
            <IonItem button detail onClick={() => alert("Export CSV…")}>
              <IonLabel>Export diary (CSV)</IonLabel>
            </IonItem>
            <IonItem button detail onClick={() => alert("Export JSON…")}>
              <IonLabel>Export diary (JSON)</IonLabel>
            </IonItem>
            <IonItem button detail onClick={() => alert("Import…")}>
              <IonLabel>Import from file</IonLabel>
            </IonItem>
          </IonList>
        )}

        {section === "integrations" && (
          <IonList inset>
            <IonItem button detail onClick={() => alert("Connect Google Fit…")}>
              <IonLabel>Google Fit</IonLabel>
            </IonItem>
            <IonItem button detail onClick={() => alert("Connect Apple Health…")}>
              <IonLabel>Apple Health</IonLabel>
            </IonItem>
          </IonList>
        )}

        {section === "about" && (
          <IonList inset>
            <IonItem>
              <IonLabel>
                <h2>MacroPal</h2>
                <p>Version 0.1.0</p>
              </IonLabel>
            </IonItem>
            <IonItem button detail onClick={() => alert("Open licenses…")}>
              <IonLabel>Open-source licenses</IonLabel>
            </IonItem>
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default SettingsSection;
