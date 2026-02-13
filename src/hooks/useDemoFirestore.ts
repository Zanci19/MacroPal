import { useCallback } from "react";
import { doc, onSnapshot, setDoc, getDoc, DocumentReference, arrayUnion as firestoreArrayUnion } from "firebase/firestore";
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
    (path: string, callback: (data: unknown) => void): (() => void) => {
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
    async (path: string, data: unknown, options?: { merge?: boolean }) => {
      if (isDemoMode) {
        // Demo mode - use demo firestore
        demoFirestore.setData(path, data, options);
        return;
      }

      // Normal mode - use real Firestore
      const pathParts = path.split("/");
      const docRef = doc(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as DocumentReference;
      await setDoc(docRef, data as Record<string, unknown>, { merge: options?.merge !== false });
    },
    [isDemoMode]
  );

  /**
   * Array union operation
   */
  const arrayUnionField = useCallback(
    async (path: string, field: string, items: unknown[]) => {
      if (isDemoMode) {
        // Demo mode - use demo firestore array union
        demoFirestore.arrayUnion(path, field, items);
        return;
      }

      // Normal mode - use real Firestore arrayUnion
      const pathParts = path.split("/");
      const docRef = doc(db, pathParts[0], pathParts[1], ...pathParts.slice(2)) as DocumentReference;
      await setDoc(docRef, { [field]: firestoreArrayUnion(...items) }, { merge: true });
    },
    [isDemoMode]
  );

  /**
   * Get document data
   */
  const getDocData = useCallback(
    async (path: string): Promise<unknown> => {
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

  /**
   * Get all documents in a collection
   */
  const getCollectionDocs = useCallback(
    async (collectionPath: string): Promise<Array<{ id: string; data: unknown }>> => {
      if (isDemoMode) {
        // Demo mode - use demo firestore
        return demoFirestore.getCollectionDocs(collectionPath);
      }

      // Normal mode - not implemented in this hook, should use getDocs directly
      throw new Error("getCollectionDocs is only for demo mode. Use Firebase getDocs directly in normal mode.");
    },
    [isDemoMode]
  );

  return {
    isDemoMode,
    onSnapshotDoc,
    setDocData,
    getDocData,
    getCollectionDocs,
    arrayUnionField,
  };
};
