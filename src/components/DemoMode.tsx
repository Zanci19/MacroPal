import React, { useEffect, useRef, useState, useCallback } from "react";
import { initializeDemoData } from "../utils/demoDataSeed";
import "./DemoMode.css";

interface DemoModeProps {
  children: React.ReactNode;
}

const INACTIVITY_TIMEOUT_MS = 60_000;
const MOUSEMOVE_ACTIVITY_THROTTLE_MS = 500;
const DEMO_HOME_PATH = "/app/home";

const DemoMode: React.FC<DemoModeProps> = ({ children }) => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [showVideo, setShowVideo] = useState(isDemoMode);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const showVideoRef = useRef(showVideo);
  const isDemoActiveRef = useRef(isDemoActive);

  showVideoRef.current = showVideo;
  isDemoActiveRef.current = isDemoActive;

  const navigateToDemoHome = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.location.pathname === DEMO_HOME_PATH) return;

    try {
      window.history.replaceState(window.history.state, "", DEMO_HOME_PATH);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      console.error("Demo mode: Failed to navigate to home route", error);
    }
  }, []);

  const clearDemoData = useCallback(() => {
    // Use the global clearDemoData if available.
    try {
      if (typeof window.__clearDemoData === "function") {
        window.__clearDemoData();
      }
    } catch (error) {
      console.error("Demo mode: Failed to clear demo context data", error);
    }

    // Clear demo firestore.
    try {
      if (typeof window.__demoFirestore !== "undefined") {
        window.__demoFirestore.clear();
      }
    } catch (error) {
      console.error("Demo mode: Failed to clear demo firestore data", error);
    }

    // Also clear localStorage keys.
    const keysToPreserve = new Set([
      "mp_theme_mode",
      "mp_lazy_load",
      "mp_tab_animations",
      "mp_debug_overlay",
      "mp_chart_animations",
      "mp_auto_expand_meals",
      "mp_meal_counts",
    ]);

    try {
      const allKeys = Object.keys(localStorage);
      allKeys.forEach((key) => {
        if (!keysToPreserve.has(key)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Demo mode: Failed to clear localStorage keys", error);
    }

    // Clear sessionStorage.
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error("Demo mode: Failed to clear sessionStorage", error);
    }

    if (videoRef.current) {
      videoRef.current.pause();
      try {
        videoRef.current.currentTime = 0;
      } catch {
        // Ignore browsers that block setting currentTime while media is not seekable yet.
      }
    }

    console.log("Demo mode: Cleared user data");
  }, []);

  const resetInactivityTimer = useCallback((active = isDemoActiveRef.current) => {
    if (!isDemoMode || !active) return;

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set new timer
    inactivityTimerRef.current = setTimeout(() => {
      // Reset demo mode - clear data and show video again.
      console.log("Demo mode: Inactivity timeout - resetting to video");
      clearDemoData();
      isDemoActiveRef.current = false;
      showVideoRef.current = true;
      setIsDemoActive(false);
      setShowVideo(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, [isDemoMode, clearDemoData]);

  const activateDemoApp = useCallback(() => {
    if (!isDemoMode || !showVideoRef.current) return;

    console.log("Demo mode: Transitioning from video to app");
    navigateToDemoHome();

    showVideoRef.current = false;
    isDemoActiveRef.current = true;
    setShowVideo(false);
    setIsDemoActive(true);

    lastActivityRef.current = Date.now();
    initializeDemoData();
    resetInactivityTimer(true);
  }, [isDemoMode, navigateToDemoHome, resetInactivityTimer]);

  const markDemoActivity = useCallback(
    (eventType: "pointerdown" | "keydown" | "mousemove" | "scroll") => {
      if (!isDemoMode) return;

      if (showVideoRef.current) {
        if (eventType === "pointerdown" || eventType === "keydown") {
          activateDemoApp();
        }
        return;
      }

      if (!isDemoActiveRef.current) return;

      const now = Date.now();
      if (
        (eventType === "mousemove" || eventType === "scroll") &&
        now - lastActivityRef.current < MOUSEMOVE_ACTIVITY_THROTTLE_MS
      ) {
        return;
      }

      lastActivityRef.current = now;
      resetInactivityTimer(true);
    },
    [activateDemoApp, isDemoMode, resetInactivityTimer]
  );

  useEffect(() => {
    if (!isDemoMode) return;

    // Add event listeners for user activity.
    const onPointerDown = () => markDemoActivity("pointerdown");
    const onKeyDown = () => markDemoActivity("keydown");
    const onMouseMove = () => markDemoActivity("mousemove");
    const onScroll = () => markDemoActivity("scroll");

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);

      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isDemoMode, markDemoActivity]);

  useEffect(() => {
    if (!isDemoMode || !showVideo) return;

    // Play video when shown
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Demo mode: Failed to play video", err);
      });
    }
  }, [isDemoMode, showVideo]);

  // If not in demo mode, render children normally (did somebody say children??11!1?)
  if (!isDemoMode) {
    return <>{children}</>;
  }

  // Demo mode active - show video or app
  return (
    <>
      {showVideo ? (
        <div className="demo-video-container demo-video-container--landscape">
          <video
            ref={videoRef}
            className="demo-video"
            loop
            muted
            playsInline
            autoPlay
          >
            <source src="/assets/demo-loop.mp4" type="video/mp4" />
            Nepodprt video element v brskalniku.
          </video>
          <div className="demo-video-overlay" role="status" aria-live="polite">
            <p className="demo-video-text">
              <strong>Pritisni kjerkoli za predogled aplikacije!</strong>
            </p>
            <p className="demo-video-subtext">Aplikacija se sama ponovno zažene po 1 minuti brez aktivnosti.</p>
          </div>
        </div>
      ) : (
        <div className="demo-app-container demo-app-container--portrait">
          <div className="demo-app-frame">{children}</div>
        </div>
      )}
    </>
  );
};

export default DemoMode;
