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
      <IonContent className="start-content ion-padding">
        {/* Background video (fixed, behind everything) */}
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

          {/* optional dark overlay for contrast */}
          <div className="bg-video__scrim" />
        </div>

        {/* Foreground content (fixed, centered) */}
        <div
          className="fixed-center"
          role="main"
          aria-label="MacroPal Start"
        >
          <img src={logo} alt="MacroPal logo" className="start-logo" />
          <h1 className="start-title">MacroPal</h1>
          <h2 className="start-subtitle">Your macros. Simplified.</h2>

          <div className="start-actions">
            <IonButton
              size="large"
              className="start-btn"
              onClick={() => router.push("/login")}
            >
              Login
            </IonButton>
            <IonButton
              size="large"
              fill="outline"
              className="start-btn"
              onClick={() => router.push("/register")}
            >
              Register
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Start;
