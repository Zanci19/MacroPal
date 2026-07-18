import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFooter,
  IonButton,
  IonButtons,
  IonIcon,
  IonLabel,
  IonText,
  IonSpinner,
  IonInput,
  IonNote,
} from "@ionic/react";
import {
  micOutline,
  stopOutline,
  closeOutline,
  trashOutline,
  refreshOutline,
  alertCircleOutline,
} from "ionicons/icons";
import {
  parseVoiceFoodTranscript,
  estimateGrams,
  type ParsedVoiceFood,
} from "../utils/voiceFoodParser";
import {
  resolveVoiceFood,
  parseServingGrams,
  type FoodMatch,
  type MatchableFood,
} from "../utils/voiceFoodResolver";
import {
  startSpeechSession,
  describeSpeechError,
  isSpeechRecognitionSupported,
  SpeechRecognitionError,
  type SpeechSession,
} from "../utils/speechRecognition";
import "./VoiceFoodModal.css";

/** A parsed line that has been matched (or failed to match) to a real food. */
export interface VoiceFoodDraft<T extends MatchableFood> {
  id: string;
  parsed: ParsedVoiceFood;
  match: FoodMatch<T> | null;
  /** Grams to log; user-editable, seeded from the spoken quantity. */
  grams: number;
  status: "resolving" | "matched" | "unmatched";
}

interface VoiceFoodModalProps<T extends MatchableFood> {
  isOpen: boolean;
  onDismiss: () => void;
  /** Human-readable meal the items will be added to, e.g. "Breakfast". */
  mealLabel: string;
  /** Bundled + user-created foods, matched first and available offline. */
  localFoods: T[];
  /** Optional remote lookup for anything the local database doesn't cover. */
  searchRemote?: (query: string) => Promise<T[]>;
  /** Adds the confirmed drafts to the diary. Resolves when persisted. */
  onConfirm: (drafts: Array<VoiceFoodDraft<T> & { match: FoodMatch<T> }>) => Promise<void>;
}

type Phase = "idle" | "listening" | "processing" | "review";

const EXAMPLE_PHRASE = "3 fried eggs, a glass of milk, 2 slices of bread, apple";

function describeSpokenAmount(parsed: ParsedVoiceFood): string {
  const qty = parsed.quantity;
  const qtyLabel = Number.isInteger(qty) ? String(qty) : String(qty);
  if (!parsed.unit) return `${qtyLabel} ×`;
  return `${qtyLabel} ${parsed.unit}`;
}

