export const SETTINGS_ROUTES = {
  root: "/app/settings",
  profile: "/app/settings/profile",
  homeFeed: "/app/settings/home-feed",
  appearance: "/app/settings/appearance",
  deleteAccount: "/app/settings/delete-account",
  changelog: "/app/settings/changelog",
  feedback: "/app/settings/feedback",
  energyNeeds: "/app/settings/energy-needs",
  units: "/app/settings/units",
  reminders: "/app/settings/reminders",
  planner: "/app/settings/planner",
  dataPrivacy: "/app/settings/data-privacy",
  sharing: "/app/settings/sharing",
  sharedUser: (uid: string) => `/app/settings/shared-user/${uid}`,
  clinicianConnect: "/app/settings/clinician-connect",
  clinicianDashboard: "/app/settings/clinician-dashboard",
} as const;

export const LEGACY_SETTINGS_ROUTE_REDIRECTS = [
  ["/app/home-feed", SETTINGS_ROUTES.homeFeed],
  ["/app/appearance", SETTINGS_ROUTES.appearance],
  ["/app/delete-account", SETTINGS_ROUTES.deleteAccount],
  ["/app/changelog", SETTINGS_ROUTES.changelog],
  ["/app/feedback", SETTINGS_ROUTES.feedback],
  ["/app/energy-needs", SETTINGS_ROUTES.energyNeeds],
  ["/app/units", SETTINGS_ROUTES.units],
  ["/app/reminders", SETTINGS_ROUTES.reminders],
  ["/app/planner", SETTINGS_ROUTES.planner],
  ["/app/data-privacy", SETTINGS_ROUTES.dataPrivacy],
  ["/app/sharing", SETTINGS_ROUTES.sharing],
  ["/app/clinician-connect", SETTINGS_ROUTES.clinicianConnect],
  ["/app/clinician-dashboard", SETTINGS_ROUTES.clinicianDashboard],
] as const;

export const isSettingsPath = (path: string): boolean =>
  path === SETTINGS_ROUTES.root || path.startsWith(`${SETTINGS_ROUTES.root}/`);
