import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonButton,
  IonIcon,
  IonAlert,
  IonToast,
  IonText,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonActionSheet,
} from "@ionic/react";
import {
  personCircleOutline,
  logOutOutline,
  mailOutline,
  cafeOutline,
  trashOutline,
  colorPaletteOutline,
  informationCircleOutline,
  keyOutline,
  newspaperOutline,
  chevronDownOutline,
} from "ionicons/icons";
import { auth, db, storage, trackEvent } from "../../firebase";
import {
  sendEmailVerification,
  signOut,
  deleteUser,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useHistory } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, getDocs, deleteDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import "./Settings.css";
import {
  applyAnimationPreference,
  applyChartAnimationPreference,
  applyAutoExpandMealsPreference,
  applyDebugOverlayPreference,
  applyLazyLoadPreference,
  applyMealCountPreference,
  applyTheme,
  getAnimationPreference,
  getChartAnimationPreference,
  getAutoExpandMealsPreference,
  getDebugOverlayPreference,
  getLazyLoadPreference,
  getMealCountPreference,
  getStoredThemeMode,
  THEME_MODES,
  type ThemeMode,
} from "../../utils/preferences";
import { normalizePhotoUrl, resizeImageFile, sanitizeFileName } from "../../utils/image";

type SmartDietStyle = "none" | "vegetarian" | "vegan" | "pescatarian";
type SmartMacroFocus = "balanced" | "high-protein" | "low-carb";

interface UserProfile {
  smartRecommendationEnabled?: boolean;
  smartRecommendationProfile?: {
    dietStyle?: string;
    macroFocus?: string;
  };
  showWellnessTip?: boolean;
  showAchievements?: boolean;
  showRecentItems?: boolean;
  showRecentSearches?: boolean;
  photoUrl?: string;
  themeMode?: string;
  tabAnimationsEnabled?: boolean;
  chartAnimationsEnabled?: boolean;
  debugOverlayEnabled?: boolean;
  lazyLoadEnabled?: boolean;
}

interface UserData {
  profile?: UserProfile;
}

