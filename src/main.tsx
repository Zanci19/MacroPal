import React from "react";
import { createRoot } from "react-dom/client";
import { addIcons } from "ionicons";
import { chevronDownOutline } from "ionicons/icons";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./theme/variables.css";
import "./theme/theme.css";

import { setupPlatform } from "./utils/platformSetup";
setupPlatform();

// Initialize PWA Elements for Capacitor plugins (Camera, etc.) on web
import { defineCustomElements } from '@ionic/pwa-elements/loader';

addIcons({
  "chevron-down-outline": chevronDownOutline,
});

const container = document.getElementById("root");
const root = createRoot(container!);

const renderApp = () => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize PWA elements and ensure they're ready before rendering the app
const initializePWAElements = async () => {
  try {
    console.log('[PWA Elements] Initializing...');
    await defineCustomElements(window);
    console.log('[PWA Elements] Initialized successfully');
    
    // Apply the camera patch after PWA elements are loaded
    await import('./utils/capacitorCameraPatch');
    
    return true;
  } catch (error) {
    console.error('[PWA Elements] Failed to initialize:', error);
    return false;
  }
};

renderApp();

// Initialize PWA elements in the background so startup render is not blocked
void initializePWAElements().catch((error) => {
  console.error('[PWA Elements] Critical error:', error);
});
