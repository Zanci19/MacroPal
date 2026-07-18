/**
 * Speech-to-text with one API across native and web.
 *
 * Native (Capacitor) uses @capacitor-community/speech-recognition; the browser
 * uses the Web Speech API, which Chrome/Edge/Safari support but Firefox does
 * not — callers should check `isSpeechRecognitionSupported()` before offering
 * the feature.
 */

import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capacitor-community/speech-recognition";

export type SpeechErrorCode =
  | "permission-denied"
  | "no-speech"
  | "unavailable"
  | "network"
  | "aborted"
  | "unknown";

export class SpeechRecognitionError extends Error {
  code: SpeechErrorCode;
  constructor(code: SpeechErrorCode, message: string) {
    super(message);
    this.name = "SpeechRecognitionError";
    this.code = code;
  }
}

export interface SpeechSessionCallbacks {
  /** Fires repeatedly as the recognizer refines what it heard. */
  onPartialResult?: (transcript: string) => void;
  /** Fires once with the final transcript when the session ends. */
  onFinalResult: (transcript: string) => void;
  onError: (error: SpeechRecognitionError) => void;
}

export interface SpeechSession {
  /** Ends listening; the final transcript still arrives via onFinalResult. */
  stop: () => Promise<void>;
}

const DEFAULT_LANGUAGE = "en-US";

/** Minimal shape of the Web Speech API we rely on. */
interface WebSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}

type WebSpeechConstructor = new () => WebSpeechRecognition;

function getWebSpeechConstructor(): WebSpeechConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: WebSpeechConstructor;
    webkitSpeechRecognition?: WebSpeechConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * Whether this device can do speech-to-text at all. Native availability is
 * asynchronous, so this stays optimistic there and surfaces a real error on
 * start if the recognizer turns out to be missing.
 */
export function isSpeechRecognitionSupported(): boolean {
  if (isNativePlatform()) return true;
  return getWebSpeechConstructor() !== null;
}

function mapWebErrorCode(raw?: string): SpeechErrorCode {
  switch (raw) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission-denied";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "unavailable";
    case "network":
      return "network";
    case "aborted":
      return "aborted";
    default:
      return "unknown";
  }
}

export function describeSpeechError(error: SpeechRecognitionError): string {
  switch (error.code) {
    case "permission-denied":
      return "Microphone access is off. Enable it in your device settings to add food by voice.";
    case "no-speech":
      return "Didn't catch that. Tap the mic and try again.";
    case "unavailable":
      return "Voice input isn't available on this device.";
    case "network":
      return "Voice input needs a connection. Check your network and try again.";
    case "aborted":
      return "Voice input was cancelled.";
    default:
      return "Voice input failed. Please try again.";
  }
}

/** Requests microphone/speech permission. Resolves true when granted. */
export async function requestSpeechPermission(): Promise<boolean> {
  if (!isNativePlatform()) {
    // The browser prompts as part of start(); nothing to do up front.
    return true;
  }
  try {
    const current = await SpeechRecognition.checkPermissions();
    if (current.speechRecognition === "granted") return true;
    const requested = await SpeechRecognition.requestPermissions();
    return requested.speechRecognition === "granted";
  } catch (error) {
    console.warn("Speech permission check failed", error);
    return false;
  }
}

