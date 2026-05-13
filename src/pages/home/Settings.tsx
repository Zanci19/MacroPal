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
  IonInput,
  IonSelect,
  IonSelectOption,
  IonModal,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonAvatar,
  IonActionSheet,
} from "@ionic/react";
import type { IonInputCustomEvent, InputInputEventDetail } from "@ionic/core/components";
import {
  personCircleOutline,
  logOutOutline,
  mailOutline,
  cafeOutline,
  trashOutline,
  colorPaletteOutline,
  informationCircleOutline,
  keyOutline,
  shieldCheckmarkOutline,
  newspaperOutline,
  chatbubbleEllipsesOutline,
  peopleOutline,
  medicalOutline,
  searchOutline,
} from "ionicons/icons";
import { auth, db, storage, trackEvent } from "../../firebase";
import {
  sendEmailVerification,
  signOut,
  sendPasswordResetEmail,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  TotpMultiFactorGenerator,
  TotpSecret,
  RecaptchaVerifier,
  type PhoneMultiFactorInfo,
} from "firebase/auth";
import { useHistory } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
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
import { isFeatureEnabled, useRemoteConfig } from "../../UpdateGate";
import { useClinicianAccess } from "../../hooks/useClinicianAccess";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import { clearAddFoodRecentQueries } from "../../utils/recentQueries";
import { clearRecentFoodsHistory } from "../../utils/recentFoods";
import { getCurrentUser } from "../../utils/demoAuth";
import mfaPhoneCountriesData from "../../data/mfaPhoneCountries.json";

type MfaMethod = "sms" | "authenticator";
type MfaSetupStep =
  | "intro"
  | "method"
  | "phone"
  | "authenticator"
  | "preparing"
  | "sending"
  | "verify"
  | "verifying"
  | "success";

interface MfaPhoneCountry {
  iso2: string;
  country: string;
  dialCode: string;
  nationalPrefix?: string;
}

