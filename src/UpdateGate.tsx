// src/UpdateGate.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { IonToast, IonButton } from "@ionic/react";
import { db, trackEvent } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { APP_VERSION } from "./hooks/version";

type FeatureFlags = {
  barcodeScanner?: boolean;
  debugOverlay?: boolean;
  clinicianCollaboration?: boolean;
};

type AppConfig = {
  latestVersion?: string;
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  changelogUrl?: string;
  storeUrl?: string;
  maintenanceMode?: {
    enabled?: boolean;
    message?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  };
  featureFlags?: FeatureFlags;
};

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  barcodeScanner: true,
  debugOverlay: false,
  clinicianCollaboration: false,
};

const mergeFeatureFlags = (config?: AppConfig | null): FeatureFlags => ({
  ...DEFAULT_FEATURE_FLAGS,
  ...(config?.featureFlags ?? {}),
});

const defaultConfig: AppConfig = {
  featureFlags: DEFAULT_FEATURE_FLAGS,
};

const RemoteConfigContext = createContext<AppConfig>(defaultConfig);

// eslint-disable-next-line react-refresh/only-export-components
export const useRemoteConfig = () => useContext(RemoteConfigContext);

// Returns the resolved feature flag value; falls back when a flag is undefined or not a boolean.
// eslint-disable-next-line react-refresh/only-export-components
export const isFeatureEnabled = (
  config: AppConfig | null | undefined,
  flag: keyof FeatureFlags,
) => {
  const mergedFlags = mergeFeatureFlags(config);
  const value = mergedFlags[flag];
  if (typeof value === "boolean") return value;
  return false;
};

const DISMISSED_VERSION_KEY = "mp_dismissed_update_version";

function cmpVersion(a: string, b: string): number {
  const parsePart = (part: string) => {
    const value = Number.parseInt(part, 10);
    return Number.isFinite(value) ? value : 0;
  };
  const pa = a.split(".").map(parsePart);
  const pb = b.split(".").map(parsePart);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_VERSION_KEY);
  } catch (e) {
    console.warn("Could not read dismissed version:", e);
    return null;
  }
}

function setDismissedVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, version);
  } catch (e) {
    console.warn("Could not save dismissed version:", e);
  }
}

interface UpdateGateProps {
  children: React.ReactNode;
}

