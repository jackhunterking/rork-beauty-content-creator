import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser, usePlacement, useSuperwall } from 'expo-superwall';
import { supabase } from '@/lib/supabase';
import type { SubscriptionStatus, Entitlement, EntitlementsInfo } from 'expo-superwall';

/**
 * Premium Status Hook
 * 
 * Manages premium/subscription status for the app using Superwall + Supabase.
 * 
 * Premium status is determined by:
 * 1. Superwall subscription status (paid subscription via app store)
 * 2. OR Complimentary pro flag in Supabase (admin-granted access)
 * 
 * Superwall handles:
 * - Paywall presentation
 * - Subscription status tracking
 * - A/B testing for paywalls
 * 
 * Supabase handles:
 * - Complimentary pro access (admin-granted)
 * 
 * Premium features:
 * - Remove watermark from rendered images
 * - (Future) Additional templates
 * - (Future) Advanced features
 */

const PREMIUM_STORAGE_KEY = '@resulta_app_premium_status';

export interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  expiresAt?: Date;
  plan?: 'monthly' | 'yearly' | 'lifetime';
}

/**
 * Subscription details exposed by the enhanced hook
 */
export interface SubscriptionDetails {
  /** Current status: ACTIVE, INACTIVE, or UNKNOWN */
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  /** List of active entitlements (when ACTIVE) */
  entitlements: Entitlement[];
  /** Whether subscription is from Superwall (app store) or complimentary */
  source: 'superwall' | 'complimentary' | 'none';
  /** Superwall user ID for debugging/dashboard lookup */
  superwallUserId?: string;
  /** Current billing plan (detected from entitlements: weekly or monthly) */
  currentPlan?: 'weekly' | 'monthly' | 'unknown';
}

/**
 * Detect current plan from entitlements
 * Maps entitlement IDs to plan types
 */
function detectCurrentPlan(entitlements: Entitlement[]): 'weekly' | 'monthly' | 'unknown' {
  const entitlementIds = entitlements.map(e => e.id.toLowerCase());
  
  // Check for exact matches first (from Superwall dashboard config)
  if (entitlementIds.includes('weekly')) return 'weekly';
  if (entitlementIds.includes('monthly')) return 'monthly';
  
  // Fallback: check for common patterns in entitlement IDs
  if (entitlementIds.some(id => id.includes('week'))) return 'weekly';
  if (entitlementIds.some(id => id.includes('month'))) return 'monthly';
  
  return 'unknown';
}

/**
 * Main premium status hook using Superwall + Supabase complimentary pro check
 * Use this throughout the app to check subscription status
 * 
 * subscriptionStatus.status can be:
 * - "ACTIVE" - User has an active subscription
 * - "INACTIVE" - User does not have a subscription
 * - "UNKNOWN" - Subscription status is being determined
 * 
 * Additionally checks is_complimentary_pro flag in Supabase profiles table
 */
export function usePremiumStatus() {
  const { subscriptionStatus, user: superwallUser } = useUser();
  const { getEntitlements } = useSuperwall();
  const [isComplimentaryPro, setIsComplimentaryPro] = useState(false);
  const [isCheckingComplimentary, setIsCheckingComplimentary] = useState(true);
  const [entitlementsInfo, setEntitlementsInfo] = useState<EntitlementsInfo | null>(null);
  
  // Check for complimentary pro status from Supabase
  useEffect(() => {
    const checkComplimentaryProStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_complimentary_pro')
            .eq('id', user.id)
            .single();
          
          if (!error && profile?.is_complimentary_pro) {
            setIsComplimentaryPro(true);
          } else {
            setIsComplimentaryPro(false);
          }
        } else {
          setIsComplimentaryPro(false);
        }
      } catch (error) {
        console.error('[Premium] Failed to check complimentary pro status:', error);
        setIsComplimentaryPro(false);
      } finally {
        setIsCheckingComplimentary(false);
      }
    };

    checkComplimentaryProStatus();

    // Subscribe to auth changes to re-check when user signs in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setIsCheckingComplimentary(true);
      checkComplimentaryProStatus();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch detailed entitlements info when subscription status is ACTIVE
  useEffect(() => {
    const fetchEntitlements = async () => {
      if (subscriptionStatus?.status === 'ACTIVE') {
        try {
          const info = await getEntitlements();
          setEntitlementsInfo(info);
          console.log('[Premium] Fetched entitlements:', info);
        } catch (error) {
          console.error('[Premium] Failed to fetch entitlements:', error);
        }
      } else {
        setEntitlementsInfo(null);
      }
    };

    fetchEntitlements();
  }, [subscriptionStatus?.status, getEntitlements]);
  
  // User is premium if they have active Superwall subscription OR complimentary pro access
  const isPremiumFromSuperwall = subscriptionStatus?.status === "ACTIVE";
  const isPremium = isPremiumFromSuperwall || isComplimentaryPro;
  
  // Still loading if either Superwall or complimentary check is pending
  const superwallLoading = subscriptionStatus?.status === "UNKNOWN" || subscriptionStatus === undefined;
  const isLoading = superwallLoading && isCheckingComplimentary;

  // Build subscription details for UI display
  const activeEntitlements = subscriptionStatus?.status === 'ACTIVE' 
    ? (subscriptionStatus as { status: 'ACTIVE'; entitlements: Entitlement[] }).entitlements || []
    : [];

  const subscriptionDetails: SubscriptionDetails = {
    status: subscriptionStatus?.status ?? 'UNKNOWN',
    entitlements: activeEntitlements,
    source: isPremiumFromSuperwall ? 'superwall' : (isComplimentaryPro ? 'complimentary' : 'none'),
    superwallUserId: superwallUser?.appUserId,
    currentPlan: subscriptionStatus?.status === 'ACTIVE' 
      ? detectCurrentPlan(activeEntitlements)
      : undefined,
  };

  return {
    isPremium,
    isLoading,
    subscriptionStatus,
    subscriptionDetails,
    entitlementsInfo,
    isComplimentaryPro, // Expose for debugging/admin purposes
    superwallUserId: superwallUser?.appUserId, // Useful for looking up user in Superwall dashboard
  };
}

