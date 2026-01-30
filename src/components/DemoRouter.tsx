import React from "react";
import { Redirect } from "react-router";

/**
 * DemoRouter - Handles routing logic for demo mode
 * When demo mode is active, this component bypasses authentication
 * and routes directly to the home page
 */
const DemoRouter: React.FC = () => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  if (isDemoMode) {
    // In demo mode, always redirect to home
    return <Redirect to="/app/home" />;
  }

  // Normal mode - redirect to check-login
  return <Redirect to="/check-login" />;
};

export default DemoRouter;
