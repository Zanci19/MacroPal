import { Capacitor, registerPlugin } from "@capacitor/core";

interface GoogleFitPlugin {
  isAvailable?: () => Promise<{ available: boolean }>;
  requestPermissions?: () => Promise<{ granted: boolean }>;
  getCaloriesBurned?: (options: {
    start: string;
    end: string;
  }) => Promise<{ calories?: number }>;
}

const GoogleFit = registerPlugin<GoogleFitPlugin>("GoogleFit");

export interface GoogleFitCalorieResult {
  calories: number;
  reason: "ok" | "unavailable" | "not_installed" | "denied" | "error";
}

export type GoogleFitStatus = Pick<GoogleFitCalorieResult, "reason"> & {
  ready: boolean;
};

export const isGoogleFitSupported = (): boolean =>
  Capacitor.getPlatform() === "android" &&
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable("GoogleFit");

export const fetchGoogleFitCalories = async (
  startISO: string,
  endISO: string
): Promise<GoogleFitCalorieResult> => {
  const status = await ensureGoogleFitAccess();
  if (!status.ready) return { calories: 0, reason: status.reason };

  try {
    const result = await GoogleFit.getCaloriesBurned?.({ start: startISO, end: endISO });
    return { calories: Math.max(0, Math.round(result?.calories || 0)), reason: "ok" };
  } catch (err) {
    console.error("Google Fit sync failed", err);
    return { calories: 0, reason: "error" };
  }
};

export const ensureGoogleFitAccess = async (): Promise<GoogleFitStatus> => {
  if (!isGoogleFitSupported()) {
    return { ready: false, reason: "unavailable" };
  }

  try {
    const availability = (await GoogleFit.isAvailable?.()) ?? { available: false };
    if (!availability.available) {
      return { ready: false, reason: "not_installed" };
    }

    const permission = await GoogleFit.requestPermissions?.();
    if (permission && !permission.granted) {
      return { ready: false, reason: "denied" };
    }

    return { ready: true, reason: "ok" };
  } catch (err) {
    console.error("Google Fit availability failed", err);
    return { ready: false, reason: "error" };
  }
};
