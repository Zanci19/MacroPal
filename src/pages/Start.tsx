import React, { useEffect, useRef, useState } from "react";
import { IonPage, IonContent, IonButton, useIonRouter } from "@ionic/react";
import "./Start.css";
import logo from "../assets/logo.png";
import bgVideo from "../assets/start_bg_loop.mp4";

const Start: React.FC = () => {
  const router = useIonRouter();
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoReady) {
      return;
    }

    const video = videoRef.current;
    if (video) {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => undefined);
      }
    }
  }, [videoReady]);

  return (
    <IonPage>
      <IonContent className="start-content" fullscreen>
        <div
          className={`bg-video ${videoReady ? "is-ready" : ""}`}
          aria-hidden="true"
        >
          <video
            ref={videoRef}
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
              onClick={() => router.push("/register")}
            >
              Get Started
            </IonButton>
            <IonButton
              size="large"
              fill="outline"
              className="start-btn start-btn-secondary"
              onClick={() => router.push("/login")}
            >
              I already have an account
            </IonButton>
          </section>

          <footer className="start-footnote">
            Trusted by macro trackers who want simple, consistent results.
          </footer>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Start;
