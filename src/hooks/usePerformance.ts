import React, { useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for memoizing expensive calculations with dependencies
 * Better than useMemo for very expensive operations
 */
export function useExpensiveMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  debugLabel?: string
): T {
  return useMemo(() => {
    if (debugLabel && process.env.NODE_ENV === 'development') {
      console.time(`[Expensive Memo] ${debugLabel}`);
    }
    
    const result = factory();
    
    if (debugLabel && process.env.NODE_ENV === 'development') {
      console.timeEnd(`[Expensive Memo] ${debugLabel}`);
    }
    
    return result;
  }, deps);
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
  const lastRun = useRef(Date.now());

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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
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

  useEffect(() => {
    let cancelled = false;

    factory().then((result) => {
      if (!cancelled && isMounted()) {
        setValue(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, deps);

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
