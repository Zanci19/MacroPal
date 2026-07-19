import { useCallback, useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import type { PairingCodeDoc, SharedUserEntry, ViewerEntry } from "../types";

/** How long a pairing code stays valid (ms) */
const CODE_TTL_MS = 5 * 60 * 1000;

/** Generate a random 8-digit numeric code */
function generateCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // mod 1e8 gives 0-99999999, pad to 8 digits
  return String(buf[0] % 100_000_000).padStart(8, "0");
}

/**
 * Hook that provides all sharing / pairing functionality.
 * Must be used inside a component where the user is authenticated.
 */
export function useSharing() {
  /* ── state ─────────────────────────────────────── */
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingExpiresAt, setPairingExpiresAt] = useState<Date | null>(null);

  /** Users whose data I am watching (I am a viewer / dietitian) */
  const [sharedUsers, setSharedUsers] = useState<SharedUserEntry[]>([]);

  /** Users who can see MY data (I am a sharer / client) */
  const [viewers, setViewers] = useState<ViewerEntry[]>([]);

  const [loading, setLoading] = useState(true);

  /* ── real-time listener on my user doc ─────────── */
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setSharedUsers([]);
      setViewers([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const data = snap.data() || {};
        setSharedUsers((data.sharedUsers as SharedUserEntry[]) ?? []);
        setViewers((data.viewers as ViewerEntry[]) ?? []);
        setLoading(false);
      },
      (err) => {
        console.error("useSharing snapshot error:", err);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  /* ── generate / refresh pairing code (sharer) ─── */
  const generatePairingCode = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");

    // Delete old code doc if we had one
    if (pairingCode) {
      try {
        await deleteDoc(doc(db, "pairingCodes", pairingCode));
      } catch {
        /* ignore – might already be expired / deleted */
      }
    }

    const code = generateCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MS);

    const codeDoc: PairingCodeDoc = {
      ownerUid: user.uid,
      ownerName: user.displayName || user.email || "Unknown",
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await setDoc(doc(db, "pairingCodes", code), codeDoc);

    setPairingCode(code);
    setPairingExpiresAt(expiresAt);
    return code;
  }, [pairingCode]);

  /* ── redeem a pairing code (viewer / dietitian) ── */
  const redeemPairingCode = useCallback(async (code: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");

    const codeRef = doc(db, "pairingCodes", code);
    const snap = await getDoc(codeRef);

    if (!snap.exists()) throw new Error("Invalid pairing code");

    const data = snap.data() as PairingCodeDoc;
    if (new Date(data.expiresAt) < new Date()) {
      throw new Error("Pairing code has expired");
    }

    if (data.ownerUid === user.uid) {
      throw new Error("You cannot pair with yourself");
    }

    const now = new Date().toISOString();

    // Check for existing pairing to prevent duplicates
    const viewerRef = doc(db, "users", user.uid);
    const viewerSnap = await getDoc(viewerRef);
    const viewerData = viewerSnap.data() || {};
    const existingShared: SharedUserEntry[] = viewerData.sharedUsers ?? [];
    if (existingShared.some((s) => s.uid === data.ownerUid)) {
      // Already paired. Cleanup is best-effort: only the code's owner may
      // delete it, so a redeemer's delete is denied by the rules. The code
      // expires on its own after CODE_TTL_MS.
      await deleteDoc(codeRef).catch(() => {});
      throw new Error("You are already paired with this user");
    }

    // Add the sharer to MY (viewer's) sharedUsers list
    const newSharedUser: SharedUserEntry = {
      uid: data.ownerUid,
      displayName: data.ownerName,
      pairedAt: now,
    };
    await updateDoc(viewerRef, {
      sharedUsers: arrayUnion(newSharedUser),
    });

    // Add myself to the sharer's viewers list
    const sharerRef = doc(db, "users", data.ownerUid);
    const newViewer: ViewerEntry = {
      uid: user.uid,
      displayName: user.displayName || user.email || "Unknown",
      pairedAt: now,
    };
    await updateDoc(sharerRef, {
      viewers: arrayUnion(newViewer),
    });

    // Best-effort cleanup of the consumed code; see the note above. A failure
    // here must not surface as a pairing error, since the pairing succeeded.
    await deleteDoc(codeRef).catch(() => {});

    return newSharedUser;
  }, []);

  /* ── remove a shared user (viewer action) ──────── */
  const removeSharedUser = useCallback(
    async (entry: SharedUserEntry) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      // Remove from MY sharedUsers
      await updateDoc(doc(db, "users", user.uid), {
        sharedUsers: arrayRemove(entry),
      });

      // Remove myself from the sharer's viewers
      // We need to find the matching viewer entry. Because arrayRemove needs
      // an exact match, we query the sharer's user doc first.
      try {
        const sharerSnap = await getDoc(doc(db, "users", entry.uid));
        const sharerData = sharerSnap.data() || {};
        const sharerViewers: ViewerEntry[] = sharerData.viewers ?? [];
        const myEntry = sharerViewers.find((v) => v.uid === user.uid);
        if (myEntry) {
          await updateDoc(doc(db, "users", entry.uid), {
            viewers: arrayRemove(myEntry),
          });
        }
      } catch {
        /* best-effort */
      }
    },
    [],
  );

  /* ── remove a viewer (sharer action) ────────────── */
  const removeViewer = useCallback(
    async (entry: ViewerEntry) => {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in");

      // Remove from MY viewers
      await updateDoc(doc(db, "users", user.uid), {
        viewers: arrayRemove(entry),
      });

      // Remove myself from the viewer's sharedUsers
      try {
        const viewerSnap = await getDoc(doc(db, "users", entry.uid));
        const viewerData = viewerSnap.data() || {};
        const viewerShared: SharedUserEntry[] = viewerData.sharedUsers ?? [];
        const myEntry = viewerShared.find((s) => s.uid === user.uid);
        if (myEntry) {
          await updateDoc(doc(db, "users", entry.uid), {
            sharedUsers: arrayRemove(myEntry),
          });
        }
      } catch {
        /* best-effort */
      }
    },
    [],
  );

  return {
    /** Currently active pairing code (sharer only) */
    pairingCode,
    /** When the current pairing code expires */
    pairingExpiresAt,
    /** Generate / refresh a pairing code */
    generatePairingCode,
    /** Redeem a pairing code entered by the viewer */
    redeemPairingCode,
    /** Users whose data I can see */
    sharedUsers,
    /** Users who can see MY data */
    viewers,
    /** Remove a user from my watch list (viewer action) */
    removeSharedUser,
    /** Remove a viewer from seeing my data (sharer action) */
    removeViewer,
    /** Initial load state */
    loading,
  };
}
