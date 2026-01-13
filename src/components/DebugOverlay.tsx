import { useEffect, useRef, useState } from "react";
import "./DebugOverlay.css";
import { subscribeRenderProfile } from "./renderProfiler";

type RenderProfileSnapshot = {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
};

type OverlayMetrics = {
  fps: number;
  frameMs: number;
  worstFrameMs: number;
  jankFrames: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  longTaskTotalMs: number;
  domNodes: number;
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
const LONG_TASK_UNSUPPORTED = "n/a";
const DOM_NODES_UNAVAILABLE = "n/a";

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
    worstFrameMs: 0,
    jankFrames: 0,
    longTaskCount: 0,
    longTaskMaxMs: 0,
    longTaskTotalMs: 0,
    domNodes: 0,
    heapUsedMb: MEMORY_UNSUPPORTED,
    heapLimitMb: MEMORY_UNSUPPORTED,
    heapPercent: MEMORY_UNSUPPORTED,
  });
  const frameCountRef = useRef(0);
  const lastSecondRef = useRef(performance.now());
  const lastFrameRef = useRef(performance.now());
  const jankFramesRef = useRef(0);
  const worstFrameMsRef = useRef(0);
  const longTaskCountRef = useRef(0);
  const longTaskTotalMsRef = useRef(0);
  const longTaskMaxMsRef = useRef(0);
  const longTaskSupportedRef = useRef(false);

  useEffect(() => {
    let rafId = 0;
    let longTaskObserver: PerformanceObserver | undefined;

    if ("PerformanceObserver" in window) {
      longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCountRef.current += 1;
          longTaskTotalMsRef.current += entry.duration;
          longTaskMaxMsRef.current = Math.max(longTaskMaxMsRef.current, entry.duration);
        }
      });

      try {
        longTaskObserver.observe({ entryTypes: ["longtask"] });
        longTaskSupportedRef.current = true;
      } catch (error) {
        longTaskObserver.disconnect();
        longTaskObserver = undefined;
        if (import.meta.env.DEV) {
          console.warn("Long task observer is not supported:", error);
        }
      }
    }

    const loop = (now: number) => {
      frameCountRef.current += 1;
      const frameMs = now - lastFrameRef.current;
      lastFrameRef.current = now;
      if (frameMs > 50) {
        jankFramesRef.current += 1;
      }
      worstFrameMsRef.current = Math.max(worstFrameMsRef.current, frameMs);

      if (now - lastSecondRef.current >= 1000) {
        const secondsElapsed = (now - lastSecondRef.current) / 1000;
        const fps = Math.round(frameCountRef.current / secondsElapsed);
        frameCountRef.current = 0;
        lastSecondRef.current = now;

        const memorySnapshot = getMemorySnapshot();
        const domNodes =
          typeof document !== "undefined"
            ? document.getElementsByTagName("*").length
            : Number.NaN;
        setMetrics({
          fps,
          frameMs,
          worstFrameMs: worstFrameMsRef.current,
          jankFrames: jankFramesRef.current,
          longTaskCount: longTaskSupportedRef.current
            ? longTaskCountRef.current
            : Number.NaN,
          longTaskMaxMs: longTaskSupportedRef.current
            ? longTaskMaxMsRef.current
            : Number.NaN,
          longTaskTotalMs: longTaskSupportedRef.current
            ? longTaskTotalMsRef.current
            : Number.NaN,
          domNodes,
          heapUsedMb: memorySnapshot.usedMb,
          heapLimitMb: memorySnapshot.limitMb,
          heapPercent: memorySnapshot.percent,
        });

        jankFramesRef.current = 0;
        worstFrameMsRef.current = 0;
        longTaskCountRef.current = 0;
        longTaskMaxMsRef.current = 0;
        longTaskTotalMsRef.current = 0;
      }

      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      longTaskObserver?.disconnect();
    };
  }, []);

  return metrics;
};

const isOverlayEnabled = () => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem("mp_debug_overlay");
  if (stored === null) return false; // Default to disabled
  return stored === "on";
};

const DebugOverlay = () => {
  const [enabled, setEnabled] = useState(isOverlayEnabled);
  const metrics = useDebugOverlayMetrics();
  const [renderProfile, setRenderProfile] = useState<RenderProfileSnapshot | null>(null);

  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      setEnabled(customEvent.detail.enabled);
    };

    window.addEventListener("mp_debug_overlay_change", handlePreferenceChange);

    return () => {
      window.removeEventListener("mp_debug_overlay_change", handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    return subscribeRenderProfile((snapshot) => {
      setRenderProfile(snapshot);
    });
  }, []);

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
        <span className="debug-overlay__label">Worst Frame</span>
        <span className="debug-overlay__value">
          {metrics.worstFrameMs.toFixed(1)} ms
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Jank Frames</span>
        <span className="debug-overlay__value">{metrics.jankFrames}</span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Long Tasks</span>
        <span className="debug-overlay__value">
          {Number.isFinite(metrics.longTaskCount)
            ? metrics.longTaskCount
            : LONG_TASK_UNSUPPORTED}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Long Task Max</span>
        <span className="debug-overlay__value">
          {Number.isFinite(metrics.longTaskMaxMs)
            ? `${metrics.longTaskMaxMs.toFixed(1)} ms`
            : LONG_TASK_UNSUPPORTED}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Long Task Total</span>
        <span className="debug-overlay__value">
          {Number.isFinite(metrics.longTaskTotalMs)
            ? `${metrics.longTaskTotalMs.toFixed(1)} ms`
            : LONG_TASK_UNSUPPORTED}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">DOM Nodes</span>
        <span className="debug-overlay__value">
          {Number.isFinite(metrics.domNodes) ? metrics.domNodes : DOM_NODES_UNAVAILABLE}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Render</span>
        <span className="debug-overlay__value">
          {renderProfile
            ? `${renderProfile.id} (${renderProfile.phase})`
            : LONG_TASK_UNSUPPORTED}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Render Actual</span>
        <span className="debug-overlay__value">
          {renderProfile ? `${renderProfile.actualDuration.toFixed(1)} ms` : LONG_TASK_UNSUPPORTED}
        </span>
      </div>
      <div className="debug-overlay__row">
        <span className="debug-overlay__label">Render Base</span>
        <span className="debug-overlay__value">
          {renderProfile ? `${renderProfile.baseDuration.toFixed(1)} ms` : LONG_TASK_UNSUPPORTED}
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
