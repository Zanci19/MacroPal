import React, { useCallback, useEffect, useRef, useState } from "react";
import { IonPage, IonContent, IonButton, IonModal } from "@ionic/react";
import "./Start.css";
import logo from "../assets/logo.png";
import Login from "./authentication/Login";
import Register from "./authentication/Register";

const messages = [
  "Your macros. Simplified.",
  "Welcome back.",
  "Let's hit those goals.",
  "You got this.",
  "Hello again, macro master.",
  "Here to help you.",
  "Unleash your potential.",
  "Another day, another win.",
  "Daily tracking made easy.",
  "Focus on your goals.",
  "Consistency is key.",
  "Your progress, your way.",
  "Let's make it happen.",
  "Ready to track?",
  "Your macros, your rules.",
  "Get ready to crush it.",
  "Just a few taps away.",
  "Keep up the great work.",
  "Your journey starts here.",
  "One meal at a time.",
  "Build better habits.",
  "Track smarter, not harder.",
  "Your data, your insights.",
  "Let's do this together.",
  "Macro tracking made simple.",
  "Your goals, our tools."
];

const TYPE_SPEED_MS = 60;
const BACKSPACE_SPEED_MS = 20;
const HOLD_DURATION_MS = 5000;
const MAX_MESSAGE_FONT_PX = 32;
const MIN_MESSAGE_FONT_PX = 14;

const randomMessage = (exclude?: string): string => {
  const pool = messages.filter((message) => message !== exclude);
  const source = pool.length > 0 ? pool : messages;
  return source[Math.floor(Math.random() * source.length)] ?? "";
};

const Start: React.FC = () => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [activeMessage, setActiveMessage] = useState<string>(() => randomMessage());
  const [displayMessage, setDisplayMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [messageFontSize, setMessageFontSize] = useState(MAX_MESSAGE_FONT_PX);
  const messageRef = useRef<HTMLParagraphElement | null>(null);

  const fitMessageToLine = useCallback(() => {
    const el = messageRef.current;
    if (!el) return;

    el.style.fontSize = `${MAX_MESSAGE_FONT_PX}px`;
    const availableWidth = el.clientWidth;
    const requiredWidth = el.scrollWidth;

    if (!availableWidth || !requiredWidth) {
      setMessageFontSize(MAX_MESSAGE_FONT_PX);
      return;
    }

    const scaledSize = Math.floor(
      (MAX_MESSAGE_FONT_PX * availableWidth) / requiredWidth
    );
    const nextSize = Math.max(
      MIN_MESSAGE_FONT_PX,
      Math.min(MAX_MESSAGE_FONT_PX, scaledSize)
    );
    setMessageFontSize(nextSize);
  }, []);

  useEffect(() => {
    if (authModalOpen) return;
    if (!activeMessage) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!isDeleting && displayMessage.length < activeMessage.length) {
      timer = setTimeout(() => {
        setDisplayMessage(activeMessage.slice(0, displayMessage.length + 1));
      }, TYPE_SPEED_MS);
    } else if (!isDeleting && displayMessage.length === activeMessage.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, HOLD_DURATION_MS);
    } else if (isDeleting && displayMessage.length > 0) {
      timer = setTimeout(() => {
        setDisplayMessage(activeMessage.slice(0, displayMessage.length - 1));
      }, BACKSPACE_SPEED_MS);
    } else {
      setActiveMessage(randomMessage(activeMessage));
      setIsDeleting(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeMessage, authModalOpen, displayMessage, isDeleting]);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(fitMessageToLine);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeMessage, fitMessageToLine]);

  useEffect(() => {
    const handleResize = () => {
      fitMessageToLine();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [fitMessageToLine]);

  return (
    <IonPage>
      <IonContent className="start-content" fullscreen>
        <div className="start-shell" role="main" aria-label="MacroPal Start">
          <div className="start-main">
            <section className="start-hero">
              <div className="start-logo-wrap">
                <img src={logo} alt="MacroPal logo" className="start-logo" />
              </div>
              <p className="start-kicker">MACROPAL</p>
              <p
                ref={messageRef}
                className="start-message"
                aria-live="polite"
                style={{ fontSize: `${messageFontSize}px` }}
              >
                {displayMessage || "\u00A0"}
                <span className="start-caret" aria-hidden="true" />
              </p>
            </section>
            <section className="start-actions" aria-label="Get started">
              <IonButton
                size="large"
                className="start-btn start-btn-primary"
                onClick={() => {
                  console.log(`[USER ACTION] Start: Clicked Get Started button`);
                  setAuthMode("register");
                  setAuthModalOpen(true);
                }}
              >
                Create free account
              </IonButton>
              <IonButton
                size="large"
                fill="outline"
                className="start-btn start-btn-secondary"
                onClick={() => {
                  console.log(`[USER ACTION] Start: Clicked I already have an account button`);
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
              >
                Log in
              </IonButton>
            </section>
          </div>

          <footer className="start-footnote">
            Trusted by macro trackers who want simple, consistent results.
          </footer>
        </div>

        <IonModal
          isOpen={authModalOpen}
          onDidDismiss={() => setAuthModalOpen(false)}
          className="start-auth-modal"
          initialBreakpoint={1}
          breakpoints={[0, 1]}
        >
          {authMode === "register" ? (
            <Register
              embedded
              onSwitchToLogin={() => setAuthMode("login")}
            />
          ) : (
            <Login
              embedded
              onSwitchToRegister={() => setAuthMode("register")}
            />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Start;
