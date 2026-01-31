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

addIcons({
  "chevron-down-outline": chevronDownOutline,
});

const container = document.getElementById("root");
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
