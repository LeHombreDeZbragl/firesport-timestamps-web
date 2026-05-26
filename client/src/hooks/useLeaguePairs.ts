import { useState, useEffect } from 'react';
import { fetchLeaguePairs } from '../services/api';
import type { LeaguePair } from '../types';

export interface UseLeaguePairsResult {
  pairs: LeaguePair[];
  isLoading: boolean;
}

/**
 * Fetches all distinct (league short code → full name) pairs once on mount.
 * Used by LeagueFilter to show tooltips and enable long-name search.
 */
export function useLeaguePairs(): UseLeaguePairsResult {
  const [pairs, setPairs] = useState<LeaguePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchLeaguePairs()
      .then((fetchedPairs) => {
        if (!cancelled) {
          setPairs(fetchedPairs);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error('[useLeaguePairs] Failed to fetch league pairs:', err);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { pairs, isLoading };
}
