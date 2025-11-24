export interface ActivityPreset {
  id: string;
  label: string;
  met: number; // Metabolic equivalent
  defaultMinutes: number;
  intensity?: "easy" | "moderate" | "hard" | string;
  blurb?: string;
}

export const ACTIVITY_PRESETS: ActivityPreset[] = [
  {
    id: "walking_brisk",
    label: "Walking - brisk",
    met: 4.3,
    defaultMinutes: 30,
    intensity: "easy",
    blurb: "Casual pace around the neighborhood",
  },
  {
    id: "walking_hike",
    label: "Hiking - trail",
    met: 6.0,
    defaultMinutes: 50,
    intensity: "moderate",
    blurb: "Mixed terrain with small hills",
  },
  {
    id: "running_jog",
    label: "Running - easy jog",
    met: 8.3,
    defaultMinutes: 30,
    intensity: "moderate",
    blurb: "Light jog, conversational pace",
  },
  {
    id: "running_tempo",
    label: "Running - tempo",
    met: 11.0,
    defaultMinutes: 40,
    intensity: "hard",
    blurb: "Steady race-pace session",
  },
  {
    id: "cycling_commute",
    label: "Cycling - commute",
    met: 6.8,
    defaultMinutes: 35,
    intensity: "moderate",
    blurb: "City ride with stop-and-go",
  },
  {
    id: "cycling_vigorous",
    label: "Cycling - vigorous",
    met: 10.0,
    defaultMinutes: 45,
    intensity: "hard",
    blurb: "Faster road or indoor session",
  },
  {
    id: "elliptical",
    label: "Elliptical trainer",
    met: 5.0,
    defaultMinutes: 30,
    intensity: "moderate",
  },
  {
    id: "rowing",
    label: "Rowing machine",
    met: 7.0,
    defaultMinutes: 25,
    intensity: "hard",
  },
  {
    id: "swimming_laps",
    label: "Swimming laps",
    met: 8.3,
    defaultMinutes: 40,
    intensity: "hard",
  },
  {
    id: "jump_rope",
    label: "Jump rope",
    met: 12.3,
    defaultMinutes: 15,
    intensity: "hard",
    blurb: "Intervals or steady skipping",
  },
  {
    id: "strength_full",
    label: "Strength - full body",
    met: 5.0,
    defaultMinutes: 45,
    intensity: "moderate",
  },
  {
    id: "strength_upper",
    label: "Strength - upper body",
    met: 4.0,
    defaultMinutes: 35,
    intensity: "moderate",
  },
  {
    id: "hiit",
    label: "HIIT circuit",
    met: 9.0,
    defaultMinutes: 20,
    intensity: "hard",
  },
  {
    id: "yoga_flow",
    label: "Yoga - vinyasa",
    met: 3.3,
    defaultMinutes: 45,
    intensity: "easy",
  },
  {
    id: "pilates",
    label: "Pilates",
    met: 3.5,
    defaultMinutes: 45,
    intensity: "easy",
  },
  {
    id: "dance_cardio",
    label: "Dance cardio",
    met: 6.5,
    defaultMinutes: 35,
    intensity: "moderate",
  },
  {
    id: "basketball",
    label: "Basketball - half court",
    met: 6.5,
    defaultMinutes: 40,
    intensity: "hard",
  },
  {
    id: "soccer",
    label: "Soccer / football",
    met: 7.0,
    defaultMinutes: 50,
    intensity: "hard",
  },
  {
    id: "tennis",
    label: "Tennis",
    met: 7.3,
    defaultMinutes: 60,
    intensity: "moderate",
  },
  {
    id: "badminton",
    label: "Badminton",
    met: 5.5,
    defaultMinutes: 45,
    intensity: "moderate",
  },
  {
    id: "volleyball",
    label: "Volleyball",
    met: 4.0,
    defaultMinutes: 50,
    intensity: "easy",
  },
  {
    id: "hiking_packs",
    label: "Hiking with pack",
    met: 7.0,
    defaultMinutes: 90,
    intensity: "hard",
  },
  {
    id: "stair_climber",
    label: "Stair climber",
    met: 8.8,
    defaultMinutes: 25,
    intensity: "hard",
  },
  {
    id: "skiing",
    label: "Skiing",
    met: 7.0,
    defaultMinutes: 60,
    intensity: "moderate",
  },
  {
    id: "snowboarding",
    label: "Snowboarding",
    met: 5.3,
    defaultMinutes: 60,
    intensity: "moderate",
  },
  {
    id: "skating",
    label: "Inline / ice skating",
    met: 7.0,
    defaultMinutes: 40,
    intensity: "moderate",
  },
  {
    id: "kayaking",
    label: "Kayaking",
    met: 5.0,
    defaultMinutes: 50,
    intensity: "moderate",
  },
  {
    id: "gardening",
    label: "Gardening - heavy",
    met: 4.5,
    defaultMinutes: 60,
    intensity: "easy",
  },
  {
    id: "housework",
    label: "Housework - deep clean",
    met: 3.5,
    defaultMinutes: 60,
    intensity: "easy",
  },
];

export const getActivityPreset = (id?: string) =>
  ACTIVITY_PRESETS.find((act) => act.id === id) || ACTIVITY_PRESETS[0];

/**
 * Estimate calories using MET formula with a small body-surface tweak.
 */
export function estimateCaloriesBurned(
  preset: ActivityPreset,
  weightKg: number,
  heightCm: number,
  durationMinutes: number
): number {
  const safeWeight = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 70;
  const safeHeight = Number.isFinite(heightCm) && heightCm > 0 ? heightCm : 170;

  const hours = Math.max(0.17, durationMinutes / 60); // guard short durations

  // Body surface area (DuBois formula) to gently scale burn for height.
  const heightMeters = safeHeight / 100;
  const bsa = 0.007184 * Math.pow(heightMeters, 0.725) * Math.pow(safeWeight, 0.425);
  const bsaFactor = Math.min(1.15, Math.max(0.85, bsa / 1.9));

  return Math.round(preset.met * safeWeight * hours * bsaFactor);
}