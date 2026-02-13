import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, User, IdTokenResult } from "firebase/auth";

/**
 * useDemoAuth - Returns a mock user in demo mode, real auth user otherwise
 */
export const useDemoAuth = () => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      // In demo mode, create a mock user object
      const mockUser = {
        uid: "demo-user-id",
        email: "demo@macropal.app",
        emailVerified: true,
        displayName: "Demo",
        photoURL: null,
        phoneNumber: null,
        providerId: "demo",
        isAnonymous: false,
        metadata: {
          creationTime: new Date().toISOString(),
          lastSignInTime: new Date().toISOString(),
        },
        providerData: [],
        refreshToken: "",
        tenantId: null,
        delete: async () => {},
        getIdToken: async () => "demo-token",
        getIdTokenResult: async () => ({
          token: "demo-token",
          expirationTime: new Date(Date.now() + 3600000).toUTCString(),
          authTime: new Date().toUTCString(),
          issuedAtTime: new Date().toUTCString(),
          signInProvider: "demo",
          signInSecondFactor: null,
          claims: {},
        } as IdTokenResult),
        reload: async () => {},
        toJSON: () => ({}),
      } as User;

      setUser(mockUser);
      setLoading(false);
      return;
    }

    // Normal mode - use Firebase auth
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  return { user, loading, isDemoMode };
};
