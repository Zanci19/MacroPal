import { useCallback } from "react";
import { doc, onSnapshot, setDoc, getDoc, DocumentReference } from "firebase/firestore";
import { db } from "../firebase";
import { demoFirestore } from "../utils/demoFirestore";

/**
 * useDemoFirestore - Returns Firestore operations that work in both demo and normal mode
 */
export const useDemoFirestore = () => {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  /**
   * Subscribe to a document
   */
  const onSnapshotDoc = useCallback(
    (path: string, callback: (data: any) => void): (() => void) => {
      if (isDemoMode) {
        // Demo mode - use demo firestore
        return demoFirestore.onSnapshot(path, callback);
      }

      // Normal mode - use real Firestore
      const pathParts = path.split("/");
      const docRef = doc(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as DocumentReference;

      return onSnapshot(docRef, (snap) => {
        callback(snap.data() || {});
      });
    },
    [isDemoMode]
  );

  /**
   * Set document data
   */
  const setDocData = useCallback(
    async (path: string, data: any) => {
      if (isDemoMode) {
        // Demo mode - use demo firestore
        demoFirestore.setData(path, data);
        return;
      }

      // Normal mode - use real Firestore
      const pathParts = path.split("/");
      const docRef = doc(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as DocumentReference;
      await setDoc(docRef, data, { merge: true });
    },
    [isDemoMode]
  );

  /**
   * Get document data
   */
  const getDocData = useCallback(
    async (path: string): Promise<any> => {
      if (isDemoMode) {
        // Demo mode - use demo firestore
        return demoFirestore.getData(path) || {};
      }

      // Normal mode - use real Firestore
      const pathParts = path.split("/");
      const docRef = doc(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as DocumentReference;
      const snap = await getDoc(docRef);
      return snap.data() || {};
    },
    [isDemoMode]
  );

  return {
    isDemoMode,
    onSnapshotDoc,
    setDocData,
    getDocData,
  };
};
