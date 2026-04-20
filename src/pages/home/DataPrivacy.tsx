import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IonAlert,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonToast,
} from "@ionic/react";
import {
  analyticsOutline,
  cloudUploadOutline,
  keyOutline,
  shieldCheckmarkOutline,
  trashOutline,
  warningOutline,
} from "ionicons/icons";
import { useHistory } from "react-router";
import {
  EmailAuthProvider,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  TotpMultiFactorGenerator,
  deleteUser,
  getMultiFactorResolver,
  reauthenticateWithCredential,
  type MultiFactorError,
  type MultiFactorResolver,
  type PhoneMultiFactorInfo,
  type TotpMultiFactorInfo,
} from "firebase/auth";
import { auth, trackEvent } from "../../firebase";
import { shareOrDownload } from "../../utils/exportUtils";
import SettingsSubpageLayout from "../../components/settings/SettingsSubpageLayout";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";
import {
  backupPayloadToCsv,
  buildSimplePdfDocument,
  fetchUserBackupPayload,
  parseBackupPayloadCsv,
  resetAndImportUserBackup,
  summarizeBackup,
  type UserBackupPayload,
} from "../../utils/userDataBackup";

type ExportFormat = "pdf" | "json" | "csv";
type ImportMfaMethod = "sms" | "authenticator";

