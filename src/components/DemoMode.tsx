import React, { useEffect, useRef, useState, useCallback } from "react";
import { initializeDemoData } from "../utils/demoDataSeed";
import "./DemoMode.css";

interface DemoModeProps {
  children: React.ReactNode;
}

const INACTIVITY_TIMEOUT_MS = 60000; // 1 minute

const DemoMode: React.FC<DemoModeProps> = ({ children }) => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [showVideo, setShowVideo] = useState(isDemoMode);
  const [isDemoActive, setIsDemoActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearDemoData = useCallback(() => {
    // Use the global clearDemoData if available
    if (typeof window.__clearDemoData === 'function') {
      window.__clearDemoData();
    }
    
    // Clear demo firestore
    if (typeof window.__demoFirestore !== 'undefined') {
      window.__demoFirestore.clear();
    }
    
    // Also clear localStorage keys
    const keysToPreserve = [
      "mp_theme_mode",
      "mp_lazy_load",
      "mp_tab_animations",
    ];
    
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((key) => {
      if (!keysToPreserve.includes(key)) {
        localStorage.removeItem(key);
      }
    });

    // Clear any sessionStorage
    sessionStorage.clear();

    console.log("Demo mode: Cleared user data");
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (!isDemoMode || !isDemoActive) return;

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set new timer
    inactivityTimerRef.current = setTimeout(() => {
      // Reset demo mode - clear data and show video again
      console.log("Demo mode: Inactivity timeout - resetting to video");
      clearDemoData();
      setIsDemoActive(false);
      setShowVideo(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, [isDemoMode, isDemoActive, clearDemoData]);

  const handleClick = useCallback(() => {
    if (!isDemoMode) return;

    if (showVideo) {
      // Transition from video to demo app
      console.log("Demo mode: Transitioning from video to app");
      setShowVideo(false);
      setIsDemoActive(true);
      lastActivityRef.current = Date.now();
      
      // Initialize demo data on first transition
      initializeDemoData();
      
      resetInactivityTimer();
    } else {
      // User is active in the demo
      lastActivityRef.current = Date.now();
      resetInactivityTimer();
    }
  }, [isDemoMode, showVideo, resetInactivityTimer]);

  const handleKeyDown = useCallback(() => {
    if (!isDemoMode || showVideo) return;
    
    // User is active in the demo via keyboard
    lastActivityRef.current = Date.now();
    resetInactivityTimer();
  }, [isDemoMode, showVideo, resetInactivityTimer]);

  useEffect(() => {
    if (!isDemoMode) return;

    // Add event listeners for user activity (clicks and keyboard only)
    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
      
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isDemoMode, handleClick, handleKeyDown]);

  useEffect(() => {
    if (!isDemoMode || !showVideo) return;

    // Play video when shown
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.error("Demo mode: Failed to play video", err);
      });
    }
  }, [isDemoMode, showVideo]);

  // If not in demo mode, just render children normally
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
            Your browser does not support the video tag.
          </video>
          <div className="demo-video-overlay">
            <p className="demo-video-text"><b>Klikni za preizkus aplikacije!</b></p>
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
