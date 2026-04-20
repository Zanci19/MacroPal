import React, { useEffect, useRef, useState } from "react";
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonToast,
  IonSpinner,
  IonText,
  IonAlert,
  IonChip,
} from "@ionic/react";
import {
  copyOutline,
  refreshOutline,
  personAddOutline,
  eyeOutline,
  eyeOffOutline,
  trashOutline,
  peopleOutline,
  timeOutline,
  shieldCheckmarkOutline,
  linkOutline,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { auth, trackEvent } from "../../firebase";
import { useSharing } from "../../hooks/useSharing";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import "./Sharing.css";

const Sharing: React.FC = () => {
  const history = useHistory();
  const user = auth.currentUser;
  const {
    pairingCode,
    pairingExpiresAt,
    generatePairingCode,
    redeemPairingCode,
    sharedUsers,
    viewers,
    removeSharedUser,
    removeViewer,
    loading,
  } = useSharing();

  const [codeInput, setCodeInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color?: string;
  }>({ show: false, message: "", color: "success" });
  const [showUid, setShowUid] = useState(false);
  const [confirmRemoveShared, setConfirmRemoveShared] = useState<string | null>(null);
  const [confirmRemoveViewer, setConfirmRemoveViewer] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── countdown timer for pairing code ────────── */
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!pairingExpiresAt) {
      setCountdown(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((pairingExpiresAt.getTime() - Date.now()) / 1000),
      );
      setCountdown(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pairingExpiresAt]);

  /* ── handlers ─────────────────────────────────── */
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generatePairingCode();
      trackEvent("sharing_code_generated", { uid: user?.uid ?? "" });
    } catch (err: unknown) {
      const e = err as Error;
      setToast({ show: true, message: e.message || "Could not generate code", color: "danger" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode).then(
      () => setToast({ show: true, message: "Code copied!", color: "success" }),
      () => setToast({ show: true, message: "Could not copy", color: "warning" }),
    );
    trackEvent("sharing_code_copied", { uid: user?.uid ?? "" });
  };

  const handleRedeem = async () => {
    const trimmed = codeInput.trim();
    if (!/^\d{8}$/.test(trimmed)) {
      setToast({ show: true, message: "Please enter a valid 8-digit code", color: "warning" });
      return;
    }
    setRedeeming(true);
    try {
      const entry = await redeemPairingCode(trimmed);
      setToast({
        show: true,
        message: `Paired with ${entry.displayName}!`,
        color: "success",
      });
      setCodeInput("");
      trackEvent("sharing_code_redeemed", { uid: user?.uid ?? "" });
    } catch (err: unknown) {
      const e = err as Error;
      setToast({ show: true, message: e.message || "Could not redeem code", color: "danger" });
    } finally {
      setRedeeming(false);
    }
  };

  const handleRemoveShared = async (uid: string) => {
    const entry = sharedUsers.find((s) => s.uid === uid);
    if (!entry) return;
    try {
      await removeSharedUser(entry);
      setToast({ show: true, message: "User removed", color: "success" });
      trackEvent("sharing_user_removed", { uid: user?.uid ?? "", targetUid: uid });
    } catch (err: unknown) {
      const e = err as Error;
      setToast({ show: true, message: e.message || "Could not remove user", color: "danger" });
    }
  };

  const handleRemoveViewer = async (uid: string) => {
    const entry = viewers.find((v) => v.uid === uid);
    if (!entry) return;
    try {
      await removeViewer(entry);
      setToast({ show: true, message: "Viewer removed", color: "success" });
      trackEvent("sharing_viewer_removed", { uid: user?.uid ?? "", targetUid: uid });
    } catch (err: unknown) {
      const e = err as Error;
      setToast({ show: true, message: e.message || "Could not remove viewer", color: "danger" });
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (!user) return null;

  return (
    <SettingsSubpageLayout
      title="Sharing"
      subtitle="Pair with someone to share intake data or monitor another user's diary."
      backHref={SETTINGS_ROUTES.root}
      className="sharing-page"
    >
        {loading ? (
          <div className="sharing-loading">
            <IonSpinner />
            <p>Loading sharing data…</p>
          </div>
        ) : (
          <div className="sharing-sections">
            {/* ─── Your unique ID ───────────────────── */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="sharing-card-title">
                  <IonIcon icon={shieldCheckmarkOutline} className="sharing-title-icon" />
                  Your unique ID
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="medium">
                  <p className="sharing-help-text">
                    Your account ID is unique and used internally for pairing. Share your pairing
                    code instead.
                  </p>
                </IonText>
                <div className="sharing-uid-box">
                  <code>{showUid ? user.uid : `${user.uid.slice(0, 4)}••••••••${user.uid.slice(-4)}`}</code>
                  <IonButton
                    fill="clear"
                    size="small"
                    onClick={() => setShowUid((prev) => !prev)}
                  >
                    <IonIcon slot="start" icon={showUid ? eyeOffOutline : eyeOutline} />
                    {showUid ? "Hide" : "Show"}
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>

            {/* ─── I want others to see my data (sharer / client) ── */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="sharing-card-title">
                  <IonIcon icon={linkOutline} className="sharing-title-icon" />
                  Share my intake
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="medium">
                  <p className="sharing-help-text">
                    Generate a pairing code and give it to your dietitian, parent, or anyone who
                    should see your food intake and analytics. The code is valid for 5 minutes.
                  </p>
                </IonText>

                {pairingCode && countdown > 0 ? (
                  <div className="sharing-code-display">
                    <span className="sharing-code-value">{pairingCode}</span>
                    <div className="sharing-code-meta">
                      <IonChip color={countdown <= 60 ? "danger" : "medium"} outline>
                        <IonIcon icon={timeOutline} />
                        <IonLabel>{formatCountdown(countdown)}</IonLabel>
                      </IonChip>
                    </div>
                    <div className="sharing-code-actions">
                      <IonButton fill="outline" size="small" onClick={handleCopyCode}>
                        <IonIcon slot="start" icon={copyOutline} />
                        Copy
                      </IonButton>
                      <IonButton
                        fill="outline"
                        size="small"
                        onClick={handleGenerate}
                        disabled={generating}
                      >
                        <IonIcon slot="start" icon={refreshOutline} />
                        Refresh
                      </IonButton>
                    </div>
                  </div>
                ) : (
                  <IonButton
                    expand="block"
                    onClick={handleGenerate}
                    disabled={generating}
                    className="sharing-generate-btn"
                  >
                    {generating ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={linkOutline} />
                        Generate pairing code
                      </>
                    )}
                  </IonButton>
                )}

                {/* Viewers list */}
                {viewers.length > 0 && (
                  <div className="sharing-list-section">
                    <IonText color="medium">
                      <p className="sharing-list-heading">People who can see your data:</p>
                    </IonText>
                    <IonList>
                      {viewers.map((v) => (
                        <IonItem key={v.uid} lines="full">
                          <IonIcon icon={eyeOutline} slot="start" color="primary" />
                          <IonLabel>
                            <h3>{v.displayName}</h3>
                            <p>
                              Paired{" "}
                              {new Date(v.pairedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </IonLabel>
                          <IonButton
                            fill="clear"
                            color="danger"
                            slot="end"
                            onClick={() => setConfirmRemoveViewer(v.uid)}
                          >
                            <IonIcon icon={trashOutline} />
                          </IonButton>
                        </IonItem>
                      ))}
                    </IonList>
                  </div>
                )}
              </IonCardContent>
            </IonCard>

            {/* ─── I want to see others' data (viewer / dietitian) ── */}
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="sharing-card-title">
                  <IonIcon icon={peopleOutline} className="sharing-title-icon" />
                  View someone's intake
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <IonText color="medium">
                  <p className="sharing-help-text">
                    Enter the 8-digit pairing code from the person whose food intake you want to
                    monitor. You'll be able to see their full diary, foods, and analytics.
                  </p>
                </IonText>

                <div className="sharing-redeem-row">
                  <IonInput
                    className="sharing-code-input"
                    type="text"
                    inputMode="numeric"
                    maxlength={8}
                    placeholder="Enter 8-digit code"
                    value={codeInput}
                    onIonInput={(e) => setCodeInput(e.detail.value ?? "")}
                  />
                  <IonButton
                    onClick={handleRedeem}
                    disabled={redeeming || codeInput.trim().length !== 8}
                  >
                    {redeeming ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      <>
                        <IonIcon slot="start" icon={personAddOutline} />
                        Pair
                      </>
                    )}
                  </IonButton>
                </div>

                {/* Shared users list */}
                {sharedUsers.length > 0 && (
                  <div className="sharing-list-section">
                    <IonText color="medium">
                      <p className="sharing-list-heading">People you are monitoring:</p>
                    </IonText>
                    <IonList>
                      {sharedUsers.map((s) => (
                          <IonItem
                            key={s.uid}
                            lines="full"
                            button
                            onClick={() => history.push(SETTINGS_ROUTES.sharedUser(s.uid))}
                          >
                          <IonIcon icon={eyeOutline} slot="start" color="primary" />
                          <IonLabel>
                            <h3>{s.displayName}</h3>
                            <p>
                              Paired{" "}
                              {new Date(s.pairedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </IonLabel>
                          <IonButton
                            fill="clear"
                            color="danger"
                            slot="end"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRemoveShared(s.uid);
                            }}
                          >
                            <IonIcon icon={trashOutline} />
                          </IonButton>
                        </IonItem>
                      ))}
                    </IonList>
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </div>
        )}

        {/* ─── Alerts ───────────────────────────── */}
        <IonAlert
          isOpen={!!confirmRemoveShared}
          header="Remove user"
          message="You will no longer see this person's intake data. You can re-pair later."
          buttons={[
            { text: "Cancel", role: "cancel", handler: () => setConfirmRemoveShared(null) },
            {
              text: "Remove",
              role: "destructive",
              handler: () => {
                if (confirmRemoveShared) void handleRemoveShared(confirmRemoveShared);
                setConfirmRemoveShared(null);
              },
            },
          ]}
          onDidDismiss={() => setConfirmRemoveShared(null)}
        />

        <IonAlert
          isOpen={!!confirmRemoveViewer}
          header="Remove viewer"
          message="This person will no longer be able to see your intake data."
          buttons={[
            { text: "Cancel", role: "cancel", handler: () => setConfirmRemoveViewer(null) },
            {
              text: "Remove",
              role: "destructive",
              handler: () => {
                if (confirmRemoveViewer) void handleRemoveViewer(confirmRemoveViewer);
                setConfirmRemoveViewer(null);
              },
            },
          ]}
          onDidDismiss={() => setConfirmRemoveViewer(null)}
        />

        <IonToast
          isOpen={toast.show}
          message={toast.message}
          color={toast.color}
          duration={2500}
          onDidDismiss={() => setToast((t) => ({ ...t, show: false }))}
        />
    </SettingsSubpageLayout>
  );
};

export default Sharing;
