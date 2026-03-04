import { describe, it, expect } from 'vitest';
import {
  getUnitSystem,
  weightLabel,
  heightLabel,
  toMetricWeight,
  fromMetricWeight,
  toMetricHeight,
  fromMetricHeight,
  DEFAULT_UNIT_SYSTEM,
} from './units';

describe('DEFAULT_UNIT_SYSTEM', () => {
  it('should be metric', () => {
    expect(DEFAULT_UNIT_SYSTEM).toBe('metric');
  });
});

describe('getUnitSystem', () => {
  it('should return "imperial" for "imperial"', () => {
    expect(getUnitSystem('imperial')).toBe('imperial');
  });

  it('should return "metric" for "metric"', () => {
    expect(getUnitSystem('metric')).toBe('metric');
  });

  it('should default to "metric" for unknown values', () => {
    expect(getUnitSystem(undefined)).toBe('metric');
    expect(getUnitSystem(null)).toBe('metric');
    expect(getUnitSystem('other')).toBe('metric');
    expect(getUnitSystem(123)).toBe('metric');
  });
});

describe('weightLabel', () => {
  it('should return "lb" for imperial', () => {
    expect(weightLabel('imperial')).toBe('lb');
  });

  it('should return "kg" for metric', () => {
    expect(weightLabel('metric')).toBe('kg');
  });
});

describe('heightLabel', () => {
  it('should return "in" for imperial', () => {
    expect(heightLabel('imperial')).toBe('in');
  });

  it('should return "cm" for metric', () => {
    expect(heightLabel('metric')).toBe('cm');
  });
});

describe('toMetricWeight', () => {
  it('should convert pounds to kg', () => {
    const lbs = 154;
    const kg = toMetricWeight(lbs, 'imperial');
    expect(kg).toBeCloseTo(69.85, 1);
  });

  it('should return the value unchanged for metric', () => {
    expect(toMetricWeight(70, 'metric')).toBe(70);
  });
});

describe('fromMetricWeight', () => {
  it('should convert kg to pounds', () => {
    const kg = 70;
    const lbs = fromMetricWeight(kg, 'imperial');
    expect(lbs).toBeCloseTo(154.32, 1);
  });

  it('should return the value unchanged for metric', () => {
    expect(fromMetricWeight(70, 'metric')).toBe(70);
  });
});

describe('toMetricHeight', () => {
  it('should convert inches to cm', () => {
    const inches = 70; // ~5'10"
    const cm = toMetricHeight(inches, 'imperial');
    expect(cm).toBeCloseTo(177.8, 1);
  });

  it('should return the value unchanged for metric', () => {
    expect(toMetricHeight(175, 'metric')).toBe(175);
  });
});

describe('fromMetricHeight', () => {
  it('should convert cm to inches', () => {
    const cm = 177.8;
    const inches = fromMetricHeight(cm, 'imperial');
    expect(inches).toBeCloseTo(70, 1);
  });

  it('should return the value unchanged for metric', () => {
    expect(fromMetricHeight(175, 'metric')).toBe(175);
  });
});

describe('unit roundtrip conversions', () => {
  it('weight: metric → imperial → metric should be the original value', () => {
    const original = 80;
    const imperial = fromMetricWeight(original, 'imperial');
    const backToMetric = toMetricWeight(imperial, 'imperial');
    expect(backToMetric).toBeCloseTo(original, 5);
  });

  it('height: metric → imperial → metric should be the original value', () => {
    const original = 180;
    const imperial = fromMetricHeight(original, 'imperial');
    const backToMetric = toMetricHeight(imperial, 'imperial');
    expect(backToMetric).toBeCloseTo(original, 5);
  });
});
