// src/UpdateGate.tsx
import React, { useEffect, useState } from "react";
import { IonToast, IonButton } from "@ionic/react";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { APP_VERSION } from "./hooks/version";

type AppConfig = {
  latestVersion?: string;
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  changelogUrl?: string;
  storeUrl?: string;
};

function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
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
        } else if (isBehindLatest) {
          setShowSoftBanner(true);
        }
      } catch (e) {
        console.error("update-check error:", e);
      }
    };

    run();
  }, []);

  const update = () => {
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
          textAlign: "center",
        }}
      >
        <h2>Update required</h2>
        <p style={{ marginTop: 8 }}>
          You’re using an old version of MacroPal (v{APP_VERSION}).<br />
          Please update to the latest version to continue.
        </p>
        <div style={{ marginTop: 16 }}>
          <IonButton onClick={update}>Update app</IonButton>
          {config.changelogUrl && (
            <IonButton
              fill="outline"
              href={config.changelogUrl}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 8 }}
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
        onDidDismiss={() => setShowSoftBanner(false)}
        message={`A new version of MacroPal is available.`}
        duration={0}
        buttons={[
          {
            text: "Later",
            role: "cancel",
          },
          {
            text: "Update",
            handler: update,
          },
        ]}
      />
    </>
  );
};

export default UpdateGate;