/**
 * Placement parameters that can be passed to the paywall
 * These become available as {{ params.paramName }} in Superwall's paywall editor
 */
export interface PlacementParams {
  /** Current subscription plan: 'weekly', 'monthly', or 'free' */
  currentPlan?: 'weekly' | 'monthly' | 'free' | 'unknown';
  /** Any additional custom parameters */
  [key: string]: string | number | boolean | undefined;
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
   * IMPORTANT: Ensure Feature Gating is set to "Gated" in the Superwall Dashboard
   * for proper behavior. If set to "Non-Gated", the feature will run on dismiss
   * regardless of purchase status.
   * 
   * @param placement - The placement name configured in Superwall dashboard
   * @param onFeatureAccess - Callback when user gets access (subscribed or passes paywall)
   * @param params - Optional placement parameters (available as {{ params.paramName }} in paywall)
   */
  const requestPremiumAccess = useCallback(async (
    placement: string,
    onFeatureAccess?: () => void,
    params?: PlacementParams
  ) => {
    await registerPlacement({
      placement,
      feature: onFeatureAccess,
      params,
    });
  }, [registerPlacement]);

  return {
    requestPremiumAccess,
    paywallState,
  };
}

/**
 * Hook to restore purchases directly without showing a paywall
 * Use this for the "Restore Purchases" button in Settings
 * 
 * This is critical for sandbox/TestFlight testing where reinstalls
 * reset the user identity. Calling restore will sync the Apple receipt
 * and update subscription status.
 */
export function useRestorePurchases() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  
  // Use the placement hook with a restore-specific placement
  // This will attempt to restore without necessarily showing a paywall
  const { registerPlacement } = usePlacement({
    onSkip: (reason) => {
      console.log('[Restore] Paywall skipped (user may already be subscribed):', reason);
      // If skipped with userIsSubscribed reason, restoration worked
      setRestoreSuccess(true);
    },
    onDismiss: (info, result) => {
      console.log('[Restore] Dismissed with result:', result);
      if (result.type === 'restored' || result.type === 'purchased') {
        setRestoreSuccess(true);
      }
    },
    onError: (error) => {
      console.error('[Restore] Error:', error);
      setRestoreError(error);
    },
  });

  /**
   * Attempt to restore purchases
   * This triggers Superwall to check for existing subscriptions
   * and update the subscription status accordingly
   */
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      // Use a dedicated restore placement
      // Configure this in Superwall dashboard to show restore UI or check status
      await registerPlacement({
        placement: 'restore_purchases',
        feature: () => {
          // Feature runs if user has active subscription
          console.log('[Restore] Subscription verified - user is subscribed');
          setRestoreSuccess(true);
        },
      });

      // Wait a moment for status to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      setRestoreError(errorMessage);
      console.error('[Restore] Failed:', error);
      return { success: false, error: errorMessage };
    } finally {
      setIsRestoring(false);
    }
  }, [registerPlacement]);

  // Reset success state after 3 seconds
  useEffect(() => {
    if (restoreSuccess) {
      const timeout = setTimeout(() => setRestoreSuccess(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [restoreSuccess]);

  return {
    restorePurchases,
    isRestoring,
    restoreError,
    restoreSuccess,
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

