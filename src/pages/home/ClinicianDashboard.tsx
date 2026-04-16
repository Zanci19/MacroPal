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
  IonSelect,
  IonSelectOption,
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
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";
import { auth, db, trackEvent } from "../../firebase";
import { useClinicianAccess } from "../../hooks/useClinicianAccess";
import { isFeatureEnabled, useRemoteConfig } from "../../UpdateGate";
import { todayDateKey, shiftDateKey } from "../../utils/date";
import {
  calculateAdherenceRate,
  canClinicianAccessUser,
  evaluateRiskReasons,
  resolveAlertSeverity,
} from "../../utils/clinician";
import { sanitizeInput } from "../../utils/validation";
import { handleError } from "../../utils/handleError";
import type {
  AlertDoc,
  CarePlanTemplateDoc,
  ClinicianAssignment,
  MessageItemDoc,
} from "../../types";

type DashboardUser = ClinicianAssignment & {
  adherence7d: number;
  adherence30d: number;
  riskReasons: string[];
  latestUpdate?: string;
};

const createInviteCode = (): string => {
  const maxCode = 100000000;
  const maxUint32 = 0x100000000;
  const threshold = maxUint32 - (maxUint32 % maxCode);
  let value = threshold;
  let attempts = 0;
  const random = new Uint32Array(1);

  while (value >= threshold && attempts < 8) {
    crypto.getRandomValues(random);
    value = random[0];
    attempts += 1;
  }

  return String(value % maxCode).padStart(8, "0");
};

const hasEntries = (data: Record<string, unknown> | undefined): boolean =>
  !!(
    (data?.breakfast as unknown[] | undefined)?.length ||
    (data?.lunch as unknown[] | undefined)?.length ||
    (data?.dinner as unknown[] | undefined)?.length ||
    (data?.snacks as unknown[] | undefined)?.length
  );

