type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

const LOW_END_BODY_CLASS = "mp-low-end-mode";

const readOverride = (): "on" | "off" | "auto" => {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem("mp_performance_mode");
  if (raw === "on" || raw === "off" || raw === "auto") return raw;
  return "auto";
};

export const isLowEndDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;

  const override = readOverride();
  if (override === "on") return true;
  if (override === "off") return false;

  const nav = navigator as NavigatorWithHints;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : 8;
  const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
  const connection = nav.connection;
  const effectiveType = connection?.effectiveType ?? "";
  const saveData = Boolean(connection?.saveData);
  const isAndroid = /Android/i.test(nav.userAgent || "");
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const weakCpu = cores > 0 && cores <= 4;
  const weakMemory = memory > 0 && memory <= 3;
  const constrainedNetwork =
    saveData || effectiveType === "slow-2g" || effectiveType === "2g";
  const weakAndroid = isAndroid && cores <= 6 && memory <= 4;

  return reducedMotion || weakCpu || weakMemory || constrainedNetwork || weakAndroid;
};

export const applyRuntimePerformanceMode = (): boolean => {
  if (typeof document === "undefined") return false;
  const enabled = isLowEndDevice();
  document.body.classList.toggle(LOW_END_BODY_CLASS, enabled);
  return enabled;
};
