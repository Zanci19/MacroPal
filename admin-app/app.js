import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_API_KEY",
  authDomain: "macropal-zanci19.firebaseapp.com",
  projectId: "macropal-zanci19",
  storageBucket: "macropal-zanci19.firebasestorage.app",
  messagingSenderId: "621449190647",
  appId: "1:621449190647:web:3e13f7c1de1d0f254587f2",
  measurementId: "G-HSKWTMK5WZ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authStatus = document.getElementById("authStatus");
const uidStatus = document.getElementById("uidStatus");

const uidInput = document.getElementById("uidInput");
const setUidBtn = document.getElementById("setUidBtn");

const profileJson = document.getElementById("profileJson");
const loadProfileBtn = document.getElementById("loadProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const mealDate = document.getElementById("mealDate");
const mealsJson = document.getElementById("mealsJson");
const loadMealsBtn = document.getElementById("loadMealsBtn");
const saveMealsBtn = document.getElementById("saveMealsBtn");

const customPath = document.getElementById("customPath");
const customJson = document.getElementById("customJson");
const loadCustomBtn = document.getElementById("loadCustomBtn");
const saveCustomBtn = document.getElementById("saveCustomBtn");

const state = {
  uid: "",
};

const pretty = (data) => JSON.stringify(data ?? {}, null, 2);

const parseJson = (text) => {
  if (!text.trim()) return {};
  return JSON.parse(text);
};

const requireUid = () => {
  if (!state.uid) {
    uidStatus.textContent = "Please load a user UID first.";
    uidStatus.style.color = "#b91c1c";
    throw new Error("UID missing");
  }
};

const loadDoc = async (ref, target) => {
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    target.value = "{}";
    return;
  }
  target.value = pretty(snap.data());
};

const saveDoc = async (ref, source) => {
  const payload = parseJson(source.value);
  await setDoc(ref, payload, { merge: false });
};

const pathSegments = (value) =>
  value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const toDocRef = (segments) => doc(db, "users", state.uid, ...segments);

setUidBtn.addEventListener("click", () => {
  state.uid = uidInput.value.trim();
  if (!state.uid) {
    uidStatus.textContent = "Please enter a UID.";
    uidStatus.style.color = "#b91c1c";
    return;
  }
  uidStatus.textContent = `Loaded user: ${state.uid}`;
  uidStatus.style.color = "#059669";
});

loadProfileBtn.addEventListener("click", async () => {
  try {
    requireUid();
    await loadDoc(doc(db, "users", state.uid), profileJson);
  } catch (error) {
    console.error(error);
  }
});

saveProfileBtn.addEventListener("click", async () => {
  try {
    requireUid();
    await saveDoc(doc(db, "users", state.uid), profileJson);
  } catch (error) {
    alert(`Profile save failed: ${error.message}`);
  }
});

loadMealsBtn.addEventListener("click", async () => {
  try {
    requireUid();
    const dateKey = mealDate.value.trim();
    if (!dateKey) {
      alert("Enter a date key first.");
      return;
    }
    await loadDoc(doc(db, "users", state.uid, "foods", dateKey), mealsJson);
  } catch (error) {
    console.error(error);
  }
});

saveMealsBtn.addEventListener("click", async () => {
  try {
    requireUid();
    const dateKey = mealDate.value.trim();
    if (!dateKey) {
      alert("Enter a date key first.");
      return;
    }
    await saveDoc(doc(db, "users", state.uid, "foods", dateKey), mealsJson);
  } catch (error) {
    alert(`Meal save failed: ${error.message}`);
  }
});

loadCustomBtn.addEventListener("click", async () => {
  try {
    requireUid();
    const segments = pathSegments(customPath.value);
    if (segments.length < 2 || segments.length % 2 !== 0) {
      alert("Enter a valid document path like collection/doc.");
      return;
    }
    await loadDoc(toDocRef(segments), customJson);
  } catch (error) {
    console.error(error);
  }
});

saveCustomBtn.addEventListener("click", async () => {
  try {
    requireUid();
    const segments = pathSegments(customPath.value);
    if (segments.length < 2 || segments.length % 2 !== 0) {
      alert("Enter a valid document path like collection/doc.");
      return;
    }
    await saveDoc(toDocRef(segments), customJson);
  } catch (error) {
    alert(`Custom document save failed: ${error.message}`);
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    authStatus.textContent = `Auth: signed in as ${user.isAnonymous ? "anonymous" : user.uid}`;
    authStatus.style.background = "#dcfce7";
    authStatus.style.color = "#166534";
  } else {
    authStatus.textContent = "Auth: signed out";
    authStatus.style.background = "#fee2e2";
    authStatus.style.color = "#991b1b";
  }
});

signInAnonymously(auth).catch((error) => {
  authStatus.textContent = `Auth error: ${error.message}`;
  authStatus.style.background = "#fee2e2";
  authStatus.style.color = "#991b1b";
});
