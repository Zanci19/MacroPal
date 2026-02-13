import { auth } from "../firebase";

/**
 * Get the current user, works in both demo and normal mode
 */
export const getCurrentUser = () => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  
  if (isDemoMode) {
    // Return mock demo user
    return {
      uid: "demo-user-id",
      email: "demo@macropal.app",
      emailVerified: true,
      displayName: "Demo",
      photoURL: null,
      phoneNumber: null,
      providerId: "demo",
      isAnonymous: false,
    };
  }
  
  // Return real Firebase auth user
  return auth.currentUser;
};
