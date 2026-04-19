import React, { useEffect, useMemo, useState } from "react";
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import { Redirect } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { auth, db, trackEvent } from "../../firebase";
import { useClinicianAccess } from "../../hooks/useClinicianAccess";
import { isFeatureEnabled, useRemoteConfig } from "../../UpdateGate";
import { isValidFirestorePathSegment } from "../../utils/clinician";
import { sanitizeInput } from "../../utils/validation";
import { handleError } from "../../utils/handleError";
import type { AlertDoc, CarePlanDoc, ClinicianInviteDoc, MessageItemDoc } from "../../types";
import { SETTINGS_ROUTES } from "../../utils/settingsRoutes";

const ClinicianConnect: React.FC = () => {
  const remoteConfig = useRemoteConfig();
  const clinicianEnabled = isFeatureEnabled(remoteConfig, "clinicianCollaboration");
  const { role, clinicianLink, loading } = useClinicianAccess();
  const user = auth.currentUser;

  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [activePlan, setActivePlan] = useState<CarePlanDoc | null>(null);
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [messages, setMessages] = useState<Array<MessageItemDoc & { id: string }>>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color: "success" | "danger" | "warning";
  }>({ show: false, message: "", color: "success" });

  const threadId = isValidFirestorePathSegment(clinicianLink?.clinicianUid)
    ? clinicianLink.clinicianUid
    : "";

  useEffect(() => {
    if (!user || !clinicianLink || clinicianLink.status !== "active") {
      setActivePlan(null);
      setAlerts([]);
      return;
    }

    const load = async () => {
      try {
        const plansQuery = query(
          collection(db, "users", user.uid, "carePlans"),
          limit(10)
        );
        const planSnap = await getDocs(plansQuery);
        const active = planSnap.docs
          .map((entry) => entry.data() as CarePlanDoc)
          .find((entry) => entry.status === "active");
        setActivePlan(active ?? null);

        const alertsQuery = query(
          collection(db, "users", user.uid, "alerts"),
          orderBy("updatedAt", "desc"),
          limit(5)
        );
        const alertSnap = await getDocs(alertsQuery);
        setAlerts(alertSnap.docs.map((entry) => entry.data() as AlertDoc));
      } catch (error) {
        const userMessage = handleError("clinician_connect_load", error);
        setToast({ show: true, message: userMessage, color: "danger" });
      }
    };

    void load();
  }, [clinicianLink, user]);

  useEffect(() => {
    if (!user || !threadId) {
      setMessages([]);
      return;
    }

    const threadRef = doc(db, "users", user.uid, "messages", threadId);
    void setDoc(threadRef, { unreadForUser: 0, updatedAt: new Date().toISOString() }, { merge: true });
    const itemsQuery = query(
      collection(db, "users", user.uid, "messages", threadId, "items"),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    return onSnapshot(
      itemsQuery,
      (snapshot) => {
        setMessages(
          snapshot.docs.map((entry) => ({
            id: entry.id,
            ...(entry.data() as MessageItemDoc),
          }))
        );
      },
      (error) => {
        const userMessage = handleError("clinician_connect_messages", error);
        setToast({ show: true, message: userMessage, color: "danger" });
      }
    );
  }, [threadId, user]);

  const planProgress = useMemo(() => {
    if (!activePlan || activePlan.tasks.length === 0) return 0;
    const completed = activePlan.completedTasks?.length ?? 0;
    return Math.round((completed / activePlan.tasks.length) * 100);
  }, [activePlan]);

  const connectToClinician = async () => {
    if (!user) return;
    const code = sanitizeInput(inviteCode, 16);
    if (!code) {
      setToast({ show: true, message: "Please enter an invite code.", color: "warning" });
      return;
    }

    setBusy(true);
    try {
      await runTransaction(db, async (transaction) => {
        const inviteRef = doc(db, "clinicianInvites", code);
        const inviteSnap = await transaction.get(inviteRef);
        if (!inviteSnap.exists()) throw new Error("Invite code not found.");

        const invite = inviteSnap.data() as ClinicianInviteDoc;
        if (invite.status !== "active") throw new Error("This invite is not active.");
        if (new Date(invite.expiresAt) <= new Date()) throw new Error("Invite code has expired.");
        if (invite.clinicianUid === user.uid) throw new Error("You cannot link to yourself.");
        if (!isValidFirestorePathSegment(invite.clinicianUid)) {
          throw new Error("Invite code is invalid.");
        }

        const nowIso = new Date().toISOString();
        transaction.set(
          doc(db, "users", user.uid),
          {
            role: "user",
            clinicianLink: {
              clinicianUid: invite.clinicianUid,
              clinicianName: invite.clinicianName,
              consentedAt: nowIso,
              linkedAt: nowIso,
              status: "active",
              inviteCode: code,
            },
          },
          { merge: true }
        );

        transaction.set(
          doc(db, "users", invite.clinicianUid, "assignedUsers", user.uid),
          {
            uid: user.uid,
            displayName: user.displayName || user.email || "User",
            assignedAt: nowIso,
            assignedBy: invite.clinicianUid,
          },
          { merge: true }
        );

        transaction.set(
          inviteRef,
          {
            status: "redeemed",
            redeemedAt: nowIso,
            redeemedBy: user.uid,
          },
          { merge: true }
        );
      });

      trackEvent("clinician_link_connected");
      setToast({ show: true, message: "Connected to clinician.", color: "success" });
      setInviteCode("");
    } catch (error) {
      const userMessage = handleError("clinician_connect_invite", error);
      setToast({ show: true, message: userMessage, color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !threadId) return;
    const body = sanitizeInput(messageDraft, 500);
    if (!body) {
      setToast({ show: true, message: "Please type a message.", color: "warning" });
      return;
    }

    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      await runTransaction(db, async (transaction) => {
        const threadRef = doc(db, "users", user.uid, "messages", threadId);
        const threadSnap = await transaction.get(threadRef);
        const unreadForClinician =
          Number(threadSnap.data()?.unreadForClinician ?? 0) + 1;

        const msgRef = doc(collection(db, "users", user.uid, "messages", threadId, "items"));
        transaction.set(msgRef, {
          senderUid: user.uid,
          senderRole: "user",
          body,
          createdAt: nowIso,
        } satisfies MessageItemDoc);
        transaction.set(
          threadRef,
          {
            clinicianUid: threadId,
            userUid: user.uid,
            updatedAt: nowIso,
            lastMessageAt: nowIso,
            lastMessage: body,
            unreadForUser: 0,
            unreadForClinician,
          },
          { merge: true }
        );
      });
      setMessageDraft("");
      trackEvent("clinician_message_sent_user");
    } catch (error) {
      const userMessage = handleError("clinician_send_message_user", error);
      setToast({ show: true, message: userMessage, color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  if (!clinicianEnabled) return <Redirect to={SETTINGS_ROUTES.root} />;
  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }
  if (role === "clinician" || role === "admin") return <Redirect to={SETTINGS_ROUTES.clinicianDashboard} />;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={SETTINGS_ROUTES.root} />
          </IonButtons>
          <IonTitle>Clinician collaboration</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Connect to clinician</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">
              <p>Enter your clinician invite code to connect for personalized care.</p>
            </IonText>
            <IonItem>
              <IonLabel position="stacked">Invite code</IonLabel>
              <IonInput
                value={inviteCode}
                onIonInput={(event) => setInviteCode(event.detail.value ?? "")}
                placeholder="Enter invite code"
              />
            </IonItem>
            <IonButton expand="block" onClick={connectToClinician} disabled={busy}>
              {busy ? <IonSpinner name="crescent" /> : "Connect"}
            </IonButton>
            {clinicianLink?.status === "active" && (
              <IonNote color="success">
                Connected to {clinicianLink.clinicianName}.
              </IonNote>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Active care plan</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {activePlan ? (
              <>
                <h3>{activePlan.name}</h3>
                <p>{activePlan.description || "No description provided."}</p>
                <IonNote>{planProgress}% complete</IonNote>
                <IonList>
                  {activePlan.tasks.map((task) => (
                    <IonItem key={task}>
                      <IonLabel>{task}</IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </>
            ) : (
              <IonText color="medium">
                <p>No active care plan yet.</p>
              </IonText>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Open alerts</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {alerts.length === 0 ? (
              <IonText color="medium">
                <p>No active alerts.</p>
              </IonText>
            ) : (
              <IonList>
                {alerts.map((alert) => (
                  <IonItem key={`${alert.reasonCode}-${alert.updatedAt}`}>
                    <IonLabel>
                      <h3>{alert.reasonCode}</h3>
                      <p>{alert.message}</p>
                      <p>{new Date(alert.updatedAt).toLocaleString()}</p>
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Secure messages</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!threadId ? (
              <IonText color="medium">
                <p>Connect to a clinician to enable secure messaging.</p>
              </IonText>
            ) : (
              <>
                <IonItem>
                  <IonLabel position="stacked">Message</IonLabel>
                  <IonInput
                    value={messageDraft}
                    onIonInput={(event) => setMessageDraft(event.detail.value ?? "")}
                    placeholder="Write a message"
                  />
                </IonItem>
                <IonButton expand="block" fill="outline" onClick={sendMessage} disabled={busy}>
                  Send
                </IonButton>
                <IonList>
                  {messages.map((message) => (
                    <IonItem key={message.id}>
                      <IonLabel>
                        <h3>{message.senderRole === "user" ? "You" : "Clinician"}</h3>
                        <p>{message.body}</p>
                        <p>{new Date(message.createdAt).toLocaleString()}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </>
            )}
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={toast.show}
          message={toast.message}
          color={toast.color}
          duration={2500}
          onDidDismiss={() => setToast((prev) => ({ ...prev, show: false }))}
        />
      </IonContent>
    </IonPage>
  );
};

export default ClinicianConnect;
