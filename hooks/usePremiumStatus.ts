import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser, usePlacement } from 'expo-superwall';
import { supabase } from '@/lib/supabase';

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
  const { subscriptionStatus } = useUser();
  const [isComplimentaryPro, setIsComplimentaryPro] = useState(false);
  const [isCheckingComplimentary, setIsCheckingComplimentary] = useState(true);
  
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
  
  // User is premium if they have active Superwall subscription OR complimentary pro access
  const isPremiumFromSuperwall = subscriptionStatus?.status === "ACTIVE";
  const isPremium = isPremiumFromSuperwall || isComplimentaryPro;
  
  // Still loading if either Superwall or complimentary check is pending
  const superwallLoading = subscriptionStatus?.status === "UNKNOWN" || subscriptionStatus === undefined;
  const isLoading = superwallLoading && isCheckingComplimentary;

  // #region agent log
  // Log premium status calculation for debugging (Hypothesis A & D)
  useEffect(() => {
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:usePremiumStatus',message:'Premium status calculated',data:{isPremium,isPremiumFromSuperwall,isComplimentaryPro,superwallStatus:subscriptionStatus?.status,isLoading},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,D'})}).catch(()=>{});
  }, [isPremium, isPremiumFromSuperwall, isComplimentaryPro, subscriptionStatus?.status, isLoading]);
  // #endregion

  return {
    isPremium,
    isLoading,
    subscriptionStatus,
    isComplimentaryPro, // Expose for debugging/admin purposes
  };
}

/**
 * Hook to trigger a paywall for premium features
 * Use this when you want to gate a feature behind a paywall
 */
export function usePremiumFeature() {
  const { registerPlacement, state: paywallState } = usePlacement({
    onPresent: (info) => {
      console.log('Paywall presented:', info.name);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:usePremiumFeature:onPresent',message:'Paywall PRESENTED',data:{paywallName:info.name},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    },
    onDismiss: (info, result) => {
      console.log('Paywall dismissed:', result);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:usePremiumFeature:onDismiss',message:'Paywall DISMISSED',data:{paywallName:info?.name,dismissResult:JSON.stringify(result)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})}).catch(()=>{});
      // #endregion
    },
    onSkip: (reason) => {
      console.log('Paywall skipped:', reason);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:usePremiumFeature:onSkip',message:'Paywall SKIPPED - feature will run',data:{skipReason:JSON.stringify(reason)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    },
    onError: (error) => {
      console.error('Paywall error:', error);
      // #region agent log
      fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:usePremiumFeature:onError',message:'Paywall ERROR',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    },
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
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:requestPremiumAccess:before',message:'Calling registerPlacement',data:{placement,hasCallback:!!onFeatureAccess},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    await registerPlacement({
      placement,
      feature: () => {
        // #region agent log
        fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:requestPremiumAccess:featureCallback',message:'FEATURE CALLBACK EXECUTED - Superwall granted access',data:{placement},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (onFeatureAccess) {
          onFeatureAccess();
        }
      },
    });
    // #region agent log
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePremiumStatus.ts:requestPremiumAccess:after',message:'registerPlacement completed',data:{placement},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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