interface UserProfile {
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

const MFA_PHONE_COUNTRIES = ((mfaPhoneCountriesData as MfaPhoneCountry[]) ?? []).filter((entry) => {
  return (
    typeof entry.iso2 === "string" &&
    typeof entry.country === "string" &&
    typeof entry.dialCode === "string" &&
    /^\+\d{1,4}$/.test(entry.dialCode)
  );
});

const DEFAULT_MFA_PHONE_COUNTRY_ISO2 = "US";

const getDefaultMfaCountryIso2 = (): string => {
  if (!MFA_PHONE_COUNTRIES.length) return DEFAULT_MFA_PHONE_COUNTRY_ISO2;

  const regions = new Set<string>();
  if (typeof navigator !== "undefined") {
    const locales = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
    for (const locale of locales) {
      const region = locale?.split(/[-_]/)[1]?.toUpperCase();
      if (region) {
        regions.add(region);
      }
    }
  }

  for (const region of regions) {
    const match = MFA_PHONE_COUNTRIES.find((entry) => entry.iso2 === region);
    if (match) return match.iso2;
  }

  const defaultMatch = MFA_PHONE_COUNTRIES.find((entry) => entry.iso2 === DEFAULT_MFA_PHONE_COUNTRY_ISO2);
  return defaultMatch?.iso2 ?? MFA_PHONE_COUNTRIES[0].iso2;
};

const Settings: React.FC = () => {
  const history = useHistory();
  const user = getCurrentUser();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const remoteConfig = useRemoteConfig();
  const clinicianCollabEnabled = isFeatureEnabled(remoteConfig, "clinicianCollaboration");
  const { role, clinicianLink } = useClinicianAccess();

  const [toast, setToast] = React.useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });

  const [showRandomQuoteEnabled, setShowRandomQuoteEnabled] = React.useState(true);
  const [showAchievementsEnabled, setShowAchievementsEnabled] = React.useState(true);
  const [showRecentItemsEnabled, setShowRecentItemsEnabled] = React.useState(true);
  const [showRecentSearchesEnabled, setShowRecentSearchesEnabled] = React.useState(true);
  const [confirmClearRecent, setConfirmClearRecent] = React.useState(false);
  const [confirmClearRecentSearches, setConfirmClearRecentSearches] = React.useState(false);
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
  const mfaRecaptchaContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mfaRecaptchaVerifierRef = React.useRef<RecaptchaVerifier | null>(null);

  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [mfaEnabledMethods, setMfaEnabledMethods] = React.useState<MfaMethod[]>([]);
  const [mfaPhoneHint, setMfaPhoneHint] = React.useState<string | null>(null);
  const [mfaSelectedCountryIso2, setMfaSelectedCountryIso2] = React.useState<string>(() => {
    return getDefaultMfaCountryIso2();
  });
  const [mfaPhoneNumber, setMfaPhoneNumber] = React.useState("");
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = React.useState("");
  const [mfaPendingMethod, setMfaPendingMethod] = React.useState<MfaMethod | null>(null);
  const [mfaPendingVerificationId, setMfaPendingVerificationId] = React.useState<string | null>(null);
  const [mfaPendingPhone, setMfaPendingPhone] = React.useState<string | null>(null);
  const [mfaPendingTotpSecret, setMfaPendingTotpSecret] = React.useState<TotpSecret | null>(null);
  const [mfaSendingCode, setMfaSendingCode] = React.useState(false);
  const [mfaVerifyingCode, setMfaVerifyingCode] = React.useState(false);
  const [mfaStatusLoading, setMfaStatusLoading] = React.useState(true);
  const [showMfaSetupModal, setShowMfaSetupModal] = React.useState(false);
  const [mfaSetupStep, setMfaSetupStep] = React.useState<MfaSetupStep>("intro");

  const selectedMfaCountry = React.useMemo(() => {
    return (
      MFA_PHONE_COUNTRIES.find((entry) => entry.iso2 === mfaSelectedCountryIso2) ??
      MFA_PHONE_COUNTRIES[0] ??
      null
    );
  }, [mfaSelectedCountryIso2]);

  const clearMfaRecaptcha = React.useCallback(() => {
    if (!mfaRecaptchaVerifierRef.current) return;
    try {
      mfaRecaptchaVerifierRef.current.clear();
    } catch (error) {
      console.warn("Failed to clear MFA reCAPTCHA verifier:", error);
    } finally {
      mfaRecaptchaVerifierRef.current = null;
    }
  }, []);

  const getNormalizedPhone = React.useCallback((value: string, country: MfaPhoneCountry | null): string | null => {
    const compact = value.trim().replace(/[^\d+]/g, "");
    if (!compact) return null;

    let internationalCandidate = compact;
    if (internationalCandidate.startsWith("00")) {
      internationalCandidate = `+${internationalCandidate.slice(2)}`;
    }

    if (internationalCandidate.startsWith("+")) {
      let internationalDigits = internationalCandidate.slice(1).replace(/[^\d]/g, "");
      if (country?.nationalPrefix) {
        const countryCodeDigits = country.dialCode.replace(/\D/g, "");
        const prefixedCountryCode = `${countryCodeDigits}${country.nationalPrefix}`;
        if (internationalDigits.startsWith(prefixedCountryCode)) {
          internationalDigits = `${countryCodeDigits}${internationalDigits.slice(prefixedCountryCode.length)}`;
        }
      }
      if (!/^\d{8,15}$/.test(internationalDigits)) return null;
      return `+${internationalDigits}`;
    }

    if (!country) return null;

    const countryCodeDigits = country.dialCode.replace(/\D/g, "");
    const rawDigits = value.replace(/\D/g, "");
    if (!rawDigits || !countryCodeDigits) return null;

    let localDigits = rawDigits;
    if (country.nationalPrefix && localDigits.startsWith(country.nationalPrefix)) {
      localDigits = localDigits.slice(country.nationalPrefix.length);
    }
    if (!localDigits) return null;

    const assembledDigits =
      rawDigits.startsWith(countryCodeDigits) && rawDigits.length >= countryCodeDigits.length + 6
        ? rawDigits
        : `${countryCodeDigits}${localDigits}`;

    if (!/^\d{8,15}$/.test(assembledDigits)) return null;
    return `+${assembledDigits}`;
  }, []);

  const ensureMfaRecaptcha = React.useCallback(async () => {
    const container = mfaRecaptchaContainerRef.current;
    if (!container) {
      throw new Error("Security challenge is not ready. Please reopen Settings.");
    }

    if (mfaRecaptchaVerifierRef.current) {
      return mfaRecaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, container, {
      size: "invisible",
    });

    await verifier.render();
    mfaRecaptchaVerifierRef.current = verifier;
    return verifier;
  }, []);

  const refreshMfaStatus = React.useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setMfaEnabled(false);
      setMfaEnabledMethods([]);
      setMfaPhoneHint(null);
      setMfaStatusLoading(false);
      return;
    }

    setMfaStatusLoading(true);
    try {
      await current.reload();
      const factors = multiFactor(current).enrolledFactors;
      const phoneFactors = factors.filter(
        (factor) => factor.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      ) as PhoneMultiFactorInfo[];
      const totpFactors = factors.filter(
        (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );

      const methods: MfaMethod[] = [];
      if (phoneFactors.length > 0) methods.push("sms");
      if (totpFactors.length > 0) methods.push("authenticator");

      setMfaEnabled(methods.length > 0);
      setMfaEnabledMethods(methods);
      setMfaPhoneHint(phoneFactors[0]?.phoneNumber ?? null);
    } catch (error) {
      console.error("Failed to refresh MFA status:", error);
      setMfaEnabled(false);
      setMfaEnabledMethods([]);
      setMfaPhoneHint(null);
    } finally {
      setMfaStatusLoading(false);
    }
  }, []);

  const handleStartSmsMfaEnrollment = async () => {
    const current = auth.currentUser;
    if (!current) return;

    const normalizedPhone = getNormalizedPhone(mfaPhoneNumber, selectedMfaCountry);
    if (!normalizedPhone) {
      setMfaSetupStep("phone");
      setToast({
        show: true,
        message: "Enter a valid phone number (local format with selected country code or full +international).",
        color: "warning",
      });
      return;
    }

    setMfaSetupStep("sending");
    setMfaSendingCode(true);
    try {
      const verifier = await ensureMfaRecaptcha();
      const mfaSession = await multiFactor(current).getSession();
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          phoneNumber: normalizedPhone,
          session: mfaSession,
        },
        verifier
      );

      setMfaPendingMethod("sms");
      setMfaPendingVerificationId(verificationId);
      setMfaPendingPhone(normalizedPhone);
      setMfaPendingTotpSecret(null);
      setMfaEnrollmentCode("");
      setMfaSetupStep("verify");
      setToast({
        show: true,
        message: "Verification code sent. Enter it to enable 2FA.",
        color: "success",
      });
      trackEvent("settings_mfa_enrollment_code_sent", { uid: current.uid });
    } catch (error) {
      const err = error as Error;
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";

      if (code === "auth/requires-recent-login") {
        setToast({
          show: true,
          message: "Please sign in again, then return here to enable 2FA.",
          color: "warning",
        });
        trackEvent("settings_mfa_enrollment_requires_recent_login", { uid: current.uid });
      } else {
        console.error("Failed to send MFA enrollment code:", err);
        setToast({
          show: true,
          message: err?.message || "Could not send verification code.",
          color: "danger",
        });
      }
      trackEvent("settings_mfa_enrollment_code_error", {
        uid: current.uid,
        error: code || err?.message || "unknown",
      });
      setMfaSetupStep("phone");
      clearMfaRecaptcha();
    } finally {
      setMfaSendingCode(false);
    }
  };

  const handleStartAuthenticatorEnrollment = async () => {
    const current = auth.currentUser;
    if (!current) return;

    setMfaSetupStep("preparing");
    setMfaSendingCode(true);
    try {
      const mfaSession = await multiFactor(current).getSession();
      const totpSecret = await TotpMultiFactorGenerator.generateSecret(mfaSession);

      setMfaPendingMethod("authenticator");
      setMfaPendingVerificationId(null);
      setMfaPendingPhone(null);
      setMfaPendingTotpSecret(totpSecret);
      setMfaEnrollmentCode("");
      setMfaSetupStep("verify");
      setToast({
        show: true,
        message: "Authenticator setup key generated. Add it in your app, then enter the code.",
        color: "success",
      });
      trackEvent("settings_mfa_authenticator_secret_generated", { uid: current.uid });
    } catch (error) {
      const err = error as Error;
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";

      if (code === "auth/requires-recent-login") {
        setToast({
          show: true,
          message: "Please sign in again, then return here to enable Authenticator 2FA.",
          color: "warning",
        });
      } else {
        console.error("Failed to create Authenticator MFA setup:", err);
        setToast({
          show: true,
          message: err?.message || "Could not start Authenticator setup.",
          color: "danger",
        });
      }

      trackEvent("settings_mfa_authenticator_setup_error", {
        uid: current.uid,
        error: code || err?.message || "unknown",
      });
      setMfaPendingMethod(null);
      setMfaPendingTotpSecret(null);
      setMfaSetupStep("authenticator");
    } finally {
      setMfaSendingCode(false);
    }
  };

  const handleConfirmMfaEnrollment = async () => {
    const current = auth.currentUser;
    if (!current || !mfaPendingMethod) return;

    const code = mfaEnrollmentCode.trim();
    const requiredCodeLength =
      mfaPendingMethod === "authenticator"
        ? Math.max(6, Math.min(8, mfaPendingTotpSecret?.codeLength ?? 6))
        : 6;
    if (!new RegExp(`^\\d{${requiredCodeLength}}$`).test(code)) {
      setMfaSetupStep("verify");
      setToast({
        show: true,
        message: `Enter the ${requiredCodeLength}-digit verification code.`,
        color: "warning",
      });
      return;
    }

    setMfaSetupStep("verifying");
    setMfaVerifyingCode(true);
    try {
      if (mfaPendingMethod === "sms") {
        if (!mfaPendingVerificationId) {
          throw new Error("Phone verification is missing. Please request a new SMS code.");
        }
        const credential = PhoneAuthProvider.credential(mfaPendingVerificationId, code);
        const assertion = PhoneMultiFactorGenerator.assertion(credential);
        await multiFactor(current).enroll(assertion, "SMS");
      } else {
        if (!mfaPendingTotpSecret) {
          throw new Error("Authenticator setup key expired. Generate a new setup key.");
        }
        const assertion = TotpMultiFactorGenerator.assertionForEnrollment(mfaPendingTotpSecret, code);
        await multiFactor(current).enroll(assertion, "Authenticator");
      }

      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.twoFactorEnabled": true,
        "profile.twoFactorPhone": mfaPendingMethod === "sms" ? mfaPendingPhone : null,
        "profile.twoFactorMethod": mfaPendingMethod,
      });

      const enabledMethod = mfaPendingMethod;
      setMfaPendingVerificationId(null);
      setMfaPendingPhone(null);
      setMfaPendingTotpSecret(null);
      setMfaEnrollmentCode("");
      setMfaPhoneNumber("");
      await refreshMfaStatus();
      setMfaSetupStep("success");
      setToast({
        show: true,
        message:
          enabledMethod === "sms"
            ? "Two-factor authentication enabled with SMS."
            : "Two-factor authentication enabled with Authenticator.",
        color: "success",
      });
      trackEvent("settings_mfa_enabled", { uid: current.uid, method: enabledMethod });
    } catch (error) {
      const err = error as Error;
      console.error("Failed to confirm MFA enrollment:", err);
      setToast({
        show: true,
        message: err?.message || "Could not enable two-factor authentication.",
        color: "danger",
      });
      trackEvent("settings_mfa_enable_error", {
        uid: current.uid,
        error: err?.message || "unknown",
      });
      setMfaSetupStep("verify");
    } finally {
      setMfaVerifyingCode(false);
    }
  };

  const handleCancelMfaEnrollment = () => {
    const pendingMethod = mfaPendingMethod;
    setMfaPendingVerificationId(null);
    setMfaPendingPhone(null);
    setMfaPendingTotpSecret(null);
    setMfaPendingMethod(null);
    setMfaEnrollmentCode("");
    setMfaSetupStep(pendingMethod === "sms" ? "phone" : "method");
  };

  const handleDisableMfa = async () => {
    const current = auth.currentUser;
    if (!current) return;

    setMfaVerifyingCode(true);
    try {
      await current.reload();
      const factors = multiFactor(current).enrolledFactors;

      if (!factors.length) {
        setToast({
          show: true,
          message: "Two-factor authentication is already disabled.",
          color: "warning",
        });
        await refreshMfaStatus();
        return;
      }

      for (const factor of factors) {
        await multiFactor(current).unenroll(factor.uid);
      }

      const ref = doc(db, "users", current.uid);
      await updateDoc(ref, {
        "profile.twoFactorEnabled": false,
        "profile.twoFactorPhone": null,
        "profile.twoFactorMethod": null,
      });

      setMfaPendingVerificationId(null);
      setMfaPendingPhone(null);
      setMfaPendingTotpSecret(null);
      setMfaPendingMethod(null);
      setMfaEnrollmentCode("");
      await refreshMfaStatus();
      setToast({
        show: true,
        message: "Two-factor authentication disabled.",
        color: "success",
      });
      trackEvent("settings_mfa_disabled", { uid: current.uid });
    } catch (error) {
      const err = error as Error;
      console.error("Failed to disable MFA:", err);
      setToast({
        show: true,
        message:
          err?.message ||
          "Could not disable two-factor authentication. You may need to log in again.",
        color: "danger",
      });
      trackEvent("settings_mfa_disable_error", {
        uid: current.uid,
        error: err?.message || "unknown",
      });
    } finally {
      setMfaVerifyingCode(false);
    }
  };

  const openMfaSetupFlow = () => {
    if (mfaEnabled) return;
    setMfaSetupStep("intro");
    setShowMfaSetupModal(true);
    trackEvent("settings_mfa_setup_opened", { uid: user?.uid });
  };

  const closeMfaSetupFlow = () => {
    if (mfaSendingCode || mfaVerifyingCode) return;
    setShowMfaSetupModal(false);
    setMfaPendingVerificationId(null);
    setMfaPendingPhone(null);
    setMfaPendingTotpSecret(null);
    setMfaPendingMethod(null);
    setMfaEnrollmentCode("");
    setMfaPhoneNumber("");
    setMfaSetupStep("intro");
  };

  const handleCopyMfaSecret = async () => {
    if (!mfaAuthenticatorSecret) return;
    try {
      await navigator.clipboard.writeText(mfaAuthenticatorSecret);
      setToast({
        show: true,
        message: "Setup key copied.",
        color: "success",
      });
    } catch (error) {
      const err = error as Error;
      setToast({
        show: true,
        message: err?.message || "Could not copy setup key.",
        color: "danger",
      });
    }
  };

  const handleVerifyEmail = async () => {
    console.log(`[USER ACTION] Settings: Send verification email clicked`);
    if (isDemoMode) {
      setToast({
        show: true,
        message: "Email verification is disabled in demo mode.",
        color: "medium",
      });
      return;
    }
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
    if (isDemoMode) {
      setToast({
        show: true,
        message: "Password reset is disabled in demo mode.",
        color: "medium",
      });
      return;
    }
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

  const handleClearRecentFoods = async () => {
    console.log(`[USER ACTION] Settings: Clear recent foods confirmed and executing`);
    if (isDemoMode) {
      setToast({
        show: true,
        message: "Quick history reset is disabled in demo mode.",
        color: "medium",
      });
      return;
    }
    if (!auth.currentUser) return;
    try {
      setClearingRecent(true);
      await clearRecentFoodsHistory(auth.currentUser.uid);

      setToast({
        show: true,
        message: "Quick history chips cleared.",
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

  const handleClearRecentSearches = () => {
    console.log(`[USER ACTION] Settings: Clear recent searches confirmed and executing`);
    try {
      clearAddFoodRecentQueries();
      trackEvent("settings_recent_queries_cleared", { uid: user?.uid });
      setToast({
        show: true,
        message: "Recent searches cleared on this device.",
        color: "success",
      });
    } catch (error: unknown) {
      const e = error as Error;
      setToast({
        show: true,
        message: e?.message || "Could not clear recent searches.",
        color: "danger",
      });
    }
  };

  const handlePhotoChange = async (file?: File | null) => {
    console.log(`[USER ACTION] Settings: Photo file selected for upload`, { fileType: file?.type, fileSize: file?.size });
    if (isDemoMode) {
      setToast({
        show: true,
        message: "Profile photo updates are disabled in demo mode.",
        color: "medium",
      });
      return;
    }
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

  const handleRemovePhoto = async () => {
    console.log(`[USER ACTION] Settings: Remove profile photo clicked`);
    if (isDemoMode) {
      setToast({
        show: true,
        message: "Profile photo updates are disabled in demo mode.",
        color: "medium",
      });
      return;
    }
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
    void refreshMfaStatus();
  }, [refreshMfaStatus]);

  React.useEffect(() => {
    return () => {
      clearMfaRecaptcha();
    };
  }, [clearMfaRecaptcha]);

  React.useEffect(() => {
    const load = async () => {
      const current = auth.currentUser;
      if (!current) return;

      try {
        const ref = doc(db, "users", current.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as UserData | undefined;
        const profile = data?.profile;

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

      } catch (e) {
        console.error("Failed to load settings profile:", e);
      }
    };

    load();
  }, []);

  if (!user && !isDemoMode) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Settings</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding tabbed-content settings-page">
          <IonText color="medium">You are not logged in.</IonText>
          <IonButton
            className="ion-margin-top"
            onClick={() => {
              console.log(`[USER ACTION] Settings: Navigate to start page`);
              history.push("/start");
            }}
          >
            Go to Start page
          </IonButton>
        </IonContent>
      </IonPage>
    );
  }

  const accountUser = user ?? {
    uid: "demo-user-id",
    email: "demo@macropal.app",
    displayName: "Demo",
    emailVerified: true,
  };

  const verified = !!accountUser.emailVerified;
  const mfaSetupCanDismiss = !mfaSendingCode && !mfaVerifyingCode;
  const mfaLocalExample = selectedMfaCountry?.nationalPrefix
    ? `${selectedMfaCountry.nationalPrefix}51794459`
    : "51794459";
  const mfaInternationalExample = selectedMfaCountry
    ? `${selectedMfaCountry.dialCode}${mfaLocalExample.replace(/^0+/, "")}`
    : "+15551234567";
  const mfaNormalizedPhone = getNormalizedPhone(mfaPhoneNumber, selectedMfaCountry);
  const mfaAuthenticatorIssuer = "MacroPal";
  const mfaAuthenticatorAccount = accountUser.email || accountUser.displayName || "MacroPal User";
  const mfaAuthenticatorSecret = mfaPendingTotpSecret?.secretKey ?? "";
  const mfaVerifyCodeLength =
    mfaPendingMethod === "authenticator"
      ? Math.max(6, Math.min(8, mfaPendingTotpSecret?.codeLength ?? 6))
      : 6;
  const mfaStatusSummary = (() => {
    if (mfaStatusLoading) return "Checking status...";
    if (!mfaEnabledMethods.length) return "Not enabled";
    if (mfaEnabledMethods.length > 1) return "Enabled (SMS + Authenticator app)";
    if (mfaEnabledMethods[0] === "sms") {
      return `Enabled with SMS${mfaPhoneHint ? ` for ${mfaPhoneHint}` : ""}`;
    }
    return "Enabled with Authenticator app";
  })();
  const enabledHomeFeedItems = [
    showRandomQuoteEnabled,
    showAchievementsEnabled,
    showRecentItemsEnabled,
    showRecentSearchesEnabled,
  ].filter(Boolean).length;
  const appearanceSummary = [
    `Theme: ${themeMode}`,
    tabAnimationsEnabled ? "Tab animations on" : "Tab animations off",
    chartAnimationsEnabled ? "Charts on" : "Charts off",
    showMealCountsEnabled ? "Meal counts on" : "Meal counts off",
    autoExpandMealsEnabled ? "Auto-expand on" : "Auto-expand off",
    debugOverlayEnabled ? "Debug overlay on" : "Debug overlay off",
    lazyLoadEnabled ? "Lazy load on" : "Lazy load off",
  ].join(" · ");

  const renderMfaSetupScreen = () => {
    if (mfaSetupStep === "intro") {
      return (
        <div className="settings-mfa-setup-block">
          <h2>You will now set up 2FA</h2>
          <p>Choose SMS or an Authenticator app for one-time sign-in codes.</p>
          <IonButton expand="block" onClick={() => setMfaSetupStep("method")}>
            Continue
          </IonButton>
          <IonButton expand="block" fill="clear" color="medium" onClick={closeMfaSetupFlow}>
            Not now
          </IonButton>
        </div>
      );
    }

    if (mfaSetupStep === "method") {
      return (
        <div className="settings-mfa-setup-block">
          <h2>Choose your verification method</h2>
          <p>You can use SMS text messages or an Authenticator app.</p>
          <div className="settings-mfa-setup-actions">
            <IonButton
              expand="block"
              onClick={() => {
                setMfaPendingMethod("sms");
                setMfaSetupStep("phone");
              }}
            >
              SMS text message
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => {
                setMfaPendingMethod("authenticator");
                setMfaSetupStep("authenticator");
              }}
            >
              Authenticator app
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              onClick={() => setMfaSetupStep("intro")}
            >
              Back
            </IonButton>
          </div>
        </div>
      );
    }

    if (mfaSetupStep === "phone") {
      return (
        <div className="settings-mfa-setup-block">
          <h2>Enter your phone number</h2>
          <p>
            Select your country code and enter your number in local or international format.
            Example: {mfaLocalExample} or {mfaInternationalExample}
          </p>
          <IonItem lines="full">
            <IonLabel position="stacked">Country code</IonLabel>
            <IonSelect
              value={selectedMfaCountry?.iso2}
              interface="popover"
              onIonChange={(event) => {
                const nextIso2 = String(event.detail.value ?? "");
                if (nextIso2) {
                  setMfaSelectedCountryIso2(nextIso2);
                }
              }}
            >
              {MFA_PHONE_COUNTRIES.map((entry) => (
                <IonSelectOption key={entry.iso2} value={entry.iso2}>
                  {`${entry.country} (${entry.dialCode})`}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem lines="full">
            <IonLabel position="stacked">Phone number</IonLabel>
            <IonInput
              type="tel"
              inputmode="tel"
              value={mfaPhoneNumber}
              placeholder={mfaLocalExample}
              onIonInput={(event: IonInputCustomEvent<InputInputEventDetail>) =>
                setMfaPhoneNumber(event.detail.value ?? "")
              }
            />
          </IonItem>
          {mfaNormalizedPhone && (
            <IonNote className="settings-mfa-phone-preview">Will be sent as {mfaNormalizedPhone}</IonNote>
          )}
          <div className="settings-mfa-setup-actions">
            <IonButton
              expand="block"
              onClick={() => {
                void handleStartSmsMfaEnrollment();
              }}
              disabled={!mfaNormalizedPhone}
            >
              Send code
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              onClick={() => setMfaSetupStep("method")}
            >
              Back
            </IonButton>
          </div>
        </div>
      );
    }

    if (mfaSetupStep === "authenticator") {
      return (
        <div className="settings-mfa-setup-block">
          <h2>Set up your Authenticator app</h2>
          <p>
            Use Google Authenticator, Microsoft Authenticator, 1Password, or any TOTP app.
          </p>
          <IonItem lines="full">
            <IonLabel>
              <h3>Issuer</h3>
              <p>{mfaAuthenticatorIssuer}</p>
            </IonLabel>
          </IonItem>
          <IonItem lines="full">
            <IonLabel>
              <h3>Account</h3>
              <p>{mfaAuthenticatorAccount}</p>
            </IonLabel>
          </IonItem>
          <div className="settings-mfa-setup-actions">
            <IonButton
              expand="block"
              onClick={() => {
                void handleStartAuthenticatorEnrollment();
              }}
            >
              Generate setup key
            </IonButton>
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              onClick={() => {
                setMfaPendingMethod(null);
                setMfaPendingTotpSecret(null);
                setMfaSetupStep("method");
              }}
            >
              Back
            </IonButton>
          </div>
        </div>
      );
    }

    if (mfaSetupStep === "preparing") {
      return (
        <div className="settings-mfa-setup-block settings-mfa-setup-loading">
          <IonSpinner name="crescent" />
          <h2>Preparing Authenticator setup...</h2>
          <p>Generating your secure setup key.</p>
        </div>
      );
    }

    if (mfaSetupStep === "sending") {
      return (
        <div className="settings-mfa-setup-block settings-mfa-setup-loading">
          <IonSpinner name="crescent" />
          <h2>Sending verification code...</h2>
          <p>Hold on while we contact Firebase.</p>
        </div>
      );
    }

    if (mfaSetupStep === "verifying") {
      return (
        <div className="settings-mfa-setup-block settings-mfa-setup-loading">
          <IonSpinner name="crescent" />
          <h2>Verifying code...</h2>
          <p>This only takes a second.</p>
        </div>
      );
    }

    if (mfaSetupStep === "success") {
      return (
        <div className="settings-mfa-setup-block">
          <h2>2FA is enabled</h2>
          <p>
            {mfaPendingMethod === "authenticator"
              ? "You are now protected with Authenticator verification on sign-in."
              : "You are now protected with SMS verification on sign-in."}
          </p>
          <IonButton expand="block" onClick={closeMfaSetupFlow}>
            Done
          </IonButton>
        </div>
      );
    }

    return (
      <div className="settings-mfa-setup-block">
        <h2>{mfaPendingMethod === "authenticator" ? "Enter Authenticator code" : "Enter verification code"}</h2>
        {mfaPendingMethod === "authenticator" ? (
          <>
            <p>
              Add this setup key to your Authenticator app, then enter the {mfaVerifyCodeLength}-digit code.
            </p>
            {mfaAuthenticatorSecret && (
              <div className="settings-mfa-secret-block">
                <IonNote className="settings-mfa-secret-key">{mfaAuthenticatorSecret}</IonNote>
                <IonButton
                  size="small"
                  fill="outline"
                  onClick={() => {
                    void handleCopyMfaSecret();
                  }}
                >
                  Copy setup key
                </IonButton>
              </div>
            )}
          </>
        ) : (
          <p>
            {mfaPendingPhone
              ? `We sent a 6-digit code to ${mfaPendingPhone}.`
              : "We sent a 6-digit code to your phone."}
          </p>
        )}
        <IonItem lines="full">
          <IonInput
            type="tel"
            inputmode="numeric"
            maxlength={mfaVerifyCodeLength}
            value={mfaEnrollmentCode}
            placeholder={`${mfaVerifyCodeLength}-digit code`}
            onIonInput={(event: IonInputCustomEvent<InputInputEventDetail>) => {
              const next = (event.detail.value ?? "").replace(/[^\d]/g, "").slice(0, mfaVerifyCodeLength);
              setMfaEnrollmentCode(next);
            }}
          />
        </IonItem>
        <div className="settings-mfa-setup-actions">
          <IonButton
            expand="block"
              onClick={() => {
                void handleConfirmMfaEnrollment();
              }}
              disabled={mfaEnrollmentCode.trim().length !== mfaVerifyCodeLength}
            >
              Verify and enable
            </IonButton>
          <IonButton
            expand="block"
              fill="clear"
              color="medium"
              onClick={handleCancelMfaEnrollment}
            >
              {mfaPendingMethod === "authenticator" ? "Use another method" : "Use another number"}
            </IonButton>
          </div>
        </div>
    );
  };

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
                      if (isDemoMode) {
                        setToast({
                          show: true,
                          message: "Profile photo updates are disabled in demo mode.",
                          color: "medium",
                        });
                        return;
                      }
                      setShowPhotoActions(true);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Update profile photo"
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        console.log(`[USER ACTION] Settings: Keyboard action on profile photo avatar`, { key: event.key });
                        if (isDemoMode) {
                          setToast({
                            show: true,
                            message: "Profile photo updates are disabled in demo mode.",
                            color: "medium",
                          });
                          return;
                        }
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
                    <h2>{accountUser.displayName || "Unnamed User"}</h2>
                    <p>{accountUser.email}</p>
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
                    disabled={verified || isDemoMode}
                  >
                    <IonIcon slot="start" icon={mailOutline} />
                    {verified ? "Verified" : "Send link"}
                  </IonButton>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Password</IonLabel>
                  <IonButton onClick={handleResetPassword} disabled={isDemoMode}>
                    <IonIcon slot="start" icon={keyOutline} />
                    Send reset email
                  </IonButton>
                </IonItem>
                <IonItem lines="full">
                  <IonIcon slot="start" icon={shieldCheckmarkOutline} />
                  <IonLabel>
                    <h2>Two-factor authentication (2FA)</h2>
                    <p>{mfaStatusSummary}</p>
                  </IonLabel>
                  {mfaEnabled ? (
                    <IonButton
                      fill="outline"
                      color="danger"
                      onClick={() => {
                        void handleDisableMfa();
                      }}
                      disabled={mfaVerifyingCode || isDemoMode}
                    >
                      Disable
                    </IonButton>
                  ) : (
                    <IonButton
                      fill="outline"
                      onClick={openMfaSetupFlow}
                      disabled={mfaStatusLoading || isDemoMode}
                    >
                      Set up
                    </IonButton>
                  )}
                </IonItem>
              </IonList>
              <div ref={mfaRecaptchaContainerRef} className="settings-mfa-recaptcha" aria-hidden="true" />
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
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to setup profile page`);
                    history.push(SETTINGS_ROUTES.profile);
                  }}
                >
                  <IonLabel>Profile, goals & targets</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to energy needs page`);
                    history.push(SETTINGS_ROUTES.energyNeeds);
                  }}
                >
                  <IonLabel>
                    <h2>Change energy needs</h2>
                    <p>Set your calories and macro targets</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to units page`);
                    history.push(SETTINGS_ROUTES.units);
                  }}
                >
                  <IonLabel>
                    <h2>Units & measurements</h2>
                    <p>Choose metric or imperial units</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to reminders page`);
                    history.push(SETTINGS_ROUTES.reminders);
                  }}
                >
                  <IonLabel>
                    <h2>Reminders</h2>
                    <p>Set meal, weigh-in, and workout reminders</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to data privacy page`);
                    history.push(SETTINGS_ROUTES.dataPrivacy);
                  }}
                >
                  <IonLabel>
                    <h2>Data & privacy</h2>
                    <p>Manage exports and account privacy controls</p>
                  </IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Navigate to sharing page`);
                    history.push(SETTINGS_ROUTES.sharing);
                  }}
                >
                  <IonIcon slot="start" icon={peopleOutline} />
                  <IonLabel>
                    <h2>Sharing</h2>
                    <p>Pair with a dietitian, parent, or friend</p>
                  </IonLabel>
                </IonItem>
                {clinicianCollabEnabled && (
                  <IonItem
                    lines="full"
                    button
                    disabled={isDemoMode}
                    onClick={() => {
                      history.push(
                        role === "clinician" || role === "admin"
                          ? SETTINGS_ROUTES.clinicianDashboard
                          : SETTINGS_ROUTES.clinicianConnect
                      );
                    }}
                  >
                    <IonIcon slot="start" icon={medicalOutline} />
                    <IonLabel>
                      <h2>
                        {role === "clinician" || role === "admin"
                          ? "Clinician dashboard"
                          : "Clinician collaboration"}
                      </h2>
                      <p>
                        {role === "clinician" || role === "admin"
                          ? "Assigned users, care plans, alerts, and secure messaging"
                          : clinicianLink?.status === "active"
                            ? `Connected to ${clinicianLink.clinicianName}`
                            : "Connect to a clinician with consent"}
                      </p>
                    </IonLabel>
                  </IonItem>
                )}
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
                <IonItem
                  lines="none"
                  button
                  disabled={isDemoMode}
                  onClick={() => {
                    console.log("[USER ACTION] Settings: Navigate to home feed customization page");
                    history.push(SETTINGS_ROUTES.homeFeed);
                  }}
                >
                  <IonLabel>
                    <h2>Customize Home & Add Food</h2>
                    <p>{enabledHomeFeedItems}/4 sections enabled</p>
                  </IonLabel>
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
                <IonItem
                  lines="none"
                  button
                  onClick={() => {
                    console.log("[USER ACTION] Settings: Navigate to appearance settings page");
                    history.push(SETTINGS_ROUTES.appearance);
                  }}
                >
                  <IonIcon slot="start" icon={colorPaletteOutline} />
                  <IonLabel>
                    <h2>Appearance & performance</h2>
                    <p>{appearanceSummary}</p>
                  </IonLabel>
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
                  disabled={clearingRecent || isDemoMode}
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Clear recent foods clicked`);
                    setConfirmClearRecent(true);
                  }}
                >
                  <IonIcon slot="start" icon={trashOutline} />
                  <IonLabel>
                    <h2>Clear quick history chips</h2>
                    <p>Removes Add Food search history chips synced in your account.</p>
                  </IonLabel>
                  {clearingRecent && (
                    <IonNote slot="end" color="medium">
                      Clearing…
                    </IonNote>
                  )}
                </IonItem>
                <IonItem
                  lines="none"
                  button
                  onClick={() => {
                    console.log(`[USER ACTION] Settings: Clear recent searches clicked`);
                    setConfirmClearRecentSearches(true);
                  }}
                >
                  <IonIcon slot="start" icon={searchOutline} />
                  <IonLabel>
                    <h2>Clear recent searches</h2>
                    <p>Clears Add Food search history on this device only.</p>
                  </IonLabel>
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
                    history.push(SETTINGS_ROUTES.changelog);
                  }}
                >
                  <IonIcon slot="start" icon={newspaperOutline} />
                  <IonLabel>Changelog</IonLabel>
                </IonItem>
                <IonItem
                  lines="full"
                  button
                  disabled={isDemoMode}
                    onClick={() => {
                      console.log(`[USER ACTION] Settings: Navigate to feedback page`);
                      trackEvent("settings_feedback_open", { uid: user?.uid });
                      history.push(SETTINGS_ROUTES.feedback);
                    }}
                >
                  <IonIcon slot="start" icon={chatbubbleEllipsesOutline} />
                  <IonLabel>Send feedback</IonLabel>
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
              <IonCardTitle className="settings-card-title">Tools</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonList>
                <IonItem
                  lines="full"
                  button
                  routerLink="/recipe-calculator"
                    onClick={() => {
                      console.log(`[USER ACTION] Settings: Recipe Calculator clicked`);
                      trackEvent("settings_recipe_calculator_open", { uid: user?.uid });
                    }}
                >
                  <IonIcon slot="start" icon={cafeOutline} />
                  <IonLabel>
                    <h2>Recipe Calculator</h2>
                    <p>Calculate nutrition for your recipes</p>
                  </IonLabel>
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
                    history.replace("/start");
                  }}
                >
                  <IonIcon slot="start" icon={logOutOutline} />
                  <IonLabel>Sign out</IonLabel>
                </IonItem>
                <IonItem
                  lines="none"
                  button
                  onClick={() => {
                    console.log("[USER ACTION] Settings: Navigate to delete account flow");
                    history.push(SETTINGS_ROUTES.deleteAccount);
                  }}
                >
                  <IonIcon slot="start" icon={trashOutline} color="danger" />
                  <IonLabel>
                    <h2>Delete account</h2>
                    <p>Permanently remove your MacroPal account and data</p>
                  </IonLabel>
                </IonItem>
              </IonList>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>

      <IonModal
        isOpen={showMfaSetupModal}
        canDismiss={mfaSetupCanDismiss}
        onDidDismiss={closeMfaSetupFlow}
        className="settings-mfa-modal"
      >
        <IonPage>
          <IonHeader>
            <IonToolbar>
              <IonTitle>2FA setup</IonTitle>
              <IonButton
                slot="end"
                fill="clear"
                color="medium"
                onClick={closeMfaSetupFlow}
                disabled={!mfaSetupCanDismiss}
              >
                Close
              </IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding settings-mfa-setup-content">
            {renderMfaSetupScreen()}
          </IonContent>
        </IonPage>
      </IonModal>

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
        isOpen={confirmClearRecent}
        header="Clear recent foods?"
        message="This clears quick history chips in Add Food search. Diary entries, favorites, and the Recently eaten list stay."
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
        isOpen={confirmClearRecentSearches}
        header="Clear recent searches?"
        message="This removes your Add Food search history on this device."
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Settings: Clear recent searches alert cancelled`);
              setConfirmClearRecentSearches(false);
            },
          },
          {
            text: "Clear",
            role: "destructive",
            handler: () => {
              console.log(`[USER ACTION] Settings: Clear recent searches alert - Clear confirmed`);
              setConfirmClearRecentSearches(false);
              handleClearRecentSearches();
            },
          },
        ]}
        onDidDismiss={() => {
          console.log(`[USER ACTION] Settings: Clear recent searches alert dismissed`);
          setConfirmClearRecentSearches(false);
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
