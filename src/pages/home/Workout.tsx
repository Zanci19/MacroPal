import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonModal,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToast,
  IonDatetime,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  type RefresherEventDetail,
} from "@ionic/react";
import {
  addCircleOutline,
  add,
  calendarOutline,
  chevronBackOutline,
  chevronForwardOutline,
  fitnessOutline,
  timerOutline,
  flameOutline,
  barbellOutline,
  trashOutline,
} from "ionicons/icons";
import { useHistory, useLocation } from "react-router";
import { doc, getDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { db, trackEvent } from "../../firebase";
import {
  clampDateKeyToToday,
  formatDateKey,
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
  const weightKg = profile?.weight ?? 70;
  const heightCm = profile?.height ?? 170;

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
      history.replace("/onboarding-profile");
      return;
    }
  }, [profileLoading, uid, profile, history]);

  const syncCaloriesFromPreset = useCallback((
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
  }, [weightKg, heightCm]);

  useEffect(() => {
    syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
  }, [selectedPresetId, syncCaloriesFromPreset, draft.durationMinutes]);

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

  const handleRefresh = useCallback(
    async (event: CustomEvent<RefresherEventDetail>) => {
      console.log('[USER ACTION] Workout: Pull-to-refresh triggered', { uid, date: activeDateKey });
      try {
        if (!uid) return;
        setLoading(true);
        const snap = await getDoc(doc(db, "users", uid, "workouts", activeDateKey));
        const raw = snap.data() as WorkoutDayDoc | undefined;
        const nextActivities = raw?.activities ?? [];
        setActivities(nextActivities);
        trackEvent("workout_refresh", {
          uid,
          date: activeDateKey,
          total_activities: nextActivities.length,
        });
      } catch (error) {
        console.error("Failed to refresh workout data:", error);
      } finally {
        setLoading(false);
        event.detail.complete();
      }
    },
    [activeDateKey, uid]
  );

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

  const goRelativeDay = (delta: number) => {
    console.log('[USER ACTION] Workout: Navigate relative day', { delta, currentDate: activeDateKey });
    const next = clampDateKeyToToday(shiftDateKey(activeDateKey, delta));
    setActiveDateKey(next);
    setPendingDateKey(next);
    trackEvent("workout_day_change", { uid, next });
  };

  const handlePresetChange = (presetId: string) => {
    console.log('[USER ACTION] Workout: Activity preset changed', { presetId });
    setSelectedPresetId(presetId);
    setUseEstimate(true);
    syncCaloriesFromPreset(presetId);
  };

  const handleDurationChange = (value: string) => {
    console.log('[USER ACTION] Workout: Duration changed', { value, durationMinutes: Number(value) });
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
    console.log('[USER ACTION] Workout: Add activity clicked', { draft, selectedPreset: selectedPresetId });
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
    console.log('[USER ACTION] Workout: Delete activity clicked', { index, activityTitle: activities[index]?.title });
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

  const isToday = activeDateKey === todayDateKey();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Workouts</IonTitle>
          <IonButtons slot="end">
            <IonButton
              fill="clear"
              onClick={() => {
                console.log('[USER ACTION] Workout: Add activity button (header) clicked');
                setShowForm(true);
                syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
              }}
              aria-label="Add activity"
            >
              <IonIcon slot="icon-only" icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding tabbed-content home-content">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent
            pullingIcon="chevron-down-outline"
            refreshingSpinner="crescent"
          />
        </IonRefresher>
        <div className="fs-datebar">
          <IonButton
            fill="clear"
            shape="round"
            onClick={() => {
              console.log('[USER ACTION] Workout: Previous day button clicked');
              goRelativeDay(-1);
            }}
            aria-label="Previous day"
          >
            <IonIcon icon={chevronBackOutline} />
          </IonButton>

          <IonButton
            className="fs-datebtn"
            fill="outline"
            onClick={() => {
              console.log('[USER ACTION] Workout: Date picker button clicked', { currentDate: activeDateKey });
              setShowDatePicker(true);
            }}
            aria-label="Pick a date"
          >
            <IonIcon slot="start" icon={calendarOutline} />
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
            onClick={() => {
              console.log('[USER ACTION] Workout: Next day button clicked');
              goRelativeDay(1);
            }}
            aria-label="Next day"
            disabled={isToday}
          >
            <IonIcon icon={chevronForwardOutline} />
          </IonButton>
        </div>

        <IonCard className="workout-summary">
          <IonCardHeader className="workout-summary__header">
            <IonCardTitle className="mp-card-title">
              Daily activity
            </IonCardTitle>
            <IonCardSubtitle className="mp-card-subtitle">
              Log movement and keep your daily calorie target up to date.
            </IonCardSubtitle>
          </IonCardHeader>

          <IonCardContent>
            {loading ? (
              <div className="workout-summary__loading">
                <IonBadge color="medium">Loading…</IonBadge>
              </div>
            ) : (
              <div className="workout-summary__stats">
                <div className="workout-summary__stat">
                  <IonIcon icon={flameOutline} className="workout-summary__stat-icon" aria-hidden="true" />
                  <div className="workout-summary__stat-label">Calories added</div>
                  <div className="workout-summary__stat-value">
                    +{Math.round(totalCalories)} kcal
                  </div>
                </div>
                <div className="workout-summary__stat">
                  <IonIcon icon={barbellOutline} className="workout-summary__stat-icon" aria-hidden="true" />
                  <div className="workout-summary__stat-label">Activities</div>
                  <div className="workout-summary__stat-value">{activities.length}</div>
                </div>
              </div>
            )}

            <div className="workout-summary__actions">
              <IonButton
                expand="block"
                onClick={() => {
                  console.log('[USER ACTION] Workout: Add activity button (summary card) clicked');
                  setShowForm(true);
                  syncCaloriesFromPreset(selectedPresetId, draft.durationMinutes, true);
                }}
                aria-label="Add activity"
              >
                <IonIcon icon={addCircleOutline} slot="start" />
                Log activity
              </IonButton>
            </div>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader className="workout-log__header">
            <IonCardTitle className="mp-card-title">Activity log</IonCardTitle>
          </IonCardHeader>
          <IonCardContent className="workout-log__content">
            {activities.length === 0 ? (
              <div className="workout-empty-state">
                <IonIcon icon={barbellOutline} className="workout-empty-state__icon" aria-hidden="true" />
                <p className="workout-empty-state__text">No activities yet.</p>
                <p className="workout-empty-state__hint">Log a workout to boost your daily calorie allowance.</p>
              </div>
            ) : (
              <IonList lines="full">
                {activities.map((act, idx) => (
                  <IonItem key={act.addedAt || idx} className="workout-activity-row">
                    <IonIcon icon={fitnessOutline} slot="start" className="workout-activity-icon" aria-hidden="true" />
                    <IonLabel>
                      <div className="workout-activity-title">{act.title}</div>
                      <div className="workout-activity-meta">
                        <span>
                          <IonIcon icon={timerOutline} aria-hidden="true" />
                          {act.durationMinutes ? `${act.durationMinutes} min` : "Quick session"}
                        </span>
                        {act.intensity && <IonBadge color="medium">{act.intensity}</IonBadge>}
                        <span className="workout-activity-kcal">+{Math.round(act.calories)} kcal</span>
                      </div>
                      {act.note && <p className="workout-activity-note">{act.note}</p>}
                    </IonLabel>
                    <IonButton
                      fill="clear"
                      color="medium"
                      size="small"
                      slot="end"
                      onClick={() => {
                        console.log('[USER ACTION] Workout: Remove button clicked in activity list', { index: idx, activityTitle: act.title });
                        deleteActivity(idx);
                      }}
                      aria-label={`Delete ${act.title}`}
                    >
                      <IonIcon slot="icon-only" icon={trashOutline} />
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
              <IonButton onClick={() => {
                console.log('[USER ACTION] Workout: Close modal button clicked');
                setShowForm(false);
              }}>Close</IonButton>
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
                onIonChange={(e) => {
                  console.log('[USER ACTION] Workout: Activity type select changed', { value: e.detail.value });
                  handlePresetChange(e.detail.value);
                }}
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
                onIonInput={(e) => {
                  console.log('[USER ACTION] Workout: Activity title input changed', { value: e.detail.value });
                  setDraft((d) => ({ ...d, title: e.detail.value || "" }));
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Calories burned</IonLabel>
              <IonInput
                type="number"
                value={draft.calories}
                onIonInput={(e) => {
                  console.log('[USER ACTION] Workout: Calories input changed (manual override)', { value: e.detail.value });
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
                onIonInput={(e) => {
                  console.log('[USER ACTION] Workout: Duration input changed', { value: e.detail.value });
                  handleDurationChange(e.detail.value || "0");
                }}
              />
            </IonItem>
            <IonItem>
              <IonLabel position="stacked">Intensity</IonLabel>
              <IonSelect
                interface="popover"
                value={draft.intensity}
                onIonChange={(e) => {
                  console.log('[USER ACTION] Workout: Intensity select changed', { value: e.detail.value });
                  setDraft((d) => ({ ...d, intensity: e.detail.value }));
                }}
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
                onIonInput={(e) => {
                  console.log('[USER ACTION] Workout: Notes textarea changed', { length: e.detail.value?.length || 0 });
                  setDraft((d) => ({ ...d, note: e.detail.value || "" }));
                }}
              />
            </IonItem>
          </IonList>
          <IonButton expand="block" className="ion-margin-top" onClick={() => {
            console.log('[USER ACTION] Workout: Save activity button clicked');
            addActivity();
          }}>
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
              console.log('[USER ACTION] Workout: Date picker value changed', { value: ev.detail.value });
              const v = ev.detail.value as string;
              if (isDateKey(v)) setPendingDateKey(clampDateKeyToToday(v));
            }}
            style={{ padding: 16 }}
          />
          <div style={{ display: "flex", gap: 12, padding: 16 }}>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => {
                console.log('[USER ACTION] Workout: Date picker Cancel button clicked');
                setShowDatePicker(false);
              }}
              color="medium"
            >
              Cancel
            </IonButton>
            <IonButton
              expand="block"
              onClick={() => {
                console.log('[USER ACTION] Workout: Date picker Done button clicked', { selectedDate: pendingDateKey });
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
