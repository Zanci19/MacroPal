import { useEffect, useMemo, useRef, useState } from "react";
import "./DebugOverlay.css";

type OverlayMetrics = {
  fps: number;
  frameMs: number;
  heapUsedMb: string;
  heapLimitMb: string;
  heapPercent: string;
};

const formatMb = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) return "n/a";
  return (bytes / (1024 * 1024)).toFixed(1);
};

const formatPercent = (value?: number) => {
  if (!value || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(0)}%`;
};

const MEMORY_UNSUPPORTED = "unavailable";

type MemoryInfo = {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
};

const getMemorySnapshot = () => {
  const memory = (performance as Performance & { memory?: MemoryInfo }).memory;
  if (!memory) {
    return {
      usedMb: MEMORY_UNSUPPORTED,
      limitMb: MEMORY_UNSUPPORTED,
      percent: MEMORY_UNSUPPORTED,
    };
  }

  const used = memory.usedJSHeapSize;
  const limit = memory.jsHeapSizeLimit;
  const percent = limit ? (used / limit) * 100 : undefined;

  return {
    usedMb: formatMb(used),
    limitMb: formatMb(limit),
    percent: formatPercent(percent),
  };
};

const useDebugOverlayMetrics = () => {
  const [metrics, setMetrics] = useState<OverlayMetrics>({
    fps: 0,
    frameMs: 0,
    heapUsedMb: MEMORY_UNSUPPORTED,
    heapLimitMb: MEMORY_UNSUPPORTED,
    heapPercent: MEMORY_UNSUPPORTED,
  });
  const frameCountRef = useRef(0);
  const lastSecondRef = useRef(performance.now());
  const lastFrameRef = useRef(performance.now());

  useEffect(() => {
    let rafId = 0;

    const loop = (now: number) => {
      frameCountRef.current += 1;
      const frameMs = now - lastFrameRef.current;
      lastFrameRef.current = now;

      if (now - lastSecondRef.current >= 1000) {
        const secondsElapsed = (now - lastSecondRef.current) / 1000;
        const fps = Math.round(frameCountRef.current / secondsElapsed);
        frameCountRef.current = 0;
        lastSecondRef.current = now;

        const memorySnapshot = getMemorySnapshot();
        setMetrics({
          fps,
          frameMs,
          heapUsedMb: memorySnapshot.usedMb,
          heapLimitMb: memorySnapshot.limitMb,
          heapPercent: memorySnapshot.percent,
        });
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  return metrics;
};

const isOverlayEnabled = () => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem("mp_debug_overlay");
  if (stored === null) return true;
  return stored !== "off";
};

const DebugOverlay = () => {
  const enabled = useMemo(isOverlayEnabled, []);
  const metrics = useDebugOverlayMetrics();

  if (!enabled) return null;

  return (
    <div className="debug-overlay" aria-live="polite">
      <div className="debug-overlay__title">Performance Debug</div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">FPS</span>
        <span className="debug-overlay__value">{metrics.fps}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Frame</span>
        <span className="debug-overlay__value">
          {metrics.frameMs.toFixed(1)} ms
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Heap Used</span>
        <span className="debug-overlay__value">{metrics.heapUsedMb} MB</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Heap Limit</span>
        <span className="debug-overlay__value">{metrics.heapLimitMb} MB</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Heap %</span>
        <span className="debug-overlay__value">{metrics.heapPercent}</span>
      </div>
    </div>
  );
};

export default DebugOverlay;
