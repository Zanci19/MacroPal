export type UnitSystem = "metric" | "imperial";

export const DEFAULT_UNIT_SYSTEM: UnitSystem = "metric";

export const getUnitSystem = (value: unknown): UnitSystem =>
  value === "imperial" ? "imperial" : "metric";

export const weightLabel = (system: UnitSystem) =>
  system === "imperial" ? "lb" : "kg";

export const heightLabel = (system: UnitSystem) =>
  system === "imperial" ? "in" : "cm";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export const toMetricWeight = (value: number, system: UnitSystem) =>
  system === "imperial" ? value * KG_PER_LB : value;

export const fromMetricWeight = (value: number, system: UnitSystem) =>
  system === "imperial" ? value / KG_PER_LB : value;

export const toMetricHeight = (value: number, system: UnitSystem) =>
  system === "imperial" ? value * CM_PER_IN : value;

export const fromMetricHeight = (value: number, system: UnitSystem) =>
  system === "imperial" ? value / CM_PER_IN : value;
