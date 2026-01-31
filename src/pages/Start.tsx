import React from "react";
import { IonPage, IonContent, IonButton, useIonRouter } from "@ionic/react";
import "./Start.css";
import logo from "../assets/logo.png";

const Start: React.FC = () => {
  const router = useIonRouter();

  return (
    <IonPage>
      <IonContent className="start-content" fullscreen>
        <div className="bg-motion" aria-hidden="true">
          <div className="bg-motion__layer" />
          <div className="bg-motion__layer bg-motion__layer--alt" />
          <div className="bg-motion__scrim" />
        </div>

        <div className="start-shell" role="main" aria-label="MacroPal Start">
          <div className="start-main">
            <section className="start-hero">
              <div className="start-logo-wrap">
                <img src={logo} alt="MacroPal logo" className="start-logo" />
              </div>
              <p className="start-kicker">MACROPAL</p>
              <h1 className="start-title">Your macros. Simplified.</h1>
              <div className="start-highlights">
                <div className="start-highlight">Build balanced plans</div>
                <div className="start-highlight">Log meals in seconds</div>
                <div className="start-highlight">Track trends weekly</div>
              </div>
            </section>

            <section className="start-actions" aria-label="Get started">
              <IonButton
                size="large"
                className="start-btn start-btn-primary"
                onClick={() => {
                  console.log(`[USER ACTION] Start: Clicked Get Started button`);
                  router.push("/register");
                }}
              >
                Get Started
              </IonButton>
              <IonButton
                size="large"
                fill="outline"
                className="start-btn start-btn-secondary"
                onClick={() => {
                  console.log(`[USER ACTION] Start: Clicked I already have an account button`);
                  router.push("/login");
                }}
              >
                I already have an account
              </IonButton>
            </section>
          </div>

          <footer className="start-footnote">
            Trusted by macro trackers who want simple, consistent results.
          </footer>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Start;
