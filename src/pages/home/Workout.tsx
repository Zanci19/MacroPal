import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonModal,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonDatetime,
  IonNote,
} from "@ionic/react";
import {
  addCircleOutline,
  calendarOutline,
  chevronBackOutline,
  chevronForwardOutline,
  fitnessOutline,
  flameOutline,
  logoGoogle,
  timerOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { db, trackEvent } from "../../firebase";
import {
  clampDateKeyToToday,
  formatDateKey,
  fromDateKey,
  isDateKey,
  shiftDateKey,
  todayDateKey,
} from "../../utils/date";
import { useProfile } from "../../hooks/useProfile";
import type { WorkoutDayDoc, WorkoutEntry } from "../../types";

import "./Home.css";
import "./Workout.css";
import {
  ACTIVITY_PRESETS,
  estimateCaloriesBurned,
  getActivityPreset,
} from "../../utils/activityCatalog";
import {
  fetchGoogleFitCalories,
  isGoogleFitSupported,
} from "../../utils/googleFit";

const Workout: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { uid, profile, loading: profileLoading } = useProfile();

  const [activeDateKey, setActiveDateKey] = useState<string>(() => {
    const params = new URLSearchParams(location.search);
    const qDate = params.get("date");
    if (isDateKey(qDate)) return clampDateKeyToToday(qDate);
    return todayDateKey();
  });
  const [pendingDateKey, setPendingDateKey] = useState<string>(activeDateKey);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [activities, setActivities] = useState<WorkoutEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string }>(
    { open: false, message: "" }
  );
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<
    Pick<WorkoutEntry, "title" | "calories" | "durationMinutes" | "intensity" | "note">
  >({
    title: ACTIVITY_PRESETS[0].label,
    calories: 0,
    durationMinutes: ACTIVITY_PRESETS[0].defaultMinutes,
    intensity: ACTIVITY_PRESETS[0].intensity,
    note: "",
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    ACTIVITY_PRESETS[0].id
  );
  const [useEstimate, setUseEstimate] = useState(true);
  const [syncingGoogleFit, setSyncingGoogleFit] = useState(false);
  const autoImportDatesRef = useRef<Set<string>>(new Set());

  const weightKg = profile?.weight ?? 70;
  const heightCm = profile?.height ?? 170;
  const googleFitAutoImport = profile?.googleFitAutoImport === true;

  const activeDateLabel = formatDateKey(activeDateKey, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  useEffect(() => {
    if (profileLoading) return;

    if (!uid) {
      history.replace("/login");
      return;
    }

    if (!profile || !profile.age) {
      history.replace("/setup-profile");
      return;
    }
  }, [profileLoading, uid, profile, history]);

  useEffect(() => {
    syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
  }, [selectedPresetId, weightKg, heightCm]);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const ref = doc(db, "users", uid, "workouts", activeDateKey);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.data() as WorkoutDayDoc | undefined;
      const nextActivities = raw?.activities ?? [];
      setActivities(nextActivities);
      setLoading(false);

      trackEvent("workout_page_snapshot", {
        uid,
        date: activeDateKey,
        total_activities: nextActivities.length,
      });
    });

    return () => unsub();
  }, [uid, activeDateKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("date") === activeDateKey) return;
    params.set("date", activeDateKey);
    history.replace({ pathname: location.pathname, search: `?${params}` });
  }, [activeDateKey, history, location.pathname, location.search]);

  const totalCalories = useMemo(
    () =>
      activities.reduce(
        (sum, act) => sum + (Number(act.calories) || 0),
        0
      ),
    [activities]
  );

  const syncCaloriesFromPreset = (
    presetId: string,
    durationOverride?: number,
    keepNote?: boolean
  ) => {
    const preset = getActivityPreset(presetId);
    const duration = durationOverride ?? preset.defaultMinutes;
    const calories = estimateCaloriesBurned(preset, weightKg, heightCm, duration);

    setDraft((d) => ({
      ...d,
      title: preset.label,
      durationMinutes: duration,
      intensity: preset.intensity,
      calories,
      note: keepNote ? d.note : d.note || preset.blurb || "",
    }));
  };

  const goRelativeDay = (delta: number) => {
    const next = clampDateKeyToToday(shiftDateKey(activeDateKey, delta));
    setActiveDateKey(next);
    setPendingDateKey(next);
    trackEvent("workout_day_change", { uid, next });
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    setUseEstimate(true);
    syncCaloriesFromPreset(presetId);
  };

  const handleDurationChange = (value: string) => {
    const duration = Number(value);
    setDraft((d) => {
      const next = { ...d, durationMinutes: Number.isFinite(duration) ? duration : undefined };
      if (useEstimate && selectedPresetId && Number.isFinite(duration)) {
        const preset = getActivityPreset(selectedPresetId);
        next.calories = estimateCaloriesBurned(
          preset,
          weightKg,
          heightCm,
          Number(duration)
        );
      }
      return next;
    });
  };

  const addActivity = async () => {
    if (!uid) return;
    const title = (draft.title || "").trim();
    const preset = getActivityPreset(selectedPresetId);
    const calories =
      Number(draft.calories) ||
      estimateCaloriesBurned(
        preset,
        weightKg,
        heightCm,
        draft.durationMinutes || preset.defaultMinutes
      );
    if (!title || calories <= 0) {
      setToast({ open: true, message: "Add a name and calories burned." });
      return;
    }

    const entry: WorkoutEntry = {
      title,
      calories,
      durationMinutes: draft.durationMinutes || undefined,
      intensity: draft.intensity || undefined,
      note: draft.note?.trim() || undefined,
      addedAt: new Date().toISOString(),
    };

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "workouts", activeDateKey);
        const snap = await tx.get(ref);
        const existing = (snap.data() as WorkoutDayDoc | undefined)?.activities || [];
        tx.set(ref, { activities: [...existing, entry] }, { merge: true });
      });

      trackEvent("workout_added", {
        uid,
        date: activeDateKey,
        calories,
        duration: entry.durationMinutes,
      });

      setUseEstimate(true);
      syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
      setDraft((prev) => ({ ...prev, note: "" }));
      setShowForm(false);
      setToast({ open: true, message: "Workout saved." });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Couldn't save workout." });
    }
  };

  const deleteActivity = async (index: number) => {
    if (!uid || index < 0 || index >= activities.length) return;
    const target = activities[index];

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "workouts", activeDateKey);
        const snap = await tx.get(ref);
        const existing = (snap.data() as WorkoutDayDoc | undefined)?.activities || [];
        const next = [...existing];
        next.splice(index, 1);
        tx.set(ref, { activities: next }, { merge: true });
      });

      trackEvent("workout_deleted", {
        uid,
        date: activeDateKey,
        calories: target.calories,
      });
      setToast({ open: true, message: `Removed ${target.title}.` });
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Couldn't delete workout." });
    }
  };

  const importGoogleFitCalories = useCallback(async ({
    silent,
    targetDateKey,
  }: {
    silent?: boolean;
    targetDateKey?: string;
  } = {}) => {
    if (!uid || syncingGoogleFit) return false;

    const dateKey = targetDateKey || activeDateKey;

    setSyncingGoogleFit(true);
    const start = fromDateKey(dateKey);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    try {
      const result = await fetchGoogleFitCalories(start.toISOString(), end.toISOString());

      if (result.reason === "unavailable") {
        if (!silent) {
          setToast({
            open: true,
            message:
              "Google Fit is only available on Android devices with the plugin installed.",
          });
        }
        return false;
      }

      if (result.reason === "not_installed") {
        setToast({
          open: true,
          message: "Google Fit isn't installed on this device.",
        });
        return false;
      }

      if (result.reason === "denied") {
        setToast({
          open: true,
          message: "Permission denied. Please allow Google Fit access to activity data.",
        });
        return false;
      }

      if (result.calories <= 0) {
        if (!silent) {
          setToast({
            open: true,
            message: "No calories found for this day in Google Fit.",
          });
        }
        return false;
      }

      const entry: WorkoutEntry = {
        title: "Google Fit",
        calories: result.calories,
        addedAt: new Date().toISOString(),
        note: "Imported from Google Fit",
        source: "google_fit",
      };

      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid, "workouts", dateKey);
        const snap = await tx.get(ref);
        const existing = (snap.data() as WorkoutDayDoc | undefined)?.activities || [];
        const withoutOldImports = existing.filter((act) => act.source !== "google_fit");
        tx.set(ref, { activities: [...withoutOldImports, entry] }, { merge: true });
      });

      trackEvent("workout_google_fit_import", {
        uid,
        date: dateKey,
        calories: result.calories,
      });

      if (!silent) {
        setToast({
          open: true,
          message: `Imported ${result.calories} kcal from Google Fit for this day.`,
        });
      }

      autoImportDatesRef.current.add(dateKey);
      return true;
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Couldn't import from Google Fit." });
      autoImportDatesRef.current.delete(dateKey);
      return false;
    } finally {
      setSyncingGoogleFit(false);
    }
  }, [uid, syncingGoogleFit, activeDateKey]);

  const goToGoogleFitSettings = () => history.push("/app/settings#google-fit");

  const handleGoogleFitTap = () => {
    if (!isGoogleFitSupported()) {
      setToast({
        open: true,
        message:
          "Google Fit works on Android native builds. Open Settings to manage the connection.",
      });
      goToGoogleFitSettings();
      return;
    }

    if (!googleFitAutoImport) {
      setToast({
        open: true,
        message: "Turn on Google Fit auto-import in Settings to keep workouts updated.",
      });
      goToGoogleFitSettings();
      return;
    }

    void importGoogleFitCalories();
  };

  useEffect(() => {
    if (!googleFitAutoImport) return;
    if (!isGoogleFitSupported()) return;
    if (autoImportDatesRef.current.has(activeDateKey)) return;
    if (activities.some((act) => act.source === "google_fit")) {
      autoImportDatesRef.current.add(activeDateKey);
      return;
    }

    autoImportDatesRef.current.add(activeDateKey);
    void importGoogleFitCalories({ silent: true }).then((ok) => {
      if (!ok) autoImportDatesRef.current.delete(activeDateKey);
    });
  }, [googleFitAutoImport, activeDateKey, activities, importGoogleFitCalories]);

  const isToday = activeDateKey === todayDateKey();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Workouts</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="home-content">
        <div className="fs-datebar">
          <IonButton
            fill="clear"
            shape="round"
            onClick={() => goRelativeDay(-1)}
            aria-label="Previous day"
          >
            <IonIcon icon={chevronBackOutline} />
          </IonButton>

          <IonButton
            className="fs-datebtn"
            onClick={() => setShowDatePicker(true)}
            aria-label="Pick a date"
          >
            <IonIcon icon={calendarOutline} />
            <span className="fs-datebtn__label">{activeDateLabel}</span>
            {isToday && (
              <IonBadge color="success" className="fs-datebtn__badge">
                Today
              </IonBadge>
            )}
          </IonButton>

          <IonButton
            fill="clear"
            shape="round"
            onClick={() => goRelativeDay(1)}
            aria-label="Next day"
            disabled={isToday}
          >
            <IonIcon icon={chevronForwardOutline} />
          </IonButton>
        </div>

        <IonCard className="fs-summary">
          <IonCardHeader
            className="fs-summary__hdr"
            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
          >
            <IonCardTitle style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Activity
              <IonChip color="tertiary" style={{ marginLeft: 4 }}>
                <IonIcon icon={fitnessOutline} />
                <span style={{ marginLeft: 6 }}>+{Math.round(totalCalories)} kcal</span>
              </IonChip>
            </IonCardTitle>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <IonButton
                fill="clear"
                size="small"
                color="medium"
                onClick={handleGoogleFitTap}
                disabled={syncingGoogleFit}
                aria-label="Manage Google Fit calories"
              >
                <IonIcon icon={logoGoogle} slot="start" />
                {googleFitAutoImport
                  ? syncingGoogleFit
                    ? "Syncing..."
                    : "Google Fit"
                  : "Connect Google Fit"}
              </IonButton>

              <IonButton
                fill="outline"
                size="small"
                onClick={() => {
                  setShowForm(true);
                  syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
                }}
                aria-label="Add activity"
              >
                <IonIcon icon={addCircleOutline} slot="start" />
                Add
              </IonButton>
            </div>
          </IonCardHeader>

          <IonCardContent className="fs-summary__row">
            {loading ? (
              <div className="ion-text-center" style={{ padding: 24 }}>
                <IonBadge color="medium">Loading</IonBadge>
              </div>
            ) : (
              <>
                <div className="fs-summary__left" style={{ color: "var(--ion-color-primary)" }}>
                  <IonIcon icon={flameOutline} style={{ fontSize: 42 }} />
                </div>
                <div className="fs-summary__mid">
                  <div className="fs-metric-title">Calories added to Home target</div>
                  <div className="fs-metric-title">Logged activities</div>
                </div>
                <div className="fs-summary__right">
                  <div className="fs-metric-value">{Math.round(totalCalories)}</div>
                  <div className="fs-metric-value">{activities.length}</div>
                </div>
              </>
            )}
          </IonCardContent>

          <div className="fs-summary__meta">
            <div>
              <div className="fs-summary__meta-label">Base allowance</div>
              <div className="fs-summary__meta-value">
                Home target + workouts
              </div>
            </div>
            <div>
              <div className="fs-summary__meta-label">When</div>
              <div className="fs-summary__meta-value">{activeDateLabel}</div>
            </div>
          </div>
        </IonCard>

        <IonCard>
          <IonCardHeader className="fs-summary__hdr">
            <IonCardTitle style={{ display: "flex", gap: 8, alignItems: "center" }}>
              Activity log
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {activities.length === 0 ? (
              <p className="fs-empty">No activities yet. Add one to boost your calories.</p>
            ) : (
              <IonList lines="full">
                {activities.map((act, idx) => (
                  <IonItem key={act.addedAt || idx} className="fs-activity-row">
                    <IonLabel>
                      <div className="fs-activity-title">{act.title}</div>
                      <div className="fs-activity-meta">
                        <span>
                          <IonIcon icon={timerOutline} aria-hidden="true" />
                          {act.durationMinutes ? `${act.durationMinutes} min` : "Quick"}
                        </span>
                        {act.intensity && <IonBadge color="medium">{act.intensity}</IonBadge>}
                      </div>
                      {act.note && <p className="fs-activity-note">{act.note}</p>}
                    </IonLabel>
                    <div className="fs-activity-kcal">+{Math.round(act.calories)} kcal</div>
                    <IonButton
                      fill="clear"
                      color="danger"
                      size="small"
                      onClick={() => deleteActivity(idx)}
                      aria-label={`Delete ${act.title}`}
                    >
                      Remove
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </IonCardContent>
        </IonCard>
      </IonContent>

      <IonModal isOpen={showForm} onDidDismiss={() => setShowForm(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Log activity</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowForm(false)}>Close</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonList>
            <IonItem>
              <IonLabel position="stacked">Activity type</IonLabel>
              <IonSelect
                interface="popover"
                value={selectedPresetId}
                onIonChange={(e) => handlePresetChange(e.detail.value)}
              >
                {ACTIVITY_PRESETS.map((preset) => (
                  <IonSelectOption key={preset.id} value={preset.id}>
                    {preset.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
              <IonNote slot="helper">Built from your height ({heightCm} cm) and weight ({weightKg} kg)</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Activity</IonLabel>
              <IonInput
                value={draft.title}
                placeholder="Jogging, cycling, yoga"
                onIonInput={(e) =>
                  setDraft((d) => ({ ...d, title: e.detail.value || "" }))
                }
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Calories burned</IonLabel>
              <IonInput
                type="number"
                value={draft.calories}
                onIonInput={(e) => {
                  setUseEstimate(false);
                  setDraft((d) => ({ ...d, calories: Number(e.detail.value) || 0 }));
                }}
              />
              <IonNote slot="helper">Adjust if you want to override the height+weight estimate</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Duration (minutes)</IonLabel>
              <IonInput
                type="number"
                value={draft.durationMinutes}
                onIonInput={(e) => handleDurationChange(e.detail.value || "0")}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Intensity</IonLabel>
              <IonSelect
                interface="popover"
                value={draft.intensity}
                onIonChange={(e) =>
                  setDraft((d) => ({ ...d, intensity: e.detail.value }))
                }
              >
                <IonSelectOption value="easy">Easy</IonSelectOption>
                <IonSelectOption value="moderate">Moderate</IonSelectOption>
                <IonSelectOption value="hard">Hard</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Notes</IonLabel>
              <IonTextarea
                autoGrow
                value={draft.note}
                placeholder="How did it feel?"
                onIonInput={(e) =>
                  setDraft((d) => ({ ...d, note: e.detail.value || "" }))
                }
              />
            </IonItem>
          </IonList>
          <IonButton expand="block" className="ion-margin-top" onClick={addActivity}>
            Save activity
          </IonButton>
        </IonContent>
      </IonModal>

      <IonModal isOpen={showDatePicker} onDidDismiss={() => setShowDatePicker(false)}>
        <IonContent className="fs-datepicker">
          <IonDatetime
            presentation="date"
            value={pendingDateKey}
            onIonChange={(ev) => {
              const v = ev.detail.value as string;
              if (isDateKey(v)) setPendingDateKey(clampDateKeyToToday(v));
            }}
            style={{ padding: 16 }}
          />
          <div style={{ display: "flex", gap: 12, padding: 16 }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => setShowDatePicker(false)}
              color="medium"
            >
              Cancel
            </IonButton>
            <IonButton
              expand="block"
              onClick={() => {
                setActiveDateKey(pendingDateKey);
                setShowDatePicker(false);
              }}
            >
              Done
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={toast.open}
        message={toast.message}
        duration={2200}
        onDidDismiss={() => setToast({ open: false, message: "" })}
      />
    </IonPage>
  );
};

export default Workout;