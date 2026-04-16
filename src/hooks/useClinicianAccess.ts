import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import type { ClinicianLink, UserRole } from "../types";
import { resolveUserRole } from "../utils/clinician";

type UserAccessState = {
  role: UserRole;
  clinicianLink: ClinicianLink | null;
  loading: boolean;
  displayName: string;
};

export function useClinicianAccess() {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [state, setState] = useState<UserAccessState>({
    role: "user",
    clinicianLink: null,
    loading: true,
    displayName: "",
  });

  useEffect(() => {
    if (isDemoMode) {
      setState({
        role: "user",
        clinicianLink: null,
        loading: false,
        displayName: "Demo User",
      });
      return;
    }

    const current = auth.currentUser;
    if (!current) {
      setState({ role: "user", clinicianLink: null, loading: false, displayName: "" });
      return;
    }

    return onSnapshot(
      doc(db, "users", current.uid),
      (snapshot) => {
        const data = snapshot.data() ?? {};
        setState({
          role: resolveUserRole(data.role),
          clinicianLink: (data.clinicianLink as ClinicianLink | undefined) ?? null,
          loading: false,
          displayName:
            (typeof data.displayName === "string" && data.displayName) ||
            current.displayName ||
            current.email ||
            "User",
        });
      },
      () => {
        setState((prev) => ({ ...prev, loading: false }));
      }
    );
  }, [isDemoMode]);

  return useMemo(() => state, [state]);
}
