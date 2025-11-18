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
import { clampDateKeyToToday, isDateKey, todayDateKey } from "../utils/date";
import { trackEvent } from "../firebase";

const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

function useMealFromQuery(location: ReturnType<typeof useLocation>) {
  const p = new URLSearchParams(location.search);
  const m = (p.get("meal") || "breakfast").toLowerCase();
  return (["breakfast", "lunch", "dinner", "snacks"] as const).includes(m as any)
    ? (m as any)
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

  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);
  const dateKey = useDateFromQuery(location);

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    readerRef.current = null;
    trackEvent("barcode_scan_camera_stopped");
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const start = async () => {
    setError(null);
    setStarting(true);

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

      const result = await reader.decodeOnceFromVideoDevice(
        devId,
        videoRef.current!
      );
      const rawText = result?.getText() || "";
      const code = rawText.replace(/\D/g, ""); // EAN/UPC numbers only
      stop();

      if (!code) {
        trackEvent("barcode_scan_no_code", { rawText });
        throw new Error("No barcode detected.");
      }

      // 🔔 Shutter flash + haptic tap
      setFlash(true);
      if ("vibrate" in navigator) (navigator as any).vibrate?.(20);
      await sleep(180);
      setFlash(false);

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

      <IonContent className="ion-padding">
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

            {/* 🔔 Shutter flash */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#fff",
                opacity: flash ? 1 : 0,
                transition: "opacity 180ms ease-out",
                pointerEvents: "none",
                zIndex: 2,
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
                zIndex: 3,
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
