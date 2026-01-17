// src/UpdateGate.tsx
import React, { useEffect, useState } from "react";
import { IonToast, IonButton } from "@ionic/react";
import { db, trackEvent } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { APP_VERSION } from "./hooks/version";

type AppConfig = {
  latestVersion?: string;
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  changelogUrl?: string;
  storeUrl?: string;
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
  const [showSoftBanner, setShowSoftBanner] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const ref = doc(db, "meta", "appConfig");
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const data = snap.data() as AppConfig;
        setConfig(data);

        const latest = data.latestVersion || APP_VERSION;
        const minSupported = data.minSupportedVersion || APP_VERSION;
        const forceUpdate = !!data.forceUpdate;

        const isBelowMin = cmpVersion(APP_VERSION, minSupported) < 0;
        const isBehindLatest = cmpVersion(APP_VERSION, latest) < 0;

        if (isBelowMin || forceUpdate) {
          setHardBlocked(true);
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
    if (config?.latestVersion) {
      setDismissedVersion(config.latestVersion);
    }
    setShowSoftBanner(false);
  };

  const update = (source: "hard_block" | "soft_banner") => {
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

  if (hardBlocked && config) {
    return (
      <div
        className="ion-padding"
        style={{
          height: "100vh",
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
              onClick={() => trackEvent("update_changelog_click", { source: "hard_block" })}
            >
              What&apos;s new
            </IonButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <IonToast
        isOpen={showSoftBanner}
        onDidDismiss={dismissBanner}
        message={`A new version of MacroPal is available.`}
        duration={0}
        buttons={[
          {
            text: "Later",
            role: "cancel",
            handler: () => {
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
    </>
  );
};

export default UpdateGate;
