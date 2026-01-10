import React, { useEffect, useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonContent,
  IonButton,
  IonText,
  IonSpinner,
} from "@ionic/react";
import { useHistory, useLocation } from "react-router";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { Result, ResultPoint } from "@zxing/library";
import { clampDateKeyToToday, isDateKey, todayDateKey } from "../utils/date";
import { trackEvent } from "../firebase";
import "./ScanBarcode.css";

type MealKey = "breakfast" | "lunch" | "dinner" | "snacks";

function useMealFromQuery(location: ReturnType<typeof useLocation>): MealKey {
  const p = new URLSearchParams(location.search);
  const m = (p.get("meal") || "breakfast").toLowerCase();
  return (["breakfast", "lunch", "dinner", "snacks"] as const).includes(m as MealKey)
    ? (m as MealKey)
    : "breakfast";
}

function useDateFromQuery(location: ReturnType<typeof useLocation>) {
  const p = new URLSearchParams(location.search);
  const d = p.get("date");
  if (isDateKey(d)) {
    return clampDateKeyToToday(d!);
  }
  return todayDateKey();
}

const ScanBarcode: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const decodeInProgressRef = useRef(false);

  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightBox, setHighlightBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [highlightActive, setHighlightActive] = useState(false);

  // 🔔 Shutter flash state
  const [flash, setFlash] = useState(false);

  // Screen view
  useEffect(() => {
    trackEvent("barcode_scan_screen_view", { meal, date: dateKey });
  }, [meal, dateKey]);

  const stop = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    readerRef.current?.reset();
    readerRef.current = null;
    decodeInProgressRef.current = false;
    setHighlightActive(false);
    setHighlightBox(null);
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    trackEvent("barcode_scan_camera_stopped");
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const getResultPointValue = (
    point: ResultPoint,
    axis: "x" | "y"
  ): number => {
    if (axis === "x") {
      return typeof point.getX === "function" ? point.getX() : point.x;
    }
    return typeof point.getY === "function" ? point.getY() : point.y;
  };

  const getHighlightBox = (
    result: Result,
    video: HTMLVideoElement
  ): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null => {
    const points = result.getResultPoints?.() ?? [];
    if (!points.length) return null;
    const xs = points.map((p) => getResultPointValue(p, "x"));
    const ys = points.map((p) => getResultPointValue(p, "y"));
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    if (!video.videoWidth || !video.videoHeight) return null;
    const rect = video.getBoundingClientRect();
    const scale = Math.min(
      rect.width / video.videoWidth,
      rect.height / video.videoHeight
    );
    const displayWidth = video.videoWidth * scale;
    const displayHeight = video.videoHeight * scale;
    const offsetX = (rect.width - displayWidth) / 2;
    const offsetY = (rect.height - displayHeight) / 2;

    return {
      left: offsetX + minX * scale,
      top: offsetY + minY * scale,
      width: Math.max(0, (maxX - minX) * scale),
      height: Math.max(0, (maxY - minY) * scale),
    };
  };

  const start = async () => {
    setError(null);
    setStarting(true);
    setHighlightBox(null);
    setHighlightActive(false);

    trackEvent("barcode_scan_start", { meal, date: dateKey });

    try {
      // Preflight permission (helps Android WebView)
      const pre = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      pre.getTracks().forEach((t) => t.stop());

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      if (videoRef.current) {
        videoRef.current.onloadedmetadata = () => {
          setStarting(false);
        };
      }

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      trackEvent("barcode_scan_devices_listed", {
        count: devices.length,
      });

      let devId = devices[0]?.deviceId;
      const back = devices.find((d) =>
        /back|rear|environment/i.test(d.label || "")
      );
      if (back) devId = back.deviceId;

      await reader.decodeFromVideoDevice(
        devId,
        videoRef.current!,
        async (result, err) => {
          if (decodeInProgressRef.current) return;
          if (!result) return;

          try {
            const video = videoRef.current;
            if (video) {
              setHighlightBox(getHighlightBox(result, video));
            }
            if (highlightTimeoutRef.current) {
              window.clearTimeout(highlightTimeoutRef.current);
            }

            setHighlightActive(true);
            decodeInProgressRef.current = true;
            await new Promise<void>((resolve) => {
              highlightTimeoutRef.current = window.setTimeout(() => {
                setHighlightActive(false);
                highlightTimeoutRef.current = null;
                resolve();
              }, 750);
            });

            const rawText = result?.getText() || "";
            const code = rawText.replace(/\D/g, ""); // EAN/UPC numbers only

            if (!code) {
              trackEvent("barcode_scan_no_code", { rawText });
              setError("No barcode detected.");
              decodeInProgressRef.current = false;
              return;
            }

            setFlash(true);
            if ("vibrate" in navigator) (navigator as any).vibrate?.(20);
            await sleep(180);
            setFlash(false);

            stop();

            trackEvent("barcode_scan_success", {
              code,
              length: code.length,
              meal,
              date: dateKey,
            });

            // Let AddFood handle the actual lookup UX
            history.replace(
              `/add-food?meal=${meal}&date=${dateKey}&code=${encodeURIComponent(
                code
              )}&found=1`
            );
          } catch (decodeError: any) {
            console.error(decodeError);
            const msg = decodeError?.message ?? "Failed to decode barcode";
            setError(msg);
            trackEvent("barcode_scan_error", { message: msg });
            decodeInProgressRef.current = false;
          }
        }
      );
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Failed to start camera";
      setError(msg);
      trackEvent("barcode_scan_error", {
        message: msg,
      });
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    start();
    return () => {
      stop();
      trackEvent("barcode_scan_screen_unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref={`/add-food?meal=${meal}&date=${dateKey}`}
            />
          </IonButtons>
          <IonTitle>Scan barcode</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding scan-barcode-page">
        <div style={{ display: "grid", gap: 12 }}>
          {/* Video container */}
          <div
            style={{
              position: "relative",
              width: "100%",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", background: "#000" }}
            />

            {/* Frame hint */}
            <div
              style={{
                position: "absolute",
                inset: "10% 15%",
                border: "2px dashed rgba(255,255,255,0.6)",
                borderRadius: 8,
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {highlightBox && (
              <div
                style={{
                  position: "absolute",
                  left: highlightBox.left,
                  top: highlightBox.top,
                  width: highlightBox.width,
                  height: highlightBox.height,
                  border: "3px solid #facc15",
                  background: "rgba(250, 204, 21, 0.15)",
                  borderRadius: 6,
                  opacity: highlightActive ? 1 : 0,
                  transition: "opacity 120ms ease-out",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              />
            )}

            {/* 🔔 Shutter flash */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#fff",
                opacity: flash ? 1 : 0,
                transition: "opacity 180ms ease-out",
                pointerEvents: "none",
                zIndex: 3,
              }}
            />

            {/* ✅ Success border pulse */}
            <div
              style={{
                position: "absolute",
                inset: "10% 15%",
                border: flash ? "4px solid #22c55e" : "4px solid transparent",
                borderRadius: 12,
                transition: "border-color 120ms ease-out",
                pointerEvents: "none",
                zIndex: 4,
              }}
            />
          </div>

          {starting && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IonSpinner name="dots" />
              <IonText color="medium">Starting camera…</IonText>
            </div>
          )}

          {error && (
            <>
              <IonText color="danger">{error}</IonText>
              <IonButton
                expand="block"
                onClick={() => {
                  trackEvent("barcode_scan_retry_click");
                  start();
                }}
              >
                Try again
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => {
                  trackEvent("barcode_scan_back_to_add_food", {
                    meal,
                    date: dateKey,
                  });
                  history.replace(
                    `/add-food?meal=${meal}&date=${dateKey}`
                  );
                }}
              >
                Back to Add Food
              </IonButton>
            </>
          )}

          {!error && (
            <IonText color="medium">
              Tip: fill the frame with the barcode. Good lighting helps.
            </IonText>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default ScanBarcode;
