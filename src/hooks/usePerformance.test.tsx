import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce, useThrottle } from "./usePerformance";

describe("useThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("runs the first call immediately", () => {
    const spy = vi.fn();
    const { result } = renderHook(() => useThrottle(spy, 300));

    act(() => {
      result.current("breakfast");
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("breakfast");

    act(() => {
      result.current("lunch");
      vi.advanceTimersByTime(299);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1);
      result.current("dinner");
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith("dinner");
  });
});

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("clears a pending timeout when the component unmounts", () => {
    const spy = vi.fn();
    const { result, unmount } = renderHook(() => useDebounce(spy, 250));

    act(() => {
      result.current("queued");
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(spy).not.toHaveBeenCalled();
  });
});
