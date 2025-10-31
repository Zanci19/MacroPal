import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
} from "@ionic/react";
import {
  addCircleOutline,
  sparklesOutline,
  scanOutline,
  listOutline,
  timeOutline,
  starOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";

const Left: React.FC = () => {
  const history = useHistory();

  const goAdd = (meal: "breakfast" | "lunch" | "dinner" | "snacks") =>
    history.push(`/add-food?meal=${meal}`);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Quick Actions</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Meal shortcuts */}
        <IonGrid>
          <IonRow>
            <IonCol size="6">
              <IonCard button onClick={() => goAdd("breakfast")}>
                <IonCardHeader>
                  <IonCardTitle>Breakfast</IonCardTitle>
                  <IonCardSubtitle>🌅 Add food</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonButton expand="block" fill="outline">
                    <IonIcon icon={addCircleOutline} slot="start" />
                    Add to Breakfast
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard button onClick={() => goAdd("lunch")}>
                <IonCardHeader>
                  <IonCardTitle>Lunch</IonCardTitle>
                  <IonCardSubtitle>🌞 Add food</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonButton expand="block" fill="outline">
                    <IonIcon icon={addCircleOutline} slot="start" />
                    Add to Lunch
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          <IonRow>
            <IonCol size="6">
              <IonCard button onClick={() => goAdd("dinner")}>
                <IonCardHeader>
                  <IonCardTitle>Dinner</IonCardTitle>
                  <IonCardSubtitle>🌇 Add food</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonButton expand="block" fill="outline">
                    <IonIcon icon={addCircleOutline} slot="start" />
                    Add to Dinner
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard button onClick={() => goAdd("snacks")}>
                <IonCardHeader>
                  <IonCardTitle>Snacks</IonCardTitle>
                  <IonCardSubtitle>🌙 Add food</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <IonButton expand="block" fill="outline">
                    <IonIcon icon={addCircleOutline} slot="start" />
                    Add to Snacks
                  </IonButton>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Utilities you can wire up later */}
        <IonGrid>
          <IonRow>
            <IonCol size="6">
              <IonCard
                button
                onClick={() => {
                  // placeholder: later route to /scan or show a modal
                  alert("Barcode scan coming soon");
                }}
              >
                <IonCardHeader>
                  <IonCardTitle>Scan Barcode</IonCardTitle>
                  <IonCardSubtitle>
                    <IonIcon icon={scanOutline} /> Quick add
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  Use camera to find products quickly.
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="6">
              <IonCard
                button
                onClick={() => {
                  // placeholder: later route to /templates
                  alert("Templates coming soon");
                }}
              >
                <IonCardHeader>
                  <IonCardTitle>Templates</IonCardTitle>
                  <IonCardSubtitle>
                    <IonIcon icon={sparklesOutline} /> Saved meals
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  Save & reuse common meals.
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          <IonRow>
            <IonCol size="6">
              <IonCard
                button
                onClick={() => {
                  // placeholder: later route to /recent
                  alert("Recent foods coming soon");
                }}
              >
                <IonCardHeader>
                  <IonCardTitle>Recent</IonCardTitle>
                  <IonCardSubtitle>
                    <IonIcon icon={timeOutline} /> Last used
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  Re-log foods you used recently.
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="6">
              <IonCard
                button
                onClick={() => {
                  // placeholder: later route to /favorites
                  alert("Favorites coming soon");
                }}
              >
                <IonCardHeader>
                  <IonCardTitle>Favorites</IonCardTitle>
                  <IonCardSubtitle>
                    <IonIcon icon={starOutline} /> Pin foods
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  Pin your go-to foods for 1-tap add.
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* Grocery list idea (optional future)
        <IonCard button onClick={() => history.push('/groceries')}>
          <IonCardHeader>
            <IonCardTitle>Groceries</IonCardTitle>
            <IonCardSubtitle>
              <IonIcon icon={listOutline} /> Checklist
            </IonCardSubtitle>
          </IonCardHeader>
          <IonCardContent>
            Auto-add from templates & plan your week.
          </IonCardContent>
        </IonCard>
        */}
      </IonContent>
    </IonPage>
  );
};

export default Left;
