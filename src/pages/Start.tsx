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

        <div className="start-shell" role="main" aria-label="MacroPal Start">
          <header className="start-header">
            <img src={logo} alt="MacroPal logo" className="start-logo" />
            <div className="start-brand">
              <p className="start-kicker">MacroPal</p>
              <p className="start-tagline">Macros that move with you</p>
            </div>
          </header>

          <section className="start-hero">
            <h1 className="start-title">
              Build your nutrition plan with confidence.
            </h1>
            <p className="start-subtitle">
              Track meals, balance targets, and stay on pace with a streamlined
              daily view built for your phone.
            </p>

            <div className="start-highlights" aria-label="MacroPal highlights">
              <div className="start-highlight">
                <span className="highlight-title">Smart targets</span>
                <span className="highlight-body">
                  Adaptive macros that match your goals.
                </span>
              </div>
              <div className="start-highlight">
                <span className="highlight-title">Quick logging</span>
                <span className="highlight-body">
                  Tap-to-add meals and saved favorites.
                </span>
              </div>
              <div className="start-highlight">
                <span className="highlight-title">Weekly insights</span>
                <span className="highlight-body">
                  Clear trends and progress summaries.
                </span>
              </div>
            </div>
          </section>

          <div className="start-actions">
            <IonButton
              size="large"
              className="start-btn start-btn-primary"
              onClick={() => router.push("/login")}
            >
              Log in
            </IonButton>
            <IonButton
              size="large"
              fill="outline"
              className="start-btn start-btn-secondary"
              onClick={() => router.push("/register")}
            >
              Create account
            </IonButton>
            <p className="start-footnote">
              By continuing, you agree to MacroPal&#39;s Terms &amp; Privacy
              Policy.
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Start;
