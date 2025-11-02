import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../firebase";

type AuthGateState = {
  user: User | null;
  loading: boolean;
  error: Error | null;
};

export function useAuthGate(): AuthGateState {
  const [state, setState] = useState<AuthGateState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => setState({ user, loading: false, error: null }),
      (error) => setState({ user: null, loading: false, error })
    );

    return () => unsub();
  }, []);

  return state;
}