const Settings: React.FC = () => {
  const history = useHistory();
  const user = auth.currentUser;
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = React.useState(false);

  const [smartRecommendationEnabled, setSmartRecommendationEnabled] = React.useState(true);
  const [smartDietStyle, setSmartDietStyle] = React.useState<SmartDietStyle>("none");
  const [smartMacroFocus, setSmartMacroFocus] = React.useState<SmartMacroFocus>("balanced");
  const [showRandomQuoteEnabled, setShowRandomQuoteEnabled] = React.useState(true);
  const [showAchievementsEnabled, setShowAchievementsEnabled] = React.useState(true);
  const [showRecentItemsEnabled, setShowRecentItemsEnabled] = React.useState(true);
  const [showRecentSearchesEnabled, setShowRecentSearchesEnabled] = React.useState(true);
  const [confirmClearRecent, setConfirmClearRecent] = React.useState(false);
  const [clearingRecent, setClearingRecent] = React.useState(false);
  const [showPhotoActions, setShowPhotoActions] = React.useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = React.useState<string | null>(null);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(() => {
    return getStoredThemeMode();
  });
  const [tabAnimationsEnabled, setTabAnimationsEnabled] = React.useState<boolean>(() => {
    return getAnimationPreference();
  });
  const [chartAnimationsEnabled, setChartAnimationsEnabled] = React.useState<boolean>(() => {
    return getChartAnimationPreference();
  });
  const [debugOverlayEnabled, setDebugOverlayEnabled] = React.useState<boolean>(() => {
    return getDebugOverlayPreference();
  });
  const [lazyLoadEnabled, setLazyLoadEnabled] = React.useState<boolean>(() => {
    return getLazyLoadPreference();
  });
  const [autoExpandMealsEnabled, setAutoExpandMealsEnabled] = React.useState<boolean>(() => {
    return getAutoExpandMealsPreference();
  });
  const [showMealCountsEnabled, setShowMealCountsEnabled] = React.useState<boolean>(() => {
    return getMealCountPreference();
  });
  const [showAbout, setShowAbout] = React.useState(false);
  const galleryInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleThemeChange = async (newTheme: ThemeMode) => {
    console.log(`[USER ACTION] Settings: Theme changed`, { newTheme });
    setThemeMode(newTheme);
    applyTheme(newTheme);

    const current = auth.currentUser;
    if (!current) return;

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.themeMode": newTheme,
      });

      trackEvent("settings_theme_change", {
        uid: current.uid,
        theme: newTheme,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to save theme preference:", err);
      setToast({
        show: true,
        message: err?.message || "Could not save theme preference.",
        color: "danger",
      });
    }
  };

  const saveSmartRecommendationProfile = async (
    updates: Partial<{ dietStyle: SmartDietStyle; macroFocus: SmartMacroFocus }>
  ) => {
    const current = auth.currentUser;
    if (!current) return;

    const nextProfile = {
      dietStyle: updates.dietStyle ?? smartDietStyle,
      macroFocus: updates.macroFocus ?? smartMacroFocus,
    };

    try {
      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.smartRecommendationProfile": nextProfile,
      });
      trackEvent("settings_smart_recommendation_profile_update", {
        uid: current.uid,
        ...nextProfile,
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to save smart recommendation profile:", err);
      setToast({
        show: true,
        message: err?.message || "Could not update smart recommendations.",
        color: "danger",
      });
    }
  };

  const handleVerifyEmail = async () => {
    console.log(`[USER ACTION] Settings: Send verification email clicked`);
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setToast({
        show: true,
        message: "Verification email sent.",
        color: "success",
      });
    } catch (error: unknown) {
      const e = error as Error;
      setToast({
        show: true,
        message: e?.message || "Could not send verification email.",
        color: "danger",
      });
    }
  };

  const handleResetPassword = async () => {
    console.log(`[USER ACTION] Settings: Send password reset email clicked`);
    const email = auth.currentUser?.email || "";
    if (!email) {
      setToast({
        show: true,
        message: "No email on account.",
        color: "danger",
      });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setToast({
        show: true,
        message: "Password reset email sent.",
        color: "success",
      });
    } catch (error: unknown) {
      const e = error as Error;
      setToast({
        show: true,
        message: e?.message || "Could not send password reset email.",
        color: "danger",
      });
    }
  };

  const handleDeleteAccount = async () => {
    console.log(`[USER ACTION] Settings: Delete account confirmed and executing`);
    if (!auth.currentUser) return;
    try {
      await deleteUser(auth.currentUser);
      setToast({ show: true, message: "Account deleted.", color: "success" });
      history.replace("/login");
    } catch (error: unknown) {
      const e = error as Error;
      setToast({
        show: true,
        message:
          e?.message ||
          "Deletion failed. You may need to log out and back in, then try again (recent login required).",
        color: "danger",
      });
    }
  };

  const handleClearRecentFoods = async () => {
    console.log(`[USER ACTION] Settings: Clear recent foods confirmed and executing`);
    if (!auth.currentUser) return;
    try {
      setClearingRecent(true);
      const recentRef = collection(
        db,
        "users",
        auth.currentUser.uid,
        "recentFoods"
      );
      const snap = await getDocs(recentRef);

      const deletions = snap.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletions);

      setToast({
        show: true,
        message: "Recent foods history cleared.",
        color: "success",
      });
    } catch (error: unknown) {
      const e = error as Error;
      setToast({
        show: true,
        message: e?.message || "Could not clear recent foods.",
        color: "danger",
      });
    } finally {
      setClearingRecent(false);
    }
  };

  const handlePhotoChange = async (file?: File | null) => {
    console.log(`[USER ACTION] Settings: Photo file selected for upload`, { fileType: file?.type, fileSize: file?.size });
    if (!file || !auth.currentUser) return;

    try {
      const resizedBlob = await resizeImageFile(file);
      const storagePath = `users/${auth.currentUser.uid}/profile-photos/${Date.now()}_${sanitizeFileName(
        file.name
      )}.jpg`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, resizedBlob, {
        contentType: resizedBlob.type,
      });
      const downloadURL = await getDownloadURL(storageRef);
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        "profile.photoUrl": downloadURL,
      });
      setProfilePhotoUrl(downloadURL);
      trackEvent("settings_profile_photo_update", { uid: auth.currentUser?.uid });
      setToast({ show: true, message: "Profile photo updated.", color: "success" });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to save profile photo:", err);
      setToast({
        show: true,
        message: err?.message || "Could not update profile photo.",
        color: "danger",
      });
    }
  };

  const handleCopyDiagnostics = async () => {
    console.log(`[USER ACTION] Settings: Copy diagnostics to clipboard clicked`);
    const prefersReducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const prefersDark =
      window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const connection =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } })
            .connection
        : undefined;
    
    // Get localStorage size
    let localStorageSize = 0;
    try {
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          localStorageSize += localStorage[key].length + key.length;
        }
      }
    } catch {
      localStorageSize = -1;
    }

    // Get memory info
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number; totalJSHeapSize: number } }).memory;
    const memoryInfo = memory ? {
      usedJSHeapSizeMB: (memory.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      jsHeapSizeLimitMB: (memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2),
      totalJSHeapSizeMB: (memory.totalJSHeapSize / (1024 * 1024)).toFixed(2),
    } : null;

    // Get current user info
    const currentUser = auth.currentUser;
    const userInfo = currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL ? 'set' : 'not set',
      creationTime: currentUser.metadata.creationTime,
      lastSignInTime: currentUser.metadata.lastSignInTime,
      providerData: currentUser.providerData.map(p => ({
        providerId: p.providerId,
        uid: p.uid,
      })),
    } : null;

    // Get performance metrics
    const performanceMetrics = {
      navigation: performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming,
      resources: performance.getEntriesByType('resource').length,
      marks: performance.getEntriesByType('mark').length,
      measures: performance.getEntriesByType('measure').length,
    };

    // Get screen and viewport info
    const screenInfo = {
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth,
        orientation: window.screen.orientation?.type,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      visualViewport: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        offsetLeft: window.visualViewport.offsetLeft,
        offsetTop: window.visualViewport.offsetTop,
        pageLeft: window.visualViewport.pageLeft,
        pageTop: window.visualViewport.pageTop,
        scale: window.visualViewport.scale,
      } : null,
    };

    // Get app preferences
    const preferences = {
      theme: getStoredThemeMode(),
      tabAnimations: getAnimationPreference(),
      debugOverlay: getDebugOverlayPreference(),
      lazyLoad: getLazyLoadPreference(),
      chartAnimations: getChartAnimationPreference(),
      autoExpandMeals: getAutoExpandMealsPreference(),
      showMealCounts: getMealCountPreference(),
    };

    // Get browser capabilities
    const capabilities = {
      serviceWorker: 'serviceWorker' in navigator,
      indexedDB: 'indexedDB' in window,
      localStorage: typeof Storage !== 'undefined',
      sessionStorage: typeof Storage !== 'undefined',
      webGL: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
          return false;
        }
      })(),
      webGL2: (() => {
        try {
          const canvas = document.createElement('canvas');
          return !!canvas.getContext('webgl2');
        } catch {
          return false;
        }
      })(),
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    };

    const payload = {
      timestamp: new Date().toISOString(),
      appVersion: '0.0.1', // From package.json
      currentURL: window.location.href,
      currentPath: window.location.pathname,
      referrer: document.referrer,
      
      // User info
      user: userInfo,
      
      // Device info
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      
      // Screen & viewport
      ...screenInfo,
      
      // Preferences
      preferences,
      prefersReducedMotion,
      prefersDark,
      
      // Network
      connection: {
        effectiveType: connection?.effectiveType,
        downlink: connection?.downlink,
        rtt: (connection as { rtt?: number })?.rtt,
        saveData: (connection as { saveData?: boolean })?.saveData,
      },
      
      // Performance
      memory: memoryInfo,
      performance: {
        navigationStart: performanceMetrics.navigation?.startTime,
        domContentLoadedEventEnd: performanceMetrics.navigation?.domContentLoadedEventEnd,
        loadEventEnd: performanceMetrics.navigation?.loadEventEnd,
        resourceCount: performanceMetrics.resources,
        marksCount: performanceMetrics.marks,
        measuresCount: performanceMetrics.measures,
      },
      
      // Storage
      localStorageSizeBytes: localStorageSize,
      localStorageSizeKB: (localStorageSize / 1024).toFixed(2),
      
      // Capabilities
      capabilities,
      
      // DOM info
      domInfo: {
        documentElementCount: document.getElementsByTagName('*').length,
        scriptsCount: document.scripts.length,
        imagesCount: document.images.length,
        linksCount: document.links.length,
        title: document.title,
      },
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setToast({ show: true, message: "Diagnostics copied to clipboard.", color: "success" });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to copy diagnostics:", err);
      setToast({
        show: true,
        message: err?.message || "Could not copy diagnostics.",
        color: "danger",
      });
    }
  };

  const handleClearCachedPreferences = () => {
    console.log(`[USER ACTION] Settings: Clear cached preferences clicked`);
    if (typeof window === "undefined") return;
    const keys = [
      "mp_theme",
      "mp_tab_animations",
      "mp_debug_overlay",
      "mp_lazy_load",
      "mp_chart_animations",
      "mp_auto_expand_meals",
      "mp_meal_counts",
    ];
    keys.forEach((key) => window.localStorage.removeItem(key));

    const theme = getStoredThemeMode();
    applyTheme(theme);
    const animations = getAnimationPreference();
    const chartAnimations = getChartAnimationPreference();
    const debugOverlay = getDebugOverlayPreference();
    const lazyLoad = getLazyLoadPreference();
    const autoExpand = getAutoExpandMealsPreference();
    const mealCounts = getMealCountPreference();
    applyAnimationPreference(animations);
    applyChartAnimationPreference(chartAnimations);
    applyDebugOverlayPreference(debugOverlay);
    applyLazyLoadPreference(lazyLoad);
    applyAutoExpandMealsPreference(autoExpand);
    applyMealCountPreference(mealCounts);

    setTabAnimationsEnabled(animations);
    setChartAnimationsEnabled(chartAnimations);
    setDebugOverlayEnabled(debugOverlay);
    setLazyLoadEnabled(lazyLoad);
    setAutoExpandMealsEnabled(autoExpand);
    setShowMealCountsEnabled(mealCounts);
    setToast({
      show: true,
      message: "Cached preferences cleared.",
      color: "success",
    });
  };

  const handleRemovePhoto = async () => {
    console.log(`[USER ACTION] Settings: Remove profile photo clicked`);
    if (!auth.currentUser) return;
    try {
      const ref = doc(db, "users", auth.currentUser.uid);
      await updateDoc(ref, { "profile.photoUrl": null });
      setProfilePhotoUrl(null);
      trackEvent("settings_profile_photo_remove", { uid: auth.currentUser.uid });
      setToast({ show: true, message: "Profile photo removed.", color: "success" });
    } catch (error: unknown) {
      const err = error as Error;
      console.error("Failed to remove profile photo:", err);
      setToast({
        show: true,
        message: err?.message || "Could not remove profile photo.",
        color: "danger",
      });
    }
  };

  React.useEffect(() => {
    const load = async () => {
      const current = auth.currentUser;
      if (!current) return;

      try {
        const ref = doc(db, "users", current.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as UserData | undefined;
        const profile = data?.profile;

        const enabled =
          profile && typeof profile.smartRecommendationEnabled === "boolean"
            ? profile.smartRecommendationEnabled
            : true;

        setSmartRecommendationEnabled(
          typeof profile?.smartRecommendationEnabled === "boolean"
            ? profile.smartRecommendationEnabled
            : true
        );

        const smartProfile = profile?.smartRecommendationProfile;
        if (smartProfile) {
          if (typeof smartProfile.dietStyle === "string") {
            setSmartDietStyle(smartProfile.dietStyle as SmartDietStyle);
          }
          if (typeof smartProfile.macroFocus === "string") {
            setSmartMacroFocus(smartProfile.macroFocus as SmartMacroFocus);
          }
        }

        setShowRandomQuoteEnabled(
          typeof profile?.showWellnessTip === "boolean"
            ? profile.showWellnessTip
            : true
        );

        setShowAchievementsEnabled(
          typeof profile?.showAchievements === "boolean"
            ? profile.showAchievements
            : true
        );


        setShowRecentItemsEnabled(
          typeof profile?.showRecentItems === "boolean"
            ? profile.showRecentItems
            : true
        );

        setShowRecentSearchesEnabled(
          typeof profile?.showRecentSearches === "boolean"
            ? profile.showRecentSearches
            : true
        );

        const storedPhotoUrl =
          typeof profile?.photoUrl === "string"
            ? normalizePhotoUrl(profile.photoUrl)
            : null;
        const fallbackPhotoUrl = normalizePhotoUrl(current.photoURL);
        setProfilePhotoUrl(storedPhotoUrl ?? fallbackPhotoUrl);

        // Load theme preference from Firebase
        const savedTheme = profile?.themeMode as string | undefined;
        if (savedTheme && THEME_MODES.includes(savedTheme as ThemeMode)) {
          setThemeMode(savedTheme as ThemeMode);
          applyTheme(savedTheme as ThemeMode);
        }

        // Load tab animations preference from Firebase or localStorage
        const savedAnimationPref = profile?.tabAnimationsEnabled;
        if (typeof savedAnimationPref === "boolean") {
          setTabAnimationsEnabled(savedAnimationPref);
          applyAnimationPreference(savedAnimationPref);
        } else {
          // Fallback to localStorage if not in profile
          const localPref = getAnimationPreference();
          setTabAnimationsEnabled(localPref);
        }

        const savedChartAnimationPref = profile?.chartAnimationsEnabled;
        if (typeof savedChartAnimationPref === "boolean") {
          setChartAnimationsEnabled(savedChartAnimationPref);
          applyChartAnimationPreference(savedChartAnimationPref);
        } else {
          const localPref = getChartAnimationPreference();
          setChartAnimationsEnabled(localPref);
        }

        // Load debug overlay preference from Firebase or localStorage
        const savedDebugOverlayPref = profile?.debugOverlayEnabled;
        if (typeof savedDebugOverlayPref === "boolean") {
          setDebugOverlayEnabled(savedDebugOverlayPref);
          applyDebugOverlayPreference(savedDebugOverlayPref);
        } else {
          // Fallback to localStorage if not in profile
          const localPref = getDebugOverlayPreference();
          setDebugOverlayEnabled(localPref);
        }

        // Load lazy load preference from Firebase or localStorage
        const savedLazyLoadPref = profile?.lazyLoadEnabled;
        if (typeof savedLazyLoadPref === "boolean") {
          setLazyLoadEnabled(savedLazyLoadPref);
          applyLazyLoadPreference(savedLazyLoadPref);
        } else {
          const localPref = getLazyLoadPreference();
          setLazyLoadEnabled(localPref);
        }

        const savedAutoExpandMealsPref =
          typeof profile === "object" && profile && "autoExpandMeals" in profile
            ? (profile as { autoExpandMeals?: unknown }).autoExpandMeals
            : undefined;
        if (typeof savedAutoExpandMealsPref === "boolean") {
          setAutoExpandMealsEnabled(savedAutoExpandMealsPref);
          applyAutoExpandMealsPreference(savedAutoExpandMealsPref);
        } else {
          const localPref = getAutoExpandMealsPreference();
          setAutoExpandMealsEnabled(localPref);
        }

        const savedMealCountsPref =
          typeof profile === "object" && profile && "showMealCounts" in profile
            ? (profile as { showMealCounts?: unknown }).showMealCounts
            : undefined;
        if (typeof savedMealCountsPref === "boolean") {
          setShowMealCountsEnabled(savedMealCountsPref);
          applyMealCountPreference(savedMealCountsPref);
        } else {
          const localPref = getMealCountPreference();
          setShowMealCountsEnabled(localPref);
        }

        setSmartRecommendationEnabled(enabled);
      } catch (e) {
        console.error("Failed to load smartRecommendationEnabled:", e);
      }
    };

    load();
  }, []);

  if (!user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding tabbed-content settings-page">
          <IonText color="medium">Please log in.</IonText>
          <IonButton
            className="ion-margin-top"
            onClick={() => {
              console.log(`[USER ACTION] Settings: Navigate to login page`);
              history.push("/login");
            }}
          >
            Go to Login
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }

  const verified = !!user.emailVerified;
  const usernameToType = user.displayName || user.email || "DELETE";

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding tabbed-content settings-page">
        <div className="settings-sections">
          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">Account</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <div
                    className="settings-avatar"
                    onClick={() => {
                      console.log(`[USER ACTION] Settings: Clicked profile photo avatar`);
                      setShowPhotoActions(true);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Update profile photo"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        console.log(`[USER ACTION] Settings: Keyboard action on profile photo avatar`, { key: event.key });
                        setShowPhotoActions(true);
                      }
                    }}
                  >
                    <IonAvatar>
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt="Profile" />
                      ) : (
                        <IonIcon icon={personCircleOutline} />
                      )}
                    </IonAvatar>
                  </div>
                  <IonLabel>
                    <h2>{user.displayName || "Unnamed User"}</h2>
                    <p>{user.email}</p>
                  </IonLabel>
                  <IonNote slot="end" color={verified ? "success" : "warning"}>
                    {verified ? "Verified" : "Unverified"}
                  </IonNote>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Email verification</IonLabel>
                  <IonButton
                    fill="outline"
                    onClick={handleVerifyEmail}
                    disabled={verified}
                  >
                    <IonIcon slot="start" icon={mailOutline} />
                    {verified ? "Verified" : "Send link"}
                  </IonButton>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Password</IonLabel>
                  <IonButton onClick={handleResetPassword}>
                    <IonIcon slot="start" icon={keyOutline} />
                    Send reset email
                  </IonButton>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">
                Profile & goals
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to setup profile page`);
                    history.push("/setup-profile");
                  }}
                >
                  <IonLabel>Profile, goals & targets</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to energy needs page`);
                    history.push("/app/energy-needs");
                  }}
                >
                  <IonLabel>Change energy needs</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to units page`);
                    history.push("/app/units");
                  }}
                >
                  <IonLabel>Units & measurements</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to reminders page`);
                    history.push("/app/reminders");
                  }}
                >
                  <IonLabel>Reminders</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to data privacy page`);
                    history.push("/app/data-privacy");
                  }}
                >
                  <IonLabel>Data & privacy</IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">
                Smart recommendations
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <IonLabel>Show smart recommendation</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={smartRecommendationEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Smart recommendation toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setSmartRecommendationEnabled(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      const ref = doc(db, "users", current.uid);

                      try {
                        await updateDoc(ref, {
                          "profile.smartRecommendationEnabled": checked,
                        });

                        trackEvent("settings_smart_recommendation_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save smartRecommendationEnabled:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update smart recommendation setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Recommendation diet style</IonLabel>
                  <IonSelect
                    value={smartDietStyle}
                    disabled={!smartRecommendationEnabled}
                    onIonChange={(e) => {
                      console.log(`[USER ACTION] Settings: Diet style changed`, { value: e.detail.value });
                      const value = (e.detail.value || "none") as SmartDietStyle;
                      setSmartDietStyle(value);
                      void saveSmartRecommendationProfile({ dietStyle: value });
                    }}
                  >
                    <IonSelectOption value="none">No preference</IonSelectOption>
                    <IonSelectOption value="vegetarian">Vegetarian</IonSelectOption>
                    <IonSelectOption value="vegan">Vegan</IonSelectOption>
                    <IonSelectOption value="pescatarian">Pescatarian</IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Recommendation macro focus</IonLabel>
                  <IonSelect
                    value={smartMacroFocus}
                    disabled={!smartRecommendationEnabled}
                    onIonChange={(e) => {
                      console.log(`[USER ACTION] Settings: Macro focus changed`, { value: e.detail.value });
                      const value = (e.detail.value || "balanced") as SmartMacroFocus;
                      setSmartMacroFocus(value);
                      void saveSmartRecommendationProfile({ macroFocus: value });
                    }}
                  >
                    <IonSelectOption value="balanced">Balanced</IonSelectOption>
                    <IonSelectOption value="high-protein">High protein</IonSelectOption>
                    <IonSelectOption value="low-carb">Low carb</IonSelectOption>
                  </IonSelect>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">
                Home feed
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <IonLabel>Show random quote</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showRandomQuoteEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Random quote toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setShowRandomQuoteEnabled(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      const ref = doc(db, "users", current.uid);

                      try {
                        await updateDoc(ref, {
                          "profile.showWellnessTip": checked,
                        });

                        trackEvent("settings_show_random_quote_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save showRandomQuote:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update random quote setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Show achievements</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showAchievementsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Achievements toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setShowAchievementsEnabled(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      const ref = doc(db, "users", current.uid);

                      try {
                        await updateDoc(ref, {
                          "profile.showAchievements": checked,
                        });

                        trackEvent("settings_show_achievements_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save showAchievements:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update achievements setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Show recently added foods</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showRecentItemsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Recent items toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setShowRecentItemsEnabled(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      const ref = doc(db, "users", current.uid);

                      try {
                        await updateDoc(ref, {
                          "profile.showRecentItems": checked,
                        });

                        trackEvent("settings_show_recent_items_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save showRecentItems:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update recent items setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Show recently searched items</IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showRecentSearchesEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Recent searches toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setShowRecentSearchesEnabled(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      const ref = doc(db, "users", current.uid);

                      try {
                        await updateDoc(ref, {
                          "profile.showRecentSearches": checked,
                        });

                        trackEvent("settings_show_recent_searches_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save showRecentSearches:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update recent searches setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">
                Appearance & integrations
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={colorPaletteOutline} />
                  <IonLabel>
                    <h2>App theme</h2>
                    <p>Choose your preferred appearance</p>
                  </IonLabel>
                  <IonSelect
                    slot="end"
                    interface="popover"
                    value={themeMode}
                    onIonChange={(e) => {
                      console.log(`[USER ACTION] Settings: Theme select changed`, { value: e.detail.value });
                      handleThemeChange(e.detail.value as ThemeMode);
                    }}
                  >
                    <IonSelectOption value="system">System Default</IonSelectOption>
                    <IonSelectOption value="light">Light</IonSelectOption>
                    <IonSelectOption value="dark">Dark</IonSelectOption>
                  </IonSelect>
                </IonItem>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={colorPaletteOutline} />
                  <IonLabel>
                    <h2>Tab sliding animations</h2>
                    <p>Enable smooth animations when switching between tabs</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={tabAnimationsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Tab animations toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setTabAnimationsEnabled(checked);
                      applyAnimationPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.tabAnimationsEnabled": checked,
                        });

                        trackEvent("settings_tab_animations_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save tab animations preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update animation setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={colorPaletteOutline} />
                  <IonLabel>
                    <h2>Animate charts</h2>
                    <p>Enable animations for analytics charts.</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={chartAnimationsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Chart animations toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setChartAnimationsEnabled(checked);
                      applyChartAnimationPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.chartAnimationsEnabled": checked,
                        });

                        trackEvent("settings_chart_animations_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save chart animations preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update chart animation setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={colorPaletteOutline} />
                  <IonLabel>
                    <h2>Show meal food counts</h2>
                    <p>Display the number of foods next to meal names.</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={showMealCountsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Meal counts toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setShowMealCountsEnabled(checked);
                      applyMealCountPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.showMealCounts": checked,
                        });

                        trackEvent("settings_show_meal_counts_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save meal counts preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update meal counts setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={chevronDownOutline} />
                  <IonLabel>
                    <h2>Auto-expand meals with food</h2>
                    <p>Open meals that already include entries.</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={autoExpandMealsEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Auto-expand meals toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setAutoExpandMealsEnabled(checked);
                      applyAutoExpandMealsPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.autoExpandMeals": checked,
                        });

                        trackEvent("settings_auto_expand_meals_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save auto expand preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update auto expand setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">Data</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem
                  lines="full"
                  button
                  disabled={clearingRecent}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Clear recent foods clicked`);
                    setConfirmClearRecent(true);
                  }}
                >
                  <IonIcon slot="start" icon={trashOutline} />
                  <IonLabel>Clear recent foods history</IonLabel>
                  {clearingRecent && (
                    <IonNote slot="end" color="medium">
                      Clearing…
                    </IonNote>
                  )}
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">Advanced settings</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem lines="full" button onClick={() => {
                  console.log(`[USER ACTION] Settings: Copy diagnostics clicked`);
                  void handleCopyDiagnostics();
                }}>
                  <IonLabel>
                    <h2>Copy diagnostics</h2>
                    <p>Copy device and app info for support.</p>
                  </IonLabel>
                </IonItem>
                <IonItem lines="full" button onClick={() => {
                  console.log(`[USER ACTION] Settings: Clear cached preferences clicked`);
                  handleClearCachedPreferences();
                }}>
                  <IonLabel>
                    <h2>Clear cached preferences</h2>
                    <p>Reset theme, animation, and lazy-load settings.</p>
                  </IonLabel>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>
                    <h2>Debug overlay</h2>
                    <p>Show performance metrics overlay</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={debugOverlayEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Debug overlay toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setDebugOverlayEnabled(checked);
                      applyDebugOverlayPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.debugOverlayEnabled": checked,
                        });

                        trackEvent("settings_debug_overlay_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save debug overlay preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update debug overlay setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>
                    <h2>Lazy load routes</h2>
                    <p>Load screens only when you visit them.</p>
                  </IonLabel>
                  <IonToggle
                    slot="end"
                    checked={lazyLoadEnabled}
                    onIonChange={async (e) => {
                      console.log(`[USER ACTION] Settings: Lazy load toggle changed`, { checked: e.detail.checked });
                      const checked = e.detail.checked;
                      setLazyLoadEnabled(checked);
                      applyLazyLoadPreference(checked);

                      const current = auth.currentUser;
                      if (!current) return;

                      try {
                        const ref = doc(db, "users", current.uid);
                        await updateDoc(ref, {
                          "profile.lazyLoadEnabled": checked,
                        });

                        trackEvent("settings_lazy_load_toggle", {
                          uid: current.uid,
                          enabled: checked,
                        });
                      } catch (error: unknown) {
                        const err = error as Error;
                        console.error("Failed to save lazy load preference:", err);
                        setToast({
                          show: true,
                          message:
                            err?.message ||
                            "Could not update lazy load setting.",
                          color: "danger",
                        });
                      }
                    }}
                  />
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">Support</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Buy me a coffee clicked`, { url: 'https://buymeacoffee.com/zanci19' });
                    window.open("https://buymeacoffee.com/zanci19", "_blank");
                  }}
                >
                  <IonIcon slot="start" icon={cafeOutline} />
                  <IonLabel>Buy me a coffee ☕</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to changelog page`);
                    history.push("/app/changelog");
                  }}
                >
                  <IonIcon slot="start" icon={newspaperOutline} />
                  <IonLabel>Changelog</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Show About MacroPal modal`);
                    setShowAbout(true);
                  }}
                >
                  <IonIcon slot="start" icon={informationCircleOutline} />
                  <IonLabel>About MacroPal</IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="settings-card-title">Sign out</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem
                  lines="full"
                  button
                  onClick={async () => {
                    console.log(`[USER ACTION] Settings: Sign out clicked`, { isDemoMode });
                    if (isDemoMode) {
                      setToast({
                        show: true,
                        message: "Sign out is disabled in demo mode.",
                        color: "medium",
                      });
                      return;
                    }
                    await signOut(auth);
                  }}
                >
                  <IonIcon slot="start" icon={logOutOutline} />
                  <IonLabel>Sign out</IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="settings-file-input"
        onChange={(event) => {
          console.log(`[USER ACTION] Settings: Gallery photo selected`, { filesCount: event.target.files?.length });
          void handlePhotoChange(event.target.files?.[0] ?? null);
          if (event.currentTarget) event.currentTarget.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="settings-file-input"
        onChange={(event) => {
          console.log(`[USER ACTION] Settings: Camera photo captured`, { filesCount: event.target.files?.length });
          void handlePhotoChange(event.target.files?.[0] ?? null);
          if (event.currentTarget) event.currentTarget.value = "";
        }}
      />

      <IonActionSheet
        isOpen={showPhotoActions}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Photo action sheet dismissed`);
          setShowPhotoActions(false);
        }}
        header="Update profile photo"
        buttons={[
          {
            text: "Choose from gallery",
            handler: () => {
              console.log(`[USER ACTION] Settings: Choose from gallery button clicked`);
              galleryInputRef.current?.click();
            },
          },
          {
            text: "Take a photo",
            handler: () => {
              console.log(`[USER ACTION] Settings: Take a photo button clicked`);
              cameraInputRef.current?.click();
            },
          },
          ...(profilePhotoUrl
            ? [
                {
                  text: "Remove photo",
                  role: "destructive",
                  handler: () => {
                    console.log(`[USER ACTION] Settings: Remove photo button clicked`);
                    void handleRemovePhoto();
                  },
                },
              ]
            : []),
          {
            text: "Cancel",
            role: "cancel",
          },
        ]}
      />

      {/* Alerts + Toasts unchanged */}
      <IonAlert
        isOpen={confirmDelete}
        header="Delete account?"
        message="This is permanent and cannot be undone."
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Settings: Delete account alert cancelled`);
              setConfirmDelete(false);
            },
          },
          {
            text: "Continue",
            role: "destructive",
            handler: () => {
              console.log(`[USER ACTION] Settings: Delete account alert - Continue clicked`);
              setConfirmDelete(false);
              setConfirmDeleteName(true);
            },
          },
        ]}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Delete account alert dismissed`);
          setConfirmDelete(false);
        }}
      />

      <IonAlert
        isOpen={confirmClearRecent}
        header="Clear recent foods?"
        message="This will remove your recent foods history. Favorites and diary entries will stay."
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Settings: Clear recent foods alert cancelled`);
              setConfirmClearRecent(false);
            },
          },
          {
            text: "Clear",
            role: "destructive",
            handler: () => {
              console.log(`[USER ACTION] Settings: Clear recent foods alert - Clear confirmed`);
              setConfirmClearRecent(false);
              void handleClearRecentFoods();
            },
          },
        ]}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Clear recent foods alert dismissed`);
          setConfirmClearRecent(false);
        }}
      />

      <IonAlert
        isOpen={confirmDeleteName}
        header="Type your name to confirm"
        message={`To permanently delete your MacroPal account, please type: "${usernameToType}"`}
        inputs={[
          {
            name: "typedName",
            placeholder: usernameToType,
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Settings: Delete account name confirmation cancelled`);
              setConfirmDeleteName(false);
            },
          },
          {
            text: "Delete",
            role: "destructive",
            handler: (data: { typedName?: string }) => {
              console.log(`[USER ACTION] Settings: Delete account name confirmation - Delete clicked`, { matchesUsername: (data?.typedName || "").trim() === usernameToType });
              const typed = (data?.typedName || "").trim();
              if (typed !== usernameToType) {
                setToast({
                  show: true,
                  message:
                    "Name does not match. Please type it exactly as shown.",
                  color: "danger",
                });
                return false;
              }
              setConfirmDeleteName(false);
              void handleDeleteAccount();
            },
          },
        ]}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Delete account name confirmation dismissed`);
          setConfirmDeleteName(false);
        }}
      />

      <IonAlert
        isOpen={showAbout}
        header="About MacroPal"
        subHeader="Your Personal Nutrition Companion"
        message={`MacroPal is a comprehensive nutrition tracking app designed to help you achieve your health and fitness goals through smart food logging, macro tracking, and personalized recommendations.

Version: 1.0.0
Created: 2024
Developer: Zanci19

Built with ❤️ using Ionic React and Firebase.

Features:
• Smart food search powered by Open Food Facts
• Barcode scanning for quick food entry
• Detailed macro and micronutrient tracking
• Customizable daily goals and targets
• Meal planning and workout tracking
• Beautiful themes and smooth experience

Thank you for using MacroPal!`}
        buttons={[
          {
            text: "Close",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Settings: About MacroPal alert closed`);
              setShowAbout(false);
            },
          },
          {
            text: "Support Developer",
            handler: () => {
              console.log(`[USER ACTION] Settings: About MacroPal - Support Developer clicked`, { url: 'https://buymeacoffee.com/zanci19' });
              window.open("https://buymeacoffee.com/zanci19", "_blank");
              setShowAbout(false);
            },
          },
        ]}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: About MacroPal alert dismissed`);
          setShowAbout(false);
        }}
      />

      <IonToast
        isOpen={toast.show}
        message={toast.message}
        color={toast.color}
        duration={2200}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Toast dismissed`, { message: toast.message });
          setToast((t) => ({ ...t, show: false, message: "" }));
        }}
      />
    </IonPage>
  );
};

export default Settings;