const ClinicianDashboard: React.FC = () => {
  const remoteConfig = useRemoteConfig();
  const clinicianEnabled = isFeatureEnabled(remoteConfig, "clinicianCollaboration");
  const { role, loading } = useClinicianAccess();
  const user = auth.currentUser;

  const [assignedUsers, setAssignedUsers] = useState<DashboardUser[]>([]);
  const [selectedUid, setSelectedUid] = useState("");
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateTasks, setTemplateTasks] = useState("");
  const [templates, setTemplates] = useState<Array<{ id: string; data: CarePlanTemplateDoc }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [messages, setMessages] = useState<Array<MessageItemDoc & { id: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    color: "success" | "danger" | "warning";
  }>({ show: false, message: "", color: "success" });

  const assignedIds = useMemo(() => assignedUsers.map((entry) => entry.uid), [assignedUsers]);

  const selectedUser = useMemo(
    () => assignedUsers.find((entry) => entry.uid === selectedUid) ?? null,
    [assignedUsers, selectedUid]
  );

  useEffect(() => {
    if (!user || !canClinicianAccessUser(role, assignedIds, selectedUid || "__none__")) {
      setMessages([]);
      return;
    }

    const load = async () => {
      try {
        const itemsQuery = query(
          collection(db, "users", selectedUid, "messages", user.uid, "items"),
          limit(30)
        );
        const snapshot = await getDocs(itemsQuery);
        const ordered = snapshot.docs
          .map((entry) => ({ id: entry.id, ...(entry.data() as MessageItemDoc) }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setMessages(ordered);
      } catch (error) {
        setToast({
          show: true,
          message: handleError("clinician_dashboard_messages", error),
          color: "danger",
        });
      }
    };

    void load();
  }, [assignedIds, role, selectedUid, user]);

  useEffect(() => {
    if (!user || !canClinicianAccessUser(role, assignedIds, selectedUid || "__none__")) return;
    const threadRef = doc(db, "users", selectedUid, "messages", user.uid);
    void setDoc(threadRef, { unreadForClinician: 0, updatedAt: new Date().toISOString() }, { merge: true });
  }, [assignedIds, role, selectedUid, user]);

  useEffect(() => {
    if (!user || (role !== "clinician" && role !== "admin")) return;

    const load = async () => {
      try {
        const assignedSnap = await getDocs(collection(db, "users", user.uid, "assignedUsers"));
        const usersWithMetrics = await Promise.all(
          assignedSnap.docs.map(async (entry) => {
            const assignment = entry.data() as ClinicianAssignment;
            const today = todayDateKey();

            const dateKeys30 = Array.from({ length: 30 }, (_, idx) =>
              shiftDateKey(today, -idx)
            );
            const dateKeys7 = dateKeys30.slice(0, 7);

            const foodDocs = await Promise.all(
              dateKeys30.map((key) => getDoc(doc(db, "users", assignment.uid, "foods", key)))
            );
            const loggedFlags = foodDocs.map((snap) =>
              hasEntries(snap.data() as Record<string, unknown> | undefined)
            );
            const logged30 = loggedFlags.filter(Boolean).length;
            const logged7 = loggedFlags.slice(0, 7).filter(Boolean).length;
            const adherence7d = calculateAdherenceRate(logged7, dateKeys7.length);
            const adherence30d = calculateAdherenceRate(logged30, dateKeys30.length);

            const alertsSnap = await getDocs(
              query(
                collection(db, "users", assignment.uid, "alerts"),
                limit(10)
              )
            );
            const openAlerts = alertsSnap.docs
              .map((alertDoc) => alertDoc.data() as AlertDoc)
              .filter((alert) => alert.status === "open");

            const riskReasons = evaluateRiskReasons({
              adherence7d,
              adherence30d,
              openAlertCount: openAlerts.length,
            });

            return {
              ...assignment,
              adherence7d,
              adherence30d,
              riskReasons,
              latestUpdate: foodDocs.find((snap) => snap.exists())?.id,
            };
          })
        );
        setAssignedUsers(usersWithMetrics);
        if (!selectedUid && usersWithMetrics.length > 0) {
          setSelectedUid(usersWithMetrics[0].uid);
        }

        const templatesSnap = await getDocs(collection(db, "users", user.uid, "carePlanTemplates"));
        setTemplates(
          templatesSnap.docs.map((entry) => ({
            id: entry.id,
            data: entry.data() as CarePlanTemplateDoc,
          }))
        );
      } catch (error) {
        setToast({
          show: true,
          message: handleError("clinician_dashboard_load", error),
          color: "danger",
        });
      }
    };

    void load();
  }, [role, selectedUid, user]);

  const generateInvite = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const code = createInviteCode();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();
      await setDoc(doc(db, "clinicianInvites", code), {
        clinicianUid: user.uid,
        clinicianName: user.displayName || user.email || "Clinician",
        createdAt: now.toISOString(),
        expiresAt,
        status: "active",
      });
      setInviteCode(code);
      trackEvent("clinician_invite_generated");
      setToast({ show: true, message: "Invite code generated.", color: "success" });
    } catch (error) {
      setToast({ show: true, message: handleError("clinician_invite_generate", error), color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const createTemplate = async () => {
    if (!user) return;
    const name = sanitizeInput(templateName, 80);
    if (!name) {
      setToast({ show: true, message: "Template name is required.", color: "warning" });
      return;
    }
    const tasks = templateTasks
      .split("\n")
      .map((task) => sanitizeInput(task, 120))
      .filter(Boolean);

    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const templateRef = doc(collection(db, "users", user.uid, "carePlanTemplates"));
      await setDoc(templateRef, {
        name,
        description: sanitizeInput(templateDescription, 300),
        tasks,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: user.uid,
      } satisfies CarePlanTemplateDoc);
      setTemplateName("");
      setTemplateDescription("");
      setTemplateTasks("");
      setSelectedTemplateId(templateRef.id);
      setToast({ show: true, message: "Template created.", color: "success" });
    } catch (error) {
      setToast({ show: true, message: handleError("clinician_template_create", error), color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const assignTemplate = async () => {
    if (!user || !selectedUid || !selectedTemplateId) return;
    if (!canClinicianAccessUser(role, assignedIds, selectedUid)) {
      setToast({ show: true, message: "You are not assigned to this user.", color: "danger" });
      return;
    }

    const template = templates.find((entry) => entry.id === selectedTemplateId)?.data;
    if (!template) {
      setToast({ show: true, message: "Please choose a valid template.", color: "warning" });
      return;
    }

    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const planRef = doc(collection(db, "users", selectedUid, "carePlans"));
      await setDoc(planRef, {
        name: template.name,
        description: template.description ?? "",
        tasks: template.tasks,
        completedTasks: [],
        status: "active",
        assignedAt: nowIso,
        assignedBy: user.uid,
        templateId: selectedTemplateId,
      });
      trackEvent("clinician_care_plan_assigned");
      setToast({ show: true, message: "Care plan assigned.", color: "success" });
    } catch (error) {
      setToast({ show: true, message: handleError("clinician_assign_plan", error), color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  const sendMessage = async () => {
    if (!user || !selectedUid) return;
    if (!canClinicianAccessUser(role, assignedIds, selectedUid)) {
      setToast({ show: true, message: "You can only message assigned users.", color: "danger" });
      return;
    }
    const body = sanitizeInput(messageDraft, 500);
    if (!body) {
      setToast({ show: true, message: "Message cannot be empty.", color: "warning" });
      return;
    }

    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      await runTransaction(db, async (transaction) => {
        const threadRef = doc(db, "users", selectedUid, "messages", user.uid);
        const threadSnap = await transaction.get(threadRef);
        const unreadForUser = Number(threadSnap.data()?.unreadForUser ?? 0) + 1;
        const msgRef = doc(collection(db, "users", selectedUid, "messages", user.uid, "items"));

        transaction.set(msgRef, {
          senderUid: user.uid,
          senderRole: role,
          body,
          createdAt: nowIso,
        } satisfies MessageItemDoc);
        transaction.set(
          threadRef,
          {
            clinicianUid: user.uid,
            userUid: selectedUid,
            updatedAt: nowIso,
            lastMessageAt: nowIso,
            lastMessage: body,
            unreadForUser,
            unreadForClinician: 0,
          },
          { merge: true }
        );
      });

      setMessageDraft("");
      setToast({ show: true, message: "Message sent.", color: "success" });
    } catch (error) {
      setToast({ show: true, message: handleError("clinician_send_message", error), color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  if (!clinicianEnabled) return <Redirect to="/app/settings" />;
  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }
  if (role !== "clinician" && role !== "admin") return <Redirect to="/app/clinician-connect" />;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/settings" />
          </IonButtons>
          <IonTitle>Clinician dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Connect invitations</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonButton expand="block" onClick={generateInvite} disabled={busy}>
              Generate invite code
            </IonButton>
            {inviteCode && <IonNote>Latest invite code: {inviteCode}</IonNote>}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Assigned users</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {assignedUsers.length === 0 ? (
              <IonText color="medium">
                <p>No assigned users yet.</p>
              </IonText>
            ) : (
              <IonList>
                {assignedUsers.map((entry) => (
                  <IonItem
                    button
                    key={entry.uid}
                    onClick={() => setSelectedUid(entry.uid)}
                    color={selectedUid === entry.uid ? "light" : undefined}
                  >
                    <IonLabel>
                      <h3>{entry.displayName}</h3>
                      <p>7d adherence: {Math.round(entry.adherence7d * 100)}%</p>
                      <p>30d adherence: {Math.round(entry.adherence30d * 100)}%</p>
                      <p>
                        Risk: {entry.riskReasons.length > 0 ? resolveAlertSeverity(entry.riskReasons) : "low"}
                      </p>
                      {entry.latestUpdate && <p>Recent update: {entry.latestUpdate}</p>}
                    </IonLabel>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Care plans</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonLabel position="stacked">Template name</IonLabel>
              <IonInput value={templateName} onIonInput={(event) => setTemplateName(event.detail.value ?? "")} />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Description</IonLabel>
              <IonInput
                value={templateDescription}
                onIonInput={(event) => setTemplateDescription(event.detail.value ?? "")}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Tasks (one per line)</IonLabel>
              <IonInput value={templateTasks} onIonInput={(event) => setTemplateTasks(event.detail.value ?? "")} />
            </IonItem>
            <IonButton fill="outline" expand="block" onClick={createTemplate} disabled={busy}>
              Save template
            </IonButton>
            <IonItem>
              <IonLabel position="stacked">Template</IonLabel>
              <IonSelect value={selectedTemplateId} onIonChange={(event) => setSelectedTemplateId(event.detail.value)}>
                {templates.map((entry) => (
                  <IonSelectOption key={entry.id} value={entry.id}>
                    {entry.data.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonButton expand="block" onClick={assignTemplate} disabled={busy || !selectedUid || !selectedTemplateId}>
              Assign to selected user
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Secure messaging</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {!selectedUser ? (
              <IonText color="medium">
                <p>Select an assigned user to send messages.</p>
              </IonText>
            ) : (
              <>
                <IonItem>
                  <IonLabel position="stacked">Message to {selectedUser.displayName}</IonLabel>
                  <IonInput
                    value={messageDraft}
                    onIonInput={(event) => setMessageDraft(event.detail.value ?? "")}
                    placeholder="Write message"
                  />
                </IonItem>
                <IonButton fill="outline" expand="block" onClick={sendMessage} disabled={busy}>
                  Send message
                </IonButton>
                <IonList>
                  {messages.map((message) => (
                    <IonItem key={message.id}>
                      <IonLabel>
                        <h3>{message.senderUid === user?.uid ? "You" : selectedUser.displayName}</h3>
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

export default ClinicianDashboard;
