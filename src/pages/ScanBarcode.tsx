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
  IonIcon,
} from "@ionic/react";
import { useHistory, useLocation } from "react-router";
import { cameraReverseOutline } from "ionicons/icons";
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
  const hasScannedRef = useRef(false);

  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
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
    const reader = readerRef.current;
    if (reader && "stopContinuousDecode" in reader) {
      (reader as { stopContinuousDecode: () => void }).stopContinuousDecode();
    }
    readerRef.current = null;
    decodeInProgressRef.current = false;
    setHighlightActive(false);
    setHighlightBox(null);
    setActiveDeviceId(null);
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
      return point.getX();
    }
    return point.getY();
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

    const baseLeft = offsetX + minX * scale;
    const baseTop = offsetY + minY * scale;
    const baseWidth = Math.max(0, (maxX - minX) * scale);
    const baseHeight = Math.max(0, (maxY - minY) * scale);
    const paddingX = Math.max(8, baseWidth * 0.25);
    const paddingY = Math.max(24, baseHeight * 0.6);
    const minWidth = 80;
    const minHeight = 48;
    const paddedWidth = baseWidth + paddingX * 2;
    const paddedHeight = baseHeight + paddingY * 2;
    const width = Math.max(minWidth, paddedWidth);
    const height = Math.max(minHeight, paddedHeight);
    const left = baseLeft - paddingX - (width - paddedWidth) / 2;
    const top = baseTop - paddingY - (height - paddedHeight) / 2;

    const clampedLeft = Math.max(0, left);
    const clampedTop = Math.max(0, top);

    return {
      left: clampedLeft,
      top: clampedTop,
      width: Math.min(rect.width - clampedLeft, width),
      height: Math.min(rect.height - clampedTop, height),
    };
  };

  const start = async (preferredDeviceId?: string | null) => {
    setError(null);
    setStarting(true);
    setHighlightBox(null);
    setHighlightActive(false);
    hasScannedRef.current = false;

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
      setDevices(devices);
      trackEvent("barcode_scan_devices_listed", {
        count: devices.length,
      });

      const preferredDevice = devices.find(
        (device) => device.deviceId === preferredDeviceId
      );
      let devId = preferredDevice?.deviceId ?? devices[0]?.deviceId;
      if (!preferredDevice) {
        const back = devices.find((d) =>
          /back|rear|environment/i.test(d.label || "")
        );
        if (back) devId = back.deviceId;
      }
      if (!devId) {
        throw new Error("No camera devices available.");
      }
      setActiveDeviceId(devId);

      await reader.decodeFromVideoDevice(
        devId,
        videoRef.current!,
        async (result, err) => {
          if (hasScannedRef.current) return;
          if (decodeInProgressRef.current) return;
          if (!result) return;

          try {
            decodeInProgressRef.current = true;
            const video = videoRef.current;
            if (video) {
              setHighlightBox(getHighlightBox(result, video));
            }
            if (highlightTimeoutRef.current) {
              window.clearTimeout(highlightTimeoutRef.current);
            }

            setHighlightActive(false);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setHighlightActive(true));
            });
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

            hasScannedRef.current = true;
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

  const rotateCamera = () => {
    if (!devices.length) return;
    const currentIndex = devices.findIndex(
      (device) => device.deviceId === activeDeviceId
    );
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % devices.length : 0;
    const nextDevice = devices[nextIndex];
    if (!nextDevice) return;
    trackEvent("barcode_scan_rotate_camera", {
      from: activeDeviceId,
      to: nextDevice.deviceId,
    });
    stop();
    start(nextDevice.deviceId);
  };

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

            <IonButton
              fill="solid"
              size="small"
              onClick={rotateCamera}
              disabled={starting || devices.length < 2}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 5,
                "--padding-start": "10px",
                "--padding-end": "10px",
              }}
            >
              <IonIcon slot="icon-only" icon={cameraReverseOutline} />
            </IonButton>

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
                  opacity: highlightActive ? 1 : 0,
                  transition: "opacity 350ms ease-out",
                  pointerEvents: "none",
                  zIndex: 2,
                }}
              >
                {[
                  {
                    key: "top-left",
                    style: {
                      top: 0,
                      left: 0,
                      borderTop: "3px solid #facc15",
                      borderLeft: "3px solid #facc15",
                    },
                  },
                  {
                    key: "top-right",
                    style: {
                      top: 0,
                      right: 0,
                      borderTop: "3px solid #facc15",
                      borderRight: "3px solid #facc15",
                    },
                  },
                  {
                    key: "bottom-right",
                    style: {
                      bottom: 0,
                      right: 0,
                      borderBottom: "3px solid #facc15",
                      borderRight: "3px solid #facc15",
                    },
                  },
                  {
                    key: "bottom-left",
                    style: {
                      bottom: 0,
                      left: 0,
                      borderBottom: "3px solid #facc15",
                      borderLeft: "3px solid #facc15",
                    },
                  },
                ].map((corner) => (
                  <div
                    key={corner.key}
                    style={{
                      position: "absolute",
                      width: 32,
                      height: 24,
                      borderRadius: 4,
                      ...corner.style,
                    }}
                  />
                ))}
              </div>
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