const UpdateGate: React.FC<UpdateGateProps> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [hardBlocked, setHardBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState<"update" | "maintenance" | null>(null);
  const [showSoftBanner, setShowSoftBanner] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const ref = doc(db, "meta", "appConfig");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as AppConfig;
        const mergedConfig: AppConfig = {
          ...data,
          featureFlags: mergeFeatureFlags(data),
        };
        setConfig(mergedConfig);

        const latest = mergedConfig.latestVersion || APP_VERSION;
        const minSupported = mergedConfig.minSupportedVersion || APP_VERSION;
        const forceUpdate = !!mergedConfig.forceUpdate;

        const isBelowMin = cmpVersion(APP_VERSION, minSupported) < 0;
        const isBehindLatest = cmpVersion(APP_VERSION, latest) < 0;

        if (mergedConfig.maintenanceMode?.enabled) {
          setHardBlocked(true);
          setBlockReason("maintenance");
          trackEvent("maintenance_mode_block", {
            currentVersion: APP_VERSION,
          });
          return;
        }

        if (isBelowMin || forceUpdate) {
          setHardBlocked(true);
          setBlockReason("update");
          trackEvent("update_required_block", {
            currentVersion: APP_VERSION,
            minSupported,
            latest,
            forceUpdate,
          });
        } else if (isBehindLatest) {
          // Check if user has already dismissed this version
          const dismissedVersion = getDismissedVersion();
          const hasNotDismissedThisVersion = !dismissedVersion || cmpVersion(latest, dismissedVersion) > 0;
          
          if (hasNotDismissedThisVersion) {
            setShowSoftBanner(true);
            trackEvent("update_available_banner_shown", {
              currentVersion: APP_VERSION,
              latest,
              dismissedVersion,
            });
          } else {
            trackEvent("update_available_banner_suppressed", {
              currentVersion: APP_VERSION,
              latest,
              dismissedVersion,
            });
          }
        } else {
          trackEvent("update_check_current", {
            currentVersion: APP_VERSION,
          });
        }
      } catch (e) {
        console.error("update-check error:", e);
      }
    };

    run();
  }, []);

  const dismissBanner = () => {
    console.log(`[USER ACTION] Update Banner: Dismissed update notification`, {
      latestVersion: config?.latestVersion,
      currentVersion: APP_VERSION,
    });
    if (config?.latestVersion) {
      setDismissedVersion(config.latestVersion);
    }
    setShowSoftBanner(false);
  };

  const update = (source: "hard_block" | "soft_banner") => {
    console.log(`[USER ACTION] Update App: Clicked update button`, {
      source,
      hasStoreUrl: !!config?.storeUrl,
      currentVersion: APP_VERSION,
      latestVersion: config?.latestVersion,
    });
    trackEvent("update_prompt_click", {
      source,
      hasStoreUrl: !!config?.storeUrl,
    });
    if (config?.storeUrl) {
      window.location.href = config.storeUrl;
    } else {
      window.location.reload(); // fallback
    }
  };

  const providerValue = useMemo(() => config ?? defaultConfig, [config]);

  if (hardBlocked && config) {
    if (blockReason === "maintenance" && config.maintenanceMode) {
      return (
        <RemoteConfigContext.Provider value={providerValue}>
          <div
            className="ion-padding"
            style={{
              minHeight: "100vh",
              height: "100dvh",
              width: "100%",
              boxSizing: "border-box",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <h2>We&apos;ll be back soon</h2>
            <p style={{ marginTop: 8, maxWidth: 480 }}>
              {config.maintenanceMode.message ?? "MacroPal is undergoing maintenance. Please try again shortly."}
            </p>
            {config.maintenanceMode.ctaUrl && (
              <IonButton
                style={{ marginTop: 16 }}
                fill="solid"
                href={config.maintenanceMode.ctaUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  console.log(`[USER ACTION] Maintenance CTA: Clicked maintenance status link`, {
                    url: config.maintenanceMode!.ctaUrl,
                  });
                  trackEvent("maintenance_cta_click");
                }}
              >
                {config.maintenanceMode.ctaLabel ?? "View status"}
              </IonButton>
            )}
          </div>
        </RemoteConfigContext.Provider>
      );
    }

    return (
      <RemoteConfigContext.Provider value={providerValue}>
        <div
          className="ion-padding"
          style={{
            minHeight: "100vh",
            height: "100dvh",
            width: "100%",
            boxSizing: "border-box",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <h2>Update required</h2>
          <p style={{ marginTop: 8 }}>
            You’re using an old version of MacroPal (v{APP_VERSION}).<br />
            Please update to the latest version to continue.
          </p>
          <div style={{ marginTop: 16 }}>
            <IonButton onClick={() => update("hard_block")}>Update app</IonButton>
            {config.changelogUrl && (
              <IonButton
                fill="outline"
                href={config.changelogUrl}
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  console.log(`[USER ACTION] Update Changelog: Clicked changelog link`, {
                    url: config.changelogUrl,
                    source: "hard_block",
                  });
                  trackEvent("update_changelog_click", { source: "hard_block" });
                }}
              >
                What&apos;s new
              </IonButton>
            )}
          </div>
        </div>
      </RemoteConfigContext.Provider>
    );
  }

  return (
    <RemoteConfigContext.Provider value={providerValue}>
      {children}
      <IonToast
        data-testid="update-toast"
        isOpen={showSoftBanner}
        onDidDismiss={dismissBanner}
        message={`A new version of MacroPal is available.`}
        duration={0}
        buttons={[
          {
            text: "Later",
            role: "cancel",
            handler: () => {
              console.log(`[USER ACTION] Update Prompt: Dismissed soft update banner`, {
                currentVersion: APP_VERSION,
                latestVersion: config?.latestVersion,
              });
              dismissBanner();
              trackEvent("update_prompt_dismiss", { source: "soft_banner" });
            },
          },
          {
            text: "Update",
            handler: () => update("soft_banner"),
          },
        ]}
      />
    </RemoteConfigContext.Provider>
  );
};

export default UpdateGate;