function VoiceFoodModal<T extends MatchableFood>({
  isOpen,
  onDismiss,
  mealLabel,
  localFoods,
  searchRemote,
  onConfirm,
}: VoiceFoodModalProps<T>) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcript, setTranscript] = useState("");
  const [drafts, setDrafts] = useState<Array<VoiceFoodDraft<T>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sessionRef = useRef<SpeechSession | null>(null);
  // Guards against a late transcript from a session the user already cancelled.
  const runIdRef = useRef(0);

  const supported = isSpeechRecognitionSupported();

  const resetState = useCallback(() => {
    runIdRef.current += 1;
    setPhase("idle");
    setTranscript("");
    setDrafts([]);
    setError(null);
    setSaving(false);
  }, []);

  const stopSession = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) {
      await session.stop().catch(() => undefined);
    }
  }, []);

  /** Parses the transcript and resolves each item against the food database. */
  const processTranscript = useCallback(
    async (text: string, runId: number) => {
      const parsedItems = parseVoiceFoodTranscript(text);

      if (parsedItems.length === 0) {
        if (runId !== runIdRef.current) return;
        setPhase("idle");
        setError(
          text.trim()
            ? "Couldn't pick out any foods from that. Try naming them one by one."
            : "Didn't catch anything. Tap the mic and try again."
        );
        return;
      }

      const pending: Array<VoiceFoodDraft<T>> = parsedItems.map((parsed, index) => ({
        id: `${runId}-${index}`,
        parsed,
        match: null,
        grams: 0,
        status: "resolving",
      }));

      if (runId !== runIdRef.current) return;
      setDrafts(pending);
      setPhase("review");

      const resolved = await Promise.all(
        pending.map(async (draft) => {
          const match = await resolveVoiceFood(draft.parsed.query, {
            localFoods,
            searchRemote,
          });
          if (!match) {
            return { ...draft, status: "unmatched" as const };
          }
          const servingGrams = parseServingGrams(match.food.serving_size);
          const grams = estimateGrams(
            draft.parsed,
            match.food.product_name || draft.parsed.query,
            servingGrams
          );
          return { ...draft, match, grams, status: "matched" as const };
        })
      );

      if (runId !== runIdRef.current) return;
      setDrafts(resolved);
    },
    [localFoods, searchRemote]
  );

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");
    setDrafts([]);

    runIdRef.current += 1;
    const runId = runIdRef.current;

    setPhase("listening");

    try {
      const session = await startSpeechSession({
        onPartialResult: (text) => {
          if (runId !== runIdRef.current) return;
          setTranscript(text);
        },
        onFinalResult: (text) => {
          if (runId !== runIdRef.current) return;
          sessionRef.current = null;
          setTranscript(text);
          setPhase("processing");
          void processTranscript(text, runId);
        },
        onError: (speechError) => {
          if (runId !== runIdRef.current) return;
          sessionRef.current = null;
          setPhase("idle");
          setError(describeSpeechError(speechError));
        },
      });
      sessionRef.current = session;
    } catch (caught) {
      if (runId !== runIdRef.current) return;
      setPhase("idle");
      setError(
        caught instanceof SpeechRecognitionError
          ? describeSpeechError(caught)
          : "Voice input failed to start. Please try again."
      );
    }
  }, [processTranscript]);

  const handleDismiss = useCallback(() => {
    void stopSession();
    resetState();
    onDismiss();
  }, [onDismiss, resetState, stopSession]);

  // Release the microphone if the modal closes for any reason.
  useEffect(() => {
    if (!isOpen) {
      void stopSession();
      resetState();
    }
  }, [isOpen, resetState, stopSession]);

  useEffect(() => () => void stopSession(), [stopSession]);

  const updateGrams = (id: string, grams: number) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.id === id ? { ...draft, grams } : draft))
    );
  };

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((draft) => draft.id !== id));
  };

  const matchedDrafts = drafts.filter(
    (draft): draft is VoiceFoodDraft<T> & { match: FoodMatch<T> } =>
      draft.status === "matched" && draft.match !== null && draft.grams > 0
  );
  const stillResolving = drafts.some((draft) => draft.status === "resolving");

  const handleConfirm = async () => {
    if (matchedDrafts.length === 0 || saving) return;
    setSaving(true);
    try {
      await onConfirm(matchedDrafts);
      resetState();
    } catch (caught) {
      console.error("Voice food confirm failed", caught);
      setError("Couldn't add those foods. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderIdle = () => (
    <div className="voice-food__stage">
      <button
        type="button"
        className="voice-food__mic voice-food__mic--idle"
        onClick={startListening}
        disabled={!supported}
        aria-label="Start listening"
      >
        <IonIcon icon={micOutline} />
      </button>
      <h2 className="voice-food__headline">
        {supported ? "Tap to speak your meal" : "Voice input isn't available here"}
      </h2>
      <IonText color="medium">
        <p className="voice-food__hint">
          {supported ? (
            <>
              Say everything at once, for example:
              <br />
              <em>&ldquo;{EXAMPLE_PHRASE}&rdquo;</em>
            </>
          ) : (
            "Try the app on your phone, or use Chrome, Edge or Safari on desktop."
          )}
        </p>
      </IonText>
    </div>
  );

  const renderListening = () => (
    <div className="voice-food__stage">
      <button
        type="button"
        className="voice-food__mic voice-food__mic--live"
        onClick={() => void stopSession()}
        aria-label="Stop listening"
      >
        <IonIcon icon={stopOutline} />
      </button>
      <h2 className="voice-food__headline">Listening…</h2>
      <p className="voice-food__transcript">
        {transcript || <span className="voice-food__placeholder">Start speaking</span>}
      </p>
      <IonButton fill="clear" onClick={() => void stopSession()}>
        Done
      </IonButton>
    </div>
  );

  const renderProcessing = () => (
    <div className="voice-food__stage">
      <IonSpinner name="crescent" />
      <h2 className="voice-food__headline">Finding those foods…</h2>
      {transcript && <p className="voice-food__transcript">{transcript}</p>}
    </div>
  );

  const renderReview = () => (
    <div className="voice-food__review">
      {transcript && (
        <div className="voice-food__heard">
          <IonNote>Heard</IonNote>
          <p>&ldquo;{transcript}&rdquo;</p>
        </div>
      )}

      <div className="voice-food__list">
        {drafts.map((draft) => (
          <div className="voice-food__item" key={draft.id}>
            <div className="voice-food__item-main">
              <div className="voice-food__item-text">
                <IonLabel className="voice-food__item-name">
                  {draft.status === "unmatched"
                    ? draft.parsed.query
                    : draft.match?.food.product_name || draft.parsed.query}
                </IonLabel>
                <IonNote className="voice-food__item-meta">
                  {draft.status === "resolving" && "Matching…"}
                  {draft.status === "unmatched" && "No match found"}
                  {draft.status === "matched" && (
                    <>
                      {describeSpokenAmount(draft.parsed)}
                      {draft.match?.food.brands ? ` · ${draft.match.food.brands}` : ""}
                      {draft.match?.confidence === "low" ? " · check this one" : ""}
                    </>
                  )}
                </IonNote>
              </div>

              <IonButton
                fill="clear"
                color="medium"
                size="small"
                onClick={() => removeDraft(draft.id)}
                aria-label={`Remove ${draft.parsed.query}`}
              >
                <IonIcon slot="icon-only" icon={trashOutline} />
              </IonButton>
            </div>

            {draft.status === "resolving" && (
              <IonSpinner name="dots" className="voice-food__item-spinner" />
            )}

            {draft.status === "matched" && (
              <div className="voice-food__amount">
                <IonInput
                  type="number"
                  inputmode="decimal"
                  min={1}
                  value={draft.grams}
                  className="voice-food__amount-input"
                  aria-label={`Grams of ${draft.match?.food.product_name || draft.parsed.query}`}
                  onIonInput={(e) => {
                    const next = Number(e.detail.value);
                    updateGrams(draft.id, Number.isFinite(next) && next > 0 ? next : 0);
                  }}
                />
                <span className="voice-food__amount-unit">g</span>
              </div>
            )}

            {draft.status === "unmatched" && (
              <div className="voice-food__unmatched">
                <IonIcon icon={alertCircleOutline} />
                <span>Search for it manually after closing.</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <IonButton
        fill="clear"
        expand="block"
        onClick={startListening}
        disabled={saving}
        className="voice-food__redo"
      >
        <IonIcon slot="start" icon={refreshOutline} />
        Record again
      </IonButton>
    </div>
  );

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleDismiss} className="voice-food-modal">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Add by voice</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleDismiss} aria-label="Close">
              <IonIcon slot="icon-only" icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {error && (
          <div className="voice-food__error" role="alert">
            <IonIcon icon={alertCircleOutline} />
            <span>{error}</span>
          </div>
        )}

        {phase === "idle" && renderIdle()}
        {phase === "listening" && renderListening()}
        {phase === "processing" && renderProcessing()}
        {phase === "review" && renderReview()}
      </IonContent>

      {phase === "review" && (
        <IonFooter>
          <IonToolbar>
            <IonButton
              expand="block"
              onClick={handleConfirm}
              disabled={matchedDrafts.length === 0 || stillResolving || saving}
            >
              {saving ? (
                <>
                  <IonSpinner name="dots" />
                  &nbsp;Adding…
                </>
              ) : (
                `Add ${matchedDrafts.length} ${
                  matchedDrafts.length === 1 ? "food" : "foods"
                } to ${mealLabel}`
              )}
            </IonButton>
          </IonToolbar>
        </IonFooter>
      )}
    </IonModal>
  );
}

export default VoiceFoodModal;
