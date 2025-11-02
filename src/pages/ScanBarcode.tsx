import React, { useEffect, useRef, useState } from "react";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
  IonContent, IonButton, IonText, IonSpinner
} from "@ionic/react";
import { useHistory, useLocation } from "react-router";
import { BrowserMultiFormatReader } from "@zxing/browser";

const FN_BASE = "https://europe-west1-macropal-zanci19.cloudfunctions.net";

function useMealFromQuery(location: ReturnType<typeof useLocation>) {
  const p = new URLSearchParams(location.search);
  const m = (p.get("meal") || "breakfast").toLowerCase();
  return (["breakfast","lunch","dinner","snacks"] as const).includes(m as any) ? (m as any) : "breakfast";
}

const ScanBarcode: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const history = useHistory();
  const location = useLocation();
  const meal = useMealFromQuery(location);

  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔔 Shutter flash state
  const [flash, setFlash] = useState(false);

  const stop = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    readerRef.current = null;
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      // Preflight permission (helps Android WebView)
      const pre = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      pre.getTracks().forEach(t => t.stop());

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // Prefer back camera if available
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      let devId = devices[0]?.deviceId;
      const back = devices.find((device: MediaDeviceInfo) =>
        /back|rear|environment/i.test(device.label || "")
      );
      if (back) devId = back.deviceId;

      // Decode once
      const result = await reader.decodeOnceFromVideoDevice(devId, videoRef.current!);
      const code = (result?.getText() || "").replace(/\D/g, ""); // EAN/UPC numbers only
      stop();

      if (!code) throw new Error("No barcode detected.");

      // 🔔 Shutter flash + haptic tap
      setFlash(true);
      if ("vibrate" in navigator) (navigator as any).vibrate?.(20);
      await sleep(180);
      setFlash(false);

      // Try OFF lookup first; AddFood will show modal if found, else search list
      // We don't do the fetch here (network/permissions are fine), but redirect and let AddFood handle UX/toasts consistently.
      history.replace(`/add-food?meal=${meal}&code=${encodeURIComponent(code)}&found=1`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to start camera");
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/add-food?meal=${meal}`} />
          </IonButtons>
          <IonTitle>Scan barcode</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display:"grid", gap:12 }}>
          {/* Video container */}
          <div
            style={{ position:"relative", width:"100%", borderRadius:8, overflow:"hidden" }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width:"100%", background:"#000" }}
            />

            {/* Frame hint */}
            <div
              style={{
                position:"absolute",
                inset:"10% 15%",
                border:"2px dashed rgba(255,255,255,0.6)",
                borderRadius:8,
                pointerEvents:"none",
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
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <IonSpinner name="dots" />
              <IonText color="medium">Starting camera…</IonText>
            </div>
          )}

          {error && (
            <>
              <IonText color="danger">{error}</IonText>
              <IonButton expand="block" onClick={start}>Try again</IonButton>
              <IonButton
                expand="block"
                fill="outline"
                onClick={() => history.replace(`/add-food?meal=${meal}`)}
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