async function startNativeSession(
  callbacks: SpeechSessionCallbacks,
  language: string
): Promise<SpeechSession> {
  const { available } = await SpeechRecognition.available();
  if (!available) {
    throw new SpeechRecognitionError(
      "unavailable",
      "Speech recognition is not available on this device"
    );
  }

  const granted = await requestSpeechPermission();
  if (!granted) {
    throw new SpeechRecognitionError(
      "permission-denied",
      "Microphone permission was denied"
    );
  }

  let latest = "";
  let finished = false;
  let listening = false;

  const listeners = await Promise.all([
    SpeechRecognition.addListener(
      "partialResults",
      (data: { matches?: string[] }) => {
        const match = data?.matches?.[0];
        if (typeof match === "string" && match.trim()) {
          latest = match;
          callbacks.onPartialResult?.(match);
        }
      }
    ),
    SpeechRecognition.addListener(
      "listeningState",
      (data: { status?: "started" | "stopped" }) => {
        if (data?.status === "started") {
          listening = true;
          return;
        }
        // The recognizer stops on its own after a pause in speech; that end —
        // not the start() promise — is what completes the session.
        if (data?.status === "stopped" && listening) {
          void finish();
        }
      }
    ),
  ]);

  const removeListeners = async () => {
    await Promise.all(
      listeners.map((listener) => listener.remove().catch(() => undefined))
    );
  };

  const finish = async () => {
    if (finished) return;
    finished = true;
    await removeListeners();
    callbacks.onFinalResult(latest.trim());
  };

  try {
    // partialResults keeps the transcript flowing so the UI can show it live;
    // popup:false keeps the user inside our own listening sheet.
    //
    // With partialResults the plugin resolves start() immediately and streams
    // everything through the listeners, so this resolution means "listening
    // began", not "listening ended" — do not finish here.
    await SpeechRecognition.start({
      language,
      maxResults: 1,
      partialResults: true,
      popup: false,
    });
    listening = true;
  } catch (error) {
    if (!finished) {
      finished = true;
      await removeListeners();
      const message = error instanceof Error ? error.message : String(error);
      // The plugin surfaces a stop() as a rejected start() on some platforms;
      // treat it as a normal end when we already heard something.
      if (latest.trim()) {
        callbacks.onFinalResult(latest.trim());
      } else {
        callbacks.onError(
          new SpeechRecognitionError(
            /permission/i.test(message) ? "permission-denied" : "unknown",
            message
          )
        );
      }
    }
  }

  return {
    stop: async () => {
      try {
        await SpeechRecognition.stop();
      } catch (error) {
        console.warn("Speech stop failed", error);
      }
      await finish();
    },
  };
}

function startWebSession(
  callbacks: SpeechSessionCallbacks,
  language: string
): SpeechSession {
  const Recognition = getWebSpeechConstructor();
  if (!Recognition) {
    throw new SpeechRecognitionError(
      "unavailable",
      "This browser does not support voice input"
    );
  }

  const recognition = new Recognition();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = "";
  let finished = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    callbacks.onPartialResult?.((finalTranscript + interim).trim());
  };

  recognition.onerror = (event) => {
    const code = mapWebErrorCode(event?.error);
    // "no-speech" arrives before onend; let onend deliver whatever we caught
    // rather than failing a session that already has a usable transcript.
    if (code === "no-speech" && finalTranscript.trim()) return;
    if (finished) return;
    finished = true;
    callbacks.onError(
      new SpeechRecognitionError(code, event?.message || event?.error || "Speech error")
    );
  };

  recognition.onend = () => {
    if (finished) return;
    finished = true;
    callbacks.onFinalResult(finalTranscript.trim());
  };

  try {
    recognition.start();
  } catch (error) {
    finished = true;
    throw new SpeechRecognitionError(
      "unknown",
      error instanceof Error ? error.message : String(error)
    );
  }

  return {
    stop: async () => {
      try {
        recognition.stop();
      } catch (error) {
        console.warn("Speech stop failed", error);
      }
    },
  };
}

/**
 * Starts a listening session. Throws SpeechRecognitionError when the session
 * can't start; runtime failures come back through `callbacks.onError`.
 */
export async function startSpeechSession(
  callbacks: SpeechSessionCallbacks,
  options: { language?: string } = {}
): Promise<SpeechSession> {
  const language = options.language || DEFAULT_LANGUAGE;
  if (isNativePlatform()) {
    return startNativeSession(callbacks, language);
  }
  return startWebSession(callbacks, language);
}
