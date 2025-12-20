import React, { useState } from "react";
import { IonPage, IonContent, IonButton, useIonRouter } from "@ionic/react";
import "./Start.css";
import logo from "../assets/logo.png";
import bgVideo from "../assets/start_bg_loop.mp4";

const Start: React.FC = () => {
  const router = useIonRouter();
  const [videoReady, setVideoReady] = useState(false);

  return (
    <IonPage>
      <IonContent className="start-content ion-padding" fullscreen>
        <div
          className={`bg-video ${videoReady ? "is-ready" : ""}`}
          aria-hidden="true"
        >
          <video
            className="bg-video__media"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture
            onCanPlayThrough={() => setVideoReady(true)}
          >
            <source src={bgVideo} type="video/mp4" />
          </video>
          <div className="bg-video__scrim" />
        </div>

        <div className="fixed-center" role="main" aria-label="MacroPal Start">
          <div className="start-card">
            <div className="start-logo-wrap">
              <img src={logo} alt="MacroPal logo" className="start-logo" />
              <span className="start-pill">Powered by habit stacking</span>
            </div>

            <h1 className="start-title app-typography-hero">MacroPal</h1>
            <h2 className="start-subtitle app-typography-subheading">
              Calm, focused tracking built around your day.
            </h2>

            <div className="start-highlights" aria-hidden>
              <div className="start-highlight">
                <div className="start-highlight__dot" />
                Adaptive calorie targets
              </div>
              <div className="start-highlight">
                <div className="start-highlight__dot" />
                Scanner-first logging
              </div>
              <div className="start-highlight">
                <div className="start-highlight__dot" />
                Personalized streaks
              </div>
            </div>

            <div className="start-actions">
              <IonButton
                size="large"
                className="start-btn start-btn-primary"
                onClick={() => router.push("/login")}
              >
                Log In
              </IonButton>
              <IonButton
                size="large"
                fill="outline"
                className="start-btn start-btn-secondary"
                onClick={() => router.push("/register")}
              >
                Create account
              </IonButton>
            </div>
          </div>

        </div>
      </IonContent>
    </IonPage>
  );
};

export default Start;
