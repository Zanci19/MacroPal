import type { ClinicianLink, RiskThresholds, UserRole } from "../types";

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  adherence7dMin: 0.5,
  adherence30dMin: 0.6,
};
// 3+ open alerts indicates sustained risk requiring clinician attention.
export const OPEN_ALERT_RISK_THRESHOLD_COUNT = 3;

export const resolveUserRole = (role: unknown): UserRole => {
  if (role === "clinician" || role === "admin") return role;
  return "user";
};

export const isClinicianRole = (role: unknown): boolean =>
  resolveUserRole(role) === "clinician" || resolveUserRole(role) === "admin";

export const isValidFirestorePathSegment = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !value.includes("/");

export const isClinicianLinkRecord = (clinicianLink: unknown): clinicianLink is ClinicianLink => {
  if (!clinicianLink || typeof clinicianLink !== "object") return false;
  const link = clinicianLink as { clinicianUid?: unknown; status?: unknown };
  const hasValidStatus = link.status === "active" || link.status === "revoked";
  return hasValidStatus && isValidFirestorePathSegment(link.clinicianUid);
};

export const hasActiveClinicianLink = (
  clinicianLink: unknown
): clinicianLink is {
  clinicianUid: string;
  status: "active" | "revoked";
} => {
  return isClinicianLinkRecord(clinicianLink) && clinicianLink.status === "active";
};

export const shouldShowClinicianFeatures = (params: {
  featureEnabled: boolean;
  role: UserRole;
  clinicianLink?: unknown;
}): boolean => {
  if (!params.featureEnabled) return false;
  if (params.role === "clinician" || params.role === "admin") return true;
  return hasActiveClinicianLink(params.clinicianLink);
};

export const calculateAdherenceRate = (
  loggedDays: number,
  periodDays: number
): number => {
  if (periodDays <= 0) return 0;
  const safeDays = Math.max(0, Math.min(loggedDays, periodDays));
  return Number((safeDays / periodDays).toFixed(2));
};

export const computeTrendDelta = (shortWindow: number, longWindow: number): number =>
  Number((shortWindow - longWindow).toFixed(2));

export const evaluateRiskReasons = (params: {
  adherence7d: number;
  adherence30d: number;
  thresholds?: RiskThresholds;
  openAlertCount?: number;
}): string[] => {
  const thresholds = params.thresholds ?? DEFAULT_RISK_THRESHOLDS;
  const reasons: string[] = [];

  if (params.adherence7d < thresholds.adherence7dMin) {
    reasons.push("low_adherence_7d");
  }
  if (params.adherence30d < thresholds.adherence30dMin) {
    reasons.push("low_adherence_30d");
  }
  if ((params.openAlertCount ?? 0) >= OPEN_ALERT_RISK_THRESHOLD_COUNT) {
    reasons.push("multiple_open_alerts");
  }

  return reasons;
};

export const resolveAlertSeverity = (reasons: string[]): "low" | "medium" | "high" | "critical" => {
  if (reasons.includes("multiple_open_alerts")) return "high";
  if (reasons.includes("low_adherence_7d")) return "medium";
  if (reasons.includes("low_adherence_30d")) return "medium";
  return "low";
};

export const canClinicianAccessUser = (
  role: UserRole,
  assignedUserIds: string[],
  userUid: string
): boolean => {
  if (!isValidFirestorePathSegment(userUid)) return false;
  if (role === "admin") return true;
  if (role !== "clinician") return false;
  return assignedUserIds.some((assignedUid) =>
    isValidFirestorePathSegment(assignedUid) && assignedUid === userUid
  );
};
