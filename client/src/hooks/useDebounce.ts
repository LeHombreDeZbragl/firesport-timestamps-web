import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * milliseconds of no changes.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchTerm, 300);
 *
 * The debounce timer is reset on every value change. When the component
 * unmounts the pending timeout is cleared automatically.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
