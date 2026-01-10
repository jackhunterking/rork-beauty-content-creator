import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser, usePlacement } from 'expo-superwall';

/**
 * Premium Status Hook
 * 
 * Manages premium/subscription status for the app using Superwall.
 * Superwall handles:
 * - Paywall presentation
 * - Subscription status tracking
 * - A/B testing for paywalls
 * 
 * Premium features:
 * - Remove watermark from rendered images
 * - (Future) Additional templates
 * - (Future) Advanced features
 */

const PREMIUM_STORAGE_KEY = '@beauty_app_premium_status';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt?: Date;
  plan?: 'monthly' | 'yearly' | 'lifetime';
}

/**
 * Main premium status hook using Superwall
 * Use this throughout the app to check subscription status
 * 
 * subscriptionStatus.status can be:
 * - "ACTIVE" - User has an active subscription
 * - "INACTIVE" - User does not have a subscription
 * - "UNKNOWN" - Subscription status is being determined
 */
export function usePremiumStatus() {
  const { subscriptionStatus } = useUser();
  
  // Determine if user is premium based on Superwall's subscription status
  const isPremium = subscriptionStatus?.status === "ACTIVE";
  const isLoading = subscriptionStatus?.status === "UNKNOWN" || subscriptionStatus === undefined;

  return {
    isPremium,
    isLoading,
    subscriptionStatus,
  };
}

/**
 * Hook to trigger a paywall for premium features
 * Use this when you want to gate a feature behind a paywall
 */
export function usePremiumFeature() {
  const { registerPlacement, state: paywallState } = usePlacement({
    onPresent: (info) => console.log('Paywall presented:', info.name),
    onDismiss: (info, result) => console.log('Paywall dismissed:', result),
    onSkip: (reason) => console.log('Paywall skipped:', reason),
    onError: (error) => console.error('Paywall error:', error),
  });

  /**
   * Request access to a premium feature
   * If user is subscribed, the feature callback runs immediately
   * If not subscribed, a paywall is shown
   * 
   * @param placement - The placement name configured in Superwall dashboard
   * @param onFeatureAccess - Callback when user gets access (subscribed or passes paywall)
   */
  const requestPremiumAccess = useCallback(async (
    placement: string,
    onFeatureAccess?: () => void
  ) => {
    await registerPlacement({
      placement,
      feature: onFeatureAccess,
    });
  }, [registerPlacement]);

  return {
    requestPremiumAccess,
    paywallState,
  };
}

/**
 * Legacy hook for development/testing without Superwall
 * Useful for testing premium features locally
 */
export function usePremiumStatusLegacy() {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<'monthly' | 'yearly' | 'lifetime' | undefined>();
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();

  // Load premium status from storage
  useEffect(() => {
    loadPremiumStatus();
  }, []);

  const loadPremiumStatus = async () => {
    try {
      const storedData = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        
        // Check if subscription is still valid
        if (data.expiresAt) {
          const expiry = new Date(data.expiresAt);
          if (expiry > new Date()) {
            setIsPremium(true);
            setPlan(data.plan);
            setExpiresAt(expiry);
          } else {
            // Subscription expired
            setIsPremium(false);
            await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
          }
        } else if (data.plan === 'lifetime') {
          // Lifetime never expires
          setIsPremium(true);
          setPlan('lifetime');
        }
      }
    } catch (error) {
      console.error('Failed to load premium status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Set premium status (called after successful purchase)
  const setPremiumActive = useCallback(async (
    newPlan: 'monthly' | 'yearly' | 'lifetime',
    expiry?: Date
  ) => {
    try {
      const data = {
        isPremium: true,
        plan: newPlan,
        expiresAt: newPlan === 'lifetime' ? undefined : expiry?.toISOString(),
        activatedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(data));
      
      setIsPremium(true);
      setPlan(newPlan);
      setExpiresAt(expiry);
    } catch (error) {
      console.error('Failed to save premium status:', error);
      throw error;
    }
  }, []);

  // Clear premium status (for testing or cancellation)
  const clearPremium = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
      setIsPremium(false);
      setPlan(undefined);
      setExpiresAt(undefined);
    } catch (error) {
      console.error('Failed to clear premium status:', error);
    }
  }, []);

  // Refresh status (call when app comes to foreground)
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    await loadPremiumStatus();
  }, []);

  return {
    isPremium,
    isLoading,
    plan,
    expiresAt,
    setPremiumActive,
    clearPremium,
    refreshStatus,
  };
}

/**
 * Check premium status from local storage (legacy fallback)
 * Note: This is a convenience function that returns the last known status
 * For accurate status, use the usePremiumStatus hook
 */
export async function checkPremiumStatusLegacy(): Promise<boolean> {
  try {
    const storedData = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
    
    if (!storedData) {
      return false;
    }
    
    const data = JSON.parse(storedData);
    
    if (data.plan === 'lifetime') {
      return true;
    }
    
    if (data.expiresAt) {
      return new Date(data.expiresAt) > new Date();
    }
    
    return false;
  } catch {
    return false;
  }
}

export default usePremiumStatus;

