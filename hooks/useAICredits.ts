/**
 * useAICredits Hook
 * 
 * React hook for managing AI credit balance.
 * Provides credit checking, balance display, and automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { getCredits, checkCredits } from '@/services/aiService';
import type { AICredits, AIFeatureKey, AIFeatureCheck } from '@/types';

// ============================================
// Types
// ============================================

interface UseAICreditsReturn {
  /** Current credit balance */
  credits: AICredits | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Check if user has enough credits for a feature */
  hasCredits: (featureKey: AIFeatureKey) => Promise<AIFeatureCheck>;
  /** Manually refresh credits */
  refreshCredits: () => Promise<void>;
  /** Check if user can afford a specific number of credits */
  canAfford: (amount: number) => boolean;
}

interface CachedCheck {
  result: AIFeatureCheck;
  timestamp: number;
}

// Cache check results for 30 seconds
const CHECK_CACHE_TTL = 30 * 1000;

// ============================================
// Hook Implementation
// ============================================

export function useAICredits(): UseAICreditsReturn {
  const { user, isAuthenticated } = useAuth();
  const [credits, setCredits] = useState<AICredits | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for feature checks
  const checkCache = useRef<Map<AIFeatureKey, CachedCheck>>(new Map());
  
  // Track if component is mounted
  const isMounted = useRef(true);

  /**
   * Fetch credits from server
   */
  const fetchCredits = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setCredits(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getCredits();
      
      if (isMounted.current) {
        setCredits(result);
      }
    } catch (err: any) {
      console.error('[useAICredits] Error fetching credits:', err);
      
      if (isMounted.current) {
        setError(err.message || 'Failed to fetch credits');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, user]);

  /**
   * Manual refresh
   */
  const refreshCredits = useCallback(async () => {
    // Clear check cache on refresh
    checkCache.current.clear();
    await fetchCredits();
  }, [fetchCredits]);

  /**
   * Check if user can afford a specific amount
   */
  const canAfford = useCallback((amount: number): boolean => {
    if (!credits) return false;
    return credits.creditsRemaining >= amount;
  }, [credits]);

  /**
   * Check if user has credits for a feature
   * Uses cache to avoid redundant API calls
   */
  const hasCredits = useCallback(async (
    featureKey: AIFeatureKey
  ): Promise<AIFeatureCheck> => {
    // Check cache first
    const cached = checkCache.current.get(featureKey);
    if (cached && Date.now() - cached.timestamp < CHECK_CACHE_TTL) {
      return cached.result;
    }

    try {
      const result = await checkCredits(featureKey);
      
      // Update cache
      checkCache.current.set(featureKey, {
        result,
        timestamp: Date.now(),
      });

      // Also update local credits state if we have it
      if (credits && result.creditsRemaining !== credits.creditsRemaining) {
        setCredits(prev => prev ? {
          ...prev,
          creditsRemaining: result.creditsRemaining,
        } : null);
      }

      return result;
    } catch (err: any) {
      console.error('[useAICredits] Error checking credits:', err);
      
      // Return pessimistic result on error
      return {
        hasCredits: false,
        creditsRemaining: credits?.creditsRemaining || 0,
        creditsRequired: 0,
      };
    }
  }, [credits]);

  // Initial fetch when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCredits();
    } else {
      setCredits(null);
      checkCache.current.clear();
    }
  }, [isAuthenticated, user, fetchCredits]);

  // Refresh on app foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isAuthenticated) {
        // Refresh credits when app comes to foreground
        fetchCredits();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, fetchCredits]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    credits,
    isLoading,
    error,
    hasCredits,
    refreshCredits,
    canAfford,
  };
}

// ============================================
// Utility Hook: useAIFeatureAvailability
// ============================================

/**
 * Hook to check availability of a specific AI feature
 * Combines premium status check with credit check
 */
export function useAIFeatureAvailability(featureKey: AIFeatureKey | null) {
  const { credits, hasCredits, isLoading: creditsLoading } = useAICredits();
  const [featureCheck, setFeatureCheck] = useState<AIFeatureCheck | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!featureKey) {
      setFeatureCheck(null);
      return;
    }

    let cancelled = false;
    
    const check = async () => {
      setIsChecking(true);
      try {
        const result = await hasCredits(featureKey);
        if (!cancelled) {
          setFeatureCheck(result);
        }
      } catch (err) {
        console.error('[useAIFeatureAvailability] Check failed:', err);
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [featureKey, hasCredits]);

  return {
    isAvailable: featureCheck?.hasCredits ?? false,
    creditsRequired: featureCheck?.creditsRequired ?? 0,
    creditsRemaining: credits?.creditsRemaining ?? 0,
    isLoading: creditsLoading || isChecking,
  };
}

export default useAICredits;
