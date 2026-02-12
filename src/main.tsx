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

// Ensure PWA elements are fully loaded before rendering the app
defineCustomElements(window).then(() => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}).catch((error) => {
  console.error("Failed to initialize PWA elements:", error);
  // Still render the app even if PWA elements fail to load
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
