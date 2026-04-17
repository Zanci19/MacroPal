import {
  calculateAdherenceRate,
  canClinicianAccessUser,
  evaluateRiskReasons,
  hasActiveClinicianLink,
  isValidFirestorePathSegment,
  isClinicianRole,
  resolveAlertSeverity,
  resolveUserRole,
  shouldShowClinicianFeatures,
} from "./clinician";

describe("clinician utilities", () => {
  it("defaults unknown roles to user", () => {
    expect(resolveUserRole(undefined)).toBe("user");
    expect(resolveUserRole("unknown")).toBe("user");
  });

  it("identifies clinician roles", () => {
    expect(isClinicianRole("clinician")).toBe(true);
    expect(isClinicianRole("admin")).toBe(true);
    expect(isClinicianRole("user")).toBe(false);
  });

  it("keeps clinician features hidden unless enabled and authorized", () => {
    expect(
      shouldShowClinicianFeatures({
        featureEnabled: false,
        role: "clinician",
      })
    ).toBe(false);

    expect(
      shouldShowClinicianFeatures({
        featureEnabled: true,
        role: "user",
        clinicianLink: { clinicianUid: "c1", status: "active" },
      })
    ).toBe(true);

    expect(
      shouldShowClinicianFeatures({
        featureEnabled: true,
        role: "user",
        clinicianLink: { clinicianUid: "c1", status: "revoked" },
      })
    ).toBe(false);
  });

  it("checks clinician assignment access", () => {
    expect(canClinicianAccessUser("clinician", ["u1", "u2"], "u2")).toBe(true);
    expect(canClinicianAccessUser("clinician", ["u1"], "u3")).toBe(false);
    expect(canClinicianAccessUser("admin", [], "u3")).toBe(true);
    expect(canClinicianAccessUser("admin", [], "messages/u3")).toBe(false);
  });

  it("rejects Firestore path segments that contain slashes", () => {
    expect(isValidFirestorePathSegment("abc123")).toBe(true);
    expect(isValidFirestorePathSegment("messages/abc123")).toBe(false);
  });

  it("requires a valid clinician UID in active links", () => {
    expect(hasActiveClinicianLink({ clinicianUid: "c1", status: "active" })).toBe(true);
    expect(hasActiveClinicianLink({ clinicianUid: "messages/c1", status: "active" })).toBe(false);
  });

  it("evaluates adherence and risk alert logic", () => {
    expect(calculateAdherenceRate(4, 7)).toBe(0.57);
    const reasons = evaluateRiskReasons({
      adherence7d: 0.2,
      adherence30d: 0.4,
      openAlertCount: 3,
    });
    expect(reasons).toEqual(
      expect.arrayContaining([
        "low_adherence_7d",
        "low_adherence_30d",
        "multiple_open_alerts",
      ])
    );
    expect(resolveAlertSeverity(reasons)).toBe("high");
  });
});