const DataPrivacy: React.FC = () => {
  const history = useHistory();
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [parsingImportFile, setParsingImportFile] = useState(false);
  const [pendingImport, setPendingImport] = useState<UserBackupPayload | null>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState<string | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const [importAuthBusy, setImportAuthBusy] = useState(false);
  const [importMfaResolver, setImportMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [importMfaMethod, setImportMfaMethod] = useState<ImportMfaMethod | null>(null);
  const [importMfaVerificationId, setImportMfaVerificationId] = useState<string | null>(null);
  const [importMfaTotpEnrollmentId, setImportMfaTotpEnrollmentId] = useState<string | null>(
    null
  );
  const [importMfaMaskedPhone, setImportMfaMaskedPhone] = useState<string | null>(null);
  const [importMfaCode, setImportMfaCode] = useState("");
  const [toast, setToast] = useState<{ open: boolean; message: string; color?: string }>({
    open: false,
    message: "",
    color: "success",
  });

  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const importRecaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const importRecaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const [showDeleteStep1, setShowDeleteStep1] = useState(false);
  const [showDeleteStep2, setShowDeleteStep2] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pendingImportSummary = useMemo(
    () => (pendingImport ? summarizeBackup(pendingImport) : null),
    [pendingImport]
  );

  const clearImportRecaptchaVerifier = () => {
    if (!importRecaptchaVerifierRef.current) return;
    try {
      importRecaptchaVerifierRef.current.clear();
    } catch (error) {
      console.warn("Failed to clear import reCAPTCHA verifier:", error);
    } finally {
      importRecaptchaVerifierRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearImportRecaptchaVerifier();
    },
    []
  );

  const resetImportMfaState = () => {
    setImportMfaResolver(null);
    setImportMfaMethod(null);
    setImportMfaVerificationId(null);
    setImportMfaTotpEnrollmentId(null);
    setImportMfaMaskedPhone(null);
    setImportMfaCode("");
    clearImportRecaptchaVerifier();
  };

  const ensureImportRecaptchaVerifier = async () => {
    const container = importRecaptchaContainerRef.current;
    if (!container) {
      throw new Error("Security verifier is not ready. Please try again.");
    }

    if (importRecaptchaVerifierRef.current) {
      return importRecaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, container, {
      size: "invisible",
    });
    await verifier.render();
    importRecaptchaVerifierRef.current = verifier;
    return verifier;
  };

  const exportFullData = async (format: ExportFormat) => {
    const user = auth.currentUser;
    if (!user) {
      setToast({ open: true, message: "Please log in first.", color: "warning" });
      return;
    }
    if (isDemoMode) {
      setToast({ open: true, message: "Export is disabled in demo mode.", color: "warning" });
      return;
    }
    if (exportingFormat) return;

    setExportingFormat(format);

    try {
      const payload = await fetchUserBackupPayload(user.uid, user.email ?? null);
      const dateLabel = payload.exportedAt.slice(0, 10);

      if (format === "json") {
        const fileName = `macropal_full_backup_${dateLabel}.json`;
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const file = new File([blob], fileName, { type: "application/json" });
        await shareOrDownload(file, fileName);
      } else if (format === "csv") {
        const fileName = `macropal_full_backup_${dateLabel}.csv`;
        const csv = backupPayloadToCsv(payload);
        const blob = new Blob([csv], { type: "text/csv" });
        const file = new File([blob], fileName, { type: "text/csv" });
        await shareOrDownload(file, fileName);
      } else {
        const summary = summarizeBackup(payload);
        const lines = [
          "MacroPal Full Backup Summary",
          `Exported at: ${payload.exportedAt}`,
          `User email: ${payload.user.email ?? "unknown"}`,
          "",
          `Total documents: ${summary.totalDocs}`,
          ...summary.counts.map((entry) => `${entry.collectionName}: ${entry.count}`),
        ];
        const pdf = buildSimplePdfDocument(lines.join("\n"));
        const fileName = `macropal_full_backup_${dateLabel}.pdf`;
        const blob = new Blob([pdf], { type: "application/pdf" });
        const file = new File([blob], fileName, { type: "application/pdf" });
        await shareOrDownload(file, fileName);
      }

      trackEvent("data_privacy_export_success", { uid: user.uid, format });
      setToast({ open: true, message: `Exported ${format.toUpperCase()} backup.` });
    } catch (error) {
      console.error("Failed to export backup:", error);
      trackEvent("data_privacy_export_error", {
        uid: user.uid,
        format,
        error: (error as { message?: string })?.message ?? "unknown",
      });
      setToast({
        open: true,
        message: "Could not export data. Please try again.",
        color: "danger",
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleSelectCsvImport = () => {
    if (isDemoMode) {
      setToast({ open: true, message: "Import is disabled in demo mode.", color: "warning" });
      return;
    }
    importFileInputRef.current?.click();
  };

  const handleImportFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsingImportFile(true);
    try {
      const text = await file.text();
      const parsed = parseBackupPayloadCsv(text);
      setPendingImport(parsed);
      setPendingImportFileName(file.name);
      setImportPassword("");
      resetImportMfaState();
      setToast({ open: true, message: "CSV backup loaded. Authenticate to import." });
    } catch (error) {
      console.error("Failed to parse CSV backup:", error);
      setPendingImport(null);
      setPendingImportFileName(null);
      resetImportMfaState();
      setToast({
        open: true,
        message:
          (error as { message?: string })?.message ?? "Invalid CSV backup file.",
        color: "danger",
      });
    } finally {
      setParsingImportFile(false);
      event.target.value = "";
    }
  };

  const executeImport = async (uid: string) => {
    if (!pendingImport) {
      setToast({ open: true, message: "Select a CSV backup first.", color: "warning" });
      return;
    }

    setImporting(true);
    try {
      await resetAndImportUserBackup(uid, pendingImport);
      trackEvent("data_privacy_import_success", {
        uid,
        docs: summarizeBackup(pendingImport).totalDocs,
      });
      setToast({
        open: true,
        message: "Import complete. Reloading app…",
        color: "success",
      });
      setPendingImport(null);
      setPendingImportFileName(null);
      setImportPassword("");
      resetImportMfaState();
      window.setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error("Failed to import backup:", error);
      trackEvent("data_privacy_import_error", {
        uid,
        error: (error as { message?: string })?.message ?? "unknown",
      });
      setToast({
        open: true,
        message:
          (error as { message?: string })?.message ??
          "Could not import backup. Please try again.",
        color: "danger",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleAuthenticateAndImport = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setToast({
        open: true,
        message: "Please log in with an email/password account first.",
        color: "warning",
      });
      return;
    }
    if (!pendingImport) {
      setToast({ open: true, message: "Select a CSV backup first.", color: "warning" });
      return;
    }
    if (!importPassword.trim()) {
      setToast({ open: true, message: "Enter your password to continue.", color: "warning" });
      return;
    }
    if (importAuthBusy || importing) return;

    setImportAuthBusy(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, importPassword);
      await reauthenticateWithCredential(user, credential);
      await executeImport(user.uid);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === "auth/multi-factor-auth-required") {
        try {
          const resolver = getMultiFactorResolver(auth, error as MultiFactorError);
          const phoneHints = resolver.hints.filter(
            (hint) => hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID
          ) as PhoneMultiFactorInfo[];
          const totpHints = resolver.hints.filter(
            (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
          ) as TotpMultiFactorInfo[];

          if (phoneHints.length > 0) {
            const selectedHint = phoneHints[0];
            const verifier = await ensureImportRecaptchaVerifier();
            const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber(
              {
                multiFactorHint: selectedHint,
                session: resolver.session,
              },
              verifier
            );
            setImportMfaResolver(resolver);
            setImportMfaMethod("sms");
            setImportMfaVerificationId(verificationId);
            setImportMfaTotpEnrollmentId(null);
            setImportMfaMaskedPhone(selectedHint.phoneNumber ?? null);
            setImportMfaCode("");
            setToast({
              open: true,
              message: "MFA challenge started. Enter the SMS code to continue.",
              color: "warning",
            });
            return;
          }

          if (totpHints.length > 0) {
            const selectedHint = totpHints[0];
            setImportMfaResolver(resolver);
            setImportMfaMethod("authenticator");
            setImportMfaVerificationId(null);
            setImportMfaTotpEnrollmentId(selectedHint.uid);
            setImportMfaMaskedPhone(null);
            setImportMfaCode("");
            setToast({
              open: true,
              message: "Enter your Authenticator code to continue.",
              color: "warning",
            });
            return;
          }

          throw new Error("No supported MFA method was found for this account.");
        } catch (mfaError) {
          console.error("Failed to start MFA re-authentication for import:", mfaError);
          setToast({
            open: true,
            message:
              (mfaError as { message?: string })?.message ??
              "Could not start MFA verification.",
            color: "danger",
          });
          return;
        }
      }

      setToast({
        open: true,
        message: err.message || "Authentication failed. Please try again.",
        color: "danger",
      });
    } finally {
      setImportAuthBusy(false);
    }
  };

  const handleVerifyMfaAndImport = async () => {
    if (!importMfaResolver || !importMfaMethod) return;
    const code = importMfaCode.trim();
    const codePattern = importMfaMethod === "authenticator" ? /^\d{6,8}$/ : /^\d{6}$/;
    if (!codePattern.test(code)) {
      setToast({
        open: true,
        message:
          importMfaMethod === "authenticator"
            ? "Enter a valid authenticator code."
            : "Enter the 6-digit SMS code.",
        color: "warning",
      });
      return;
    }
    if (importAuthBusy || importing) return;

    setImportAuthBusy(true);
    try {
      const assertion =
        importMfaMethod === "authenticator"
          ? (() => {
              if (!importMfaTotpEnrollmentId) {
                throw new Error("Authenticator enrollment details are missing.");
              }
              return TotpMultiFactorGenerator.assertionForSignIn(importMfaTotpEnrollmentId, code);
            })()
          : (() => {
              if (!importMfaVerificationId) {
                throw new Error("SMS verification details are missing.");
              }
              const credential = PhoneAuthProvider.credential(importMfaVerificationId, code);
              return PhoneMultiFactorGenerator.assertion(credential);
            })();

      const credential = await importMfaResolver.resolveSignIn(assertion);
      await executeImport(credential.user.uid);
    } catch (error) {
      console.error("Failed to verify MFA for import:", error);
      setToast({
        open: true,
        message:
          (error as { message?: string })?.message ?? "Could not verify MFA code.",
        color: "danger",
      });
    } finally {
      setImportAuthBusy(false);
    }
  };

  const handleDeleteStep1 = () => {
    setShowDeleteStep1(true);
  };

  const handleDeleteStep2 = async (password: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setToast({ open: true, message: "No user logged in.", color: "danger" });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      setShowDeleteStep1(false);
      setShowDeleteStep2(true);
    } catch {
      setToast({
        open: true,
        message: "Incorrect password. Please try again.",
        color: "danger",
      });
    }
  };

  const handleDeleteFinal = async (usernameConfirm: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const expectedUsername = user.displayName || user.email || "DELETE";
    if (usernameConfirm.trim() !== expectedUsername) {
      setToast({
        open: true,
        message: "Username does not match. Please type it exactly as shown.",
        color: "danger",
      });
      return;
    }

    setDeleting(true);
    try {
      await deleteUser(user);
      setToast({ open: true, message: "Account deleted.", color: "success" });
      setShowDeleteStep2(false);
      setTimeout(() => {
        history.replace("/login");
      }, 1500);
    } catch (error: unknown) {
      const e = error as { message?: string };
      setToast({
        open: true,
        message:
          e?.message ||
          "Deletion failed. You may need to log out and back in, then try again.",
        color: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SettingsSubpageLayout
      title="Data & privacy"
      subtitle="Export backups, import CSV restores, and manage account privacy."
      backHref={SETTINGS_ROUTES.root}
    >
      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Backup export</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="full">
            <IonIcon slot="start" icon={analyticsOutline} />
            <IonLabel>
              <h2>Export your account data</h2>
              <p>Download a full backup as PDF, JSON, or CSV.</p>
            </IonLabel>
          </IonItem>
          <IonButton
            expand="block"
            fill="outline"
            onClick={() => {
              void exportFullData("pdf");
            }}
            disabled={!!exportingFormat || isDemoMode}
          >
            {exportingFormat === "pdf" ? <IonSpinner name="dots" /> : "Export PDF"}
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            onClick={() => {
              void exportFullData("json");
            }}
            disabled={!!exportingFormat || isDemoMode}
          >
            {exportingFormat === "json" ? <IonSpinner name="dots" /> : "Export JSON"}
          </IonButton>
          <IonButton
            expand="block"
            onClick={() => {
              void exportFullData("csv");
            }}
            disabled={!!exportingFormat || isDemoMode}
          >
            {exportingFormat === "csv" ? <IonSpinner name="dots" /> : "Export CSV"}
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>CSV import restore</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="full">
            <IonIcon slot="start" icon={cloudUploadOutline} />
            <IonLabel>
              <h2>Import from CSV backup</h2>
              <p>
                This replaces current foods, workouts, weigh-ins, plans, favorites, and related data.
              </p>
            </IonLabel>
          </IonItem>
          <IonButton
            expand="block"
            fill="outline"
            onClick={handleSelectCsvImport}
            disabled={parsingImportFile || importing || importAuthBusy || isDemoMode}
          >
            {parsingImportFile ? <IonSpinner name="dots" /> : "Choose CSV file"}
          </IonButton>

          {pendingImport && pendingImportSummary && (
            <div style={{ marginTop: 10 }}>
              <IonText color="medium">
                <p>
                  <strong>Loaded:</strong> {pendingImportFileName ?? "CSV backup"} ·{" "}
                  {pendingImportSummary.totalDocs} docs
                </p>
              </IonText>
              <IonText color="medium">
                <p>
                  {pendingImportSummary.counts
                    .filter((entry) => entry.count > 0)
                    .map((entry) => `${entry.collectionName}: ${entry.count}`)
                    .join(" · ") || "No collection documents in this backup."}
                </p>
              </IonText>
            </div>
          )}

          <IonItem lines="full">
            <IonIcon slot="start" icon={keyOutline} />
            <IonLabel position="stacked">Password (required before import)</IonLabel>
            <IonInput
              type="password"
              value={importPassword}
              placeholder="Enter your current password"
              onIonInput={(event) => setImportPassword(event.detail.value ?? "")}
              disabled={!pendingImport || importing || isDemoMode}
            />
          </IonItem>

          {importMfaResolver ? (
            <>
              <IonText color="medium">
                <p style={{ marginTop: 10 }}>
                  {importMfaMethod === "authenticator"
                    ? "Enter your authenticator code to complete authentication."
                    : `Enter the 6-digit code sent${importMfaMaskedPhone ? ` to ${importMfaMaskedPhone}` : " to your phone"}.`}
                </p>
              </IonText>
              <IonItem lines="full">
                <IonLabel position="stacked">
                  {importMfaMethod === "authenticator" ? "Authenticator code" : "SMS code"}
                </IonLabel>
                <IonInput
                  inputmode="numeric"
                  maxlength={importMfaMethod === "authenticator" ? 8 : 6}
                  value={importMfaCode}
                  placeholder={importMfaMethod === "authenticator" ? "Authenticator code" : "6-digit code"}
                  onIonInput={(event) =>
                    setImportMfaCode((event.detail.value ?? "").replace(/\D/g, ""))
                  }
                  disabled={importAuthBusy || importing}
                />
              </IonItem>
              <IonButton
                expand="block"
                onClick={() => {
                  void handleVerifyMfaAndImport();
                }}
                disabled={importAuthBusy || importing || !pendingImport}
              >
                {importAuthBusy || importing ? (
                  <IonSpinner name="dots" />
                ) : (
                  "Verify MFA & import"
                )}
              </IonButton>
              <IonButton
                expand="block"
                fill="clear"
                color="medium"
                onClick={resetImportMfaState}
                disabled={importAuthBusy || importing}
              >
                Cancel MFA step
              </IonButton>
            </>
          ) : (
            <IonButton
              expand="block"
              color="danger"
              onClick={() => {
                void handleAuthenticateAndImport();
              }}
              disabled={
                !pendingImport ||
                !importPassword.trim() ||
                importAuthBusy ||
                importing ||
                parsingImportFile ||
                isDemoMode
              }
            >
              {importAuthBusy || importing ? (
                <IonSpinner name="dots" />
              ) : (
                "Authenticate & import (replace all data)"
              )}
            </IonButton>
          )}

          <IonText color="danger">
            <p style={{ marginTop: 10, fontWeight: 600 }}>
              Import is destructive: existing account data will be replaced by this CSV backup.
            </p>
          </IonText>
          <input
            ref={importFileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              void handleImportFilePicked(event);
            }}
            style={{ display: "none" }}
          />
          <div ref={importRecaptchaContainerRef} aria-hidden="true" style={{ width: 1, height: 1, opacity: 0 }} />
        </IonCardContent>
      </IonCard>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Privacy</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="none">
            <IonIcon slot="start" icon={shieldCheckmarkOutline} />
            <IonLabel>
              <h2>Data visibility</h2>
              <p>Your MacroPal data remains tied to your account and is private by default.</p>
            </IonLabel>
          </IonItem>
        </IonCardContent>
      </IonCard>

      <IonCard>
        <IonCardHeader>
          <IonCardTitle>Danger zone</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="full">
            <IonIcon slot="start" icon={warningOutline} color="danger" />
            <IonLabel>
              <h2>Delete account</h2>
              <p>Permanently remove your account and stored data.</p>
              <IonText color="danger" style={{ display: "block", marginTop: 8, fontWeight: 600 }}>
                This cannot be undone.
              </IonText>
            </IonLabel>
          </IonItem>
          <IonButton
            expand="block"
            color="danger"
            onClick={handleDeleteStep1}
            disabled={isDemoMode}
          >
            <IonIcon slot="start" icon={trashOutline} />
            Delete my account
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonAlert
        isOpen={showDeleteStep1}
        header="Confirm your password"
        message="To delete your account, first enter your password."
        inputs={[
          {
            name: "password",
            type: "password",
            placeholder: "Your password",
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              setShowDeleteStep1(false);
            },
          },
          {
            text: "Next",
            handler: (data: { password?: string }) => {
              void handleDeleteStep2(data?.password || "");
              return false;
            },
          },
        ]}
        onDidDismiss={() => {
          if (!showDeleteStep2) {
            setShowDeleteStep1(false);
          }
        }}
      />

      <IonAlert
        isOpen={showDeleteStep2}
        header="Type your username to confirm"
        message={`To permanently delete your MacroPal account, type: "${auth.currentUser?.displayName || auth.currentUser?.email || "DELETE"}"`}
        inputs={[
          {
            name: "username",
            type: "text",
            placeholder: auth.currentUser?.displayName || auth.currentUser?.email || "DELETE",
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            handler: () => {
              setShowDeleteStep2(false);
            },
          },
          {
            text: deleting ? "Deleting..." : "Delete Forever",
            role: "destructive",
            handler: (data: { username?: string }) => {
              void handleDeleteFinal(data?.username || "");
              return false;
            },
          },
        ]}
        onDidDismiss={() => {
          setShowDeleteStep2(false);
        }}
      />

      <IonToast
        isOpen={toast.open}
        onDidDismiss={() => setToast((prev) => ({ ...prev, open: false }))}
        message={toast.message}
        color={toast.color}
        duration={3000}
      />
    </SettingsSubpageLayout>
  );
};

export default DataPrivacy;
