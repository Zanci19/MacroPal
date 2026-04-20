import { collection, deleteDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export const clearRecentFoodsHistory = async (uid: string) => {
  const recentRef = collection(db, "users", uid, "recentFoods");
  const snap = await getDocs(recentRef);
  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
};
