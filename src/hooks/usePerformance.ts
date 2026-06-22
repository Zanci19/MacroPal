import React, { useCallback, useRef, useEffect } from 'react';

function areDepsEqual(
  prevDeps: React.DependencyList,
  nextDeps: React.DependencyList
): boolean {
  if (prevDeps.length !== nextDeps.length) return false;
  for (let i = 0; i < prevDeps.length; i += 1) {
    if (!Object.is(prevDeps[i], nextDeps[i])) return false;
  }
  return true;
}

/**
 * Hook for memoizing expensive calculations with dependencies
 * Better than useMemo for very expensive operations
 */
export function useExpensiveMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  debugLabel?: string
): T {
  const depsRef = useRef<React.DependencyList | null>(null);
  const valueRef = useRef<T | null>(null);

  if (!depsRef.current || !areDepsEqual(depsRef.current, deps)) {
    if (debugLabel && process.env.NODE_ENV === 'development') {
      console.time(`[Expensive Memo] ${debugLabel}`);
    }
    
    valueRef.current = factory();
    
    if (debugLabel && process.env.NODE_ENV === 'development') {
      console.timeEnd(`[Expensive Memo] ${debugLabel}`);
    }

    depsRef.current = [...deps];
  }

  return valueRef.current as T;
}

/**
 * Hook for debouncing values to reduce re-renders
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  // Start at 0 so the very first call always runs immediately (leading edge),
  // instead of being suppressed until `delay` has elapsed since mount.
  const lastRun = useRef(0);

  return useCallback(
    ((...args) => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        lastRun.current = now;
        return callback(...args);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook for debouncing function calls
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending invocation when the component unmounts so the debounced
  // callback can't fire (and touch unmounted state) after teardown.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return useCallback(
    ((...args) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

/**
 * Hook to track if component is mounted
 * Useful for preventing state updates after unmount
 */
export function useIsMounted(): () => boolean {
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  return useCallback(() => isMounted.current, []);
}

/**
 * Hook for memoizing async operations
 */
export function useAsyncMemo<T>(
  factory: () => Promise<T>,
  deps: React.DependencyList,
  initialValue: T
): T {
  const [value, setValue] = React.useState<T>(initialValue);
  const isMounted = useIsMounted();
  const depsRef = useRef<React.DependencyList | null>(null);

  useEffect(() => {
    if (depsRef.current && areDepsEqual(depsRef.current, deps)) {
      return;
    }
    depsRef.current = [...deps];

    let cancelled = false;

    void factory()
      .then((result) => {
        if (!cancelled && isMounted()) {
          setValue(result);
        }
      })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useAsyncMemo] Failed to refresh async value', error);
        }
      });

    return () => {
      cancelled = true;
    };
  });

  return value;
}

/**
 * Hook to measure component render performance
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);

  useEffect(() => {
    renderCount.current += 1;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Render Count] ${componentName}: ${renderCount.current}`);
    }
  });

  return renderCount.current;
}

/**
 * Hook for lazy initialization of expensive state
 */
export function useLazyState<T>(initializer: () => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initializer);
  return [state, setState];
}
