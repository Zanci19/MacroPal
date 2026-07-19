import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isLowEndDevice } from "./performanceMode";

type Profile = {
  label: string;
  cores?: number;
  memory?: number;
  ua: string;
  expected: boolean;
};

// deviceMemory is capped at 4 by spec: 4 means ">= 4GB", i.e. a healthy device.
const PROFILES: Profile[] = [
  { label: "Pixel 7 (8 cores, reports 4)", cores: 8, memory: 4, ua: "Android", expected: false },
  { label: "Mid-range Android (6 cores, reports 4)", cores: 6, memory: 4, ua: "Android", expected: false },
  { label: "Mid-range Android (5 cores, reports 4)", cores: 5, memory: 4, ua: "Android", expected: false },
  { label: "WebView, memory hint absent (8 cores)", cores: 8, memory: undefined, ua: "Android", expected: false },
  { label: "WebView, memory hint absent (6 cores)", cores: 6, memory: undefined, ua: "Android", expected: false },
  { label: "Genuinely weak CPU (4 cores)", cores: 4, memory: 4, ua: "Android", expected: true },
  { label: "Genuinely low RAM (2GB)", cores: 8, memory: 2, ua: "Android", expected: true },
  { label: "Very low RAM (1GB)", cores: 8, memory: 1, ua: "Android", expected: true },
  { label: "Desktop (12 cores)", cores: 12, memory: 4, ua: "Macintosh", expected: false },
];

let originalNavigator: PropertyDescriptor | undefined;

beforeEach(() => {
  originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  window.localStorage.clear();
});

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
});

function mockNavigator(p: Partial<Profile>) {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      hardwareConcurrency: p.cores,
      deviceMemory: p.memory,
      userAgent: p.ua,
      connection: { effectiveType: "4g", saveData: false },
    },
    configurable: true,
  });
}

describe("isLowEndDevice", () => {
  for (const p of PROFILES) {
    it(`${p.label} -> ${p.expected ? "LOW-END" : "full animations"}`, () => {
      mockNavigator(p);
      expect(isLowEndDevice()).toBe(p.expected);
    });
  }

  it("respects the explicit user override in both directions", () => {
    mockNavigator({ cores: 8, memory: 4, ua: "Android" });
    window.localStorage.setItem("mp_performance_mode", "on");
    expect(isLowEndDevice()).toBe(true);

    mockNavigator({ cores: 2, memory: 1, ua: "Android" });
    window.localStorage.setItem("mp_performance_mode", "off");
    expect(isLowEndDevice()).toBe(false);
  });

  it("still flags data-saver / 2g regardless of hardware", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        hardwareConcurrency: 8,
        deviceMemory: 4,
        userAgent: "Android",
        connection: { effectiveType: "2g", saveData: false },
      },
      configurable: true,
    });
    expect(isLowEndDevice()).toBe(true);
  });
});
