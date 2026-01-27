import { useState, useEffect, useCallback, useRef } from 'react';
import { useUser, usePlacement, useSuperwall } from 'expo-superwall';
import { supabase } from '@/lib/supabase';
import type { Entitlement, EntitlementsInfo } from 'expo-superwall';
import { 
  trackSubscribe, 
  trackInitiatedCheckout,
  trackPurchase,
} from '@/services/metaAnalyticsService';
import type { SubscriptionTier, SubscriptionTierSource } from '@/types';

/**
 * Tiered Subscription Hook
 * 
 * Manages subscription tiers for the app using Superwall + Supabase.
 * 
 * Tiers:
 * - free: Full app access, create unlimited content, preview everything
 * - pro: Download to Photos + Share to social media
 * - studio: Pro features + All AI generation capabilities
 * 
 * Tier Sources:
 * - superwall: Paid subscription via in-app purchase
 * - complimentary: Admin-assigned for influencers, partners, testers
 * 
 * The hook resolves the HIGHEST tier from all sources.
 */

// ============================================
// Type Definitions
// ============================================

/**
 * Tiered subscription state returned by the hook
 */
export interface TieredSubscription {
  /** Current subscription tier */
  tier: SubscriptionTier;
  /** Loading state */
  isLoading: boolean;
  
  // Convenience booleans for feature gating
  /** True if user can download (Pro or Studio) */
  canDownload: boolean;
  /** True if user can share (Pro or Studio) */
  canShare: boolean;
  /** True if user can use AI Studio features (Studio only) */
  canUseAIStudio: boolean;
  
  /** Source of the tier (superwall, complimentary, or none) */
  source: SubscriptionTierSource | 'none';
  
  /** Superwall user ID for debugging/dashboard lookup */
  superwallUserId?: string;
  
  /** Current billing plan if from Superwall */
  currentPlan?: 'pro_weekly' | 'pro_monthly' | 'pro_yearly' | 'studio_weekly' | 'studio_monthly' | 'studio_yearly' | 'unknown';
  
  /** Active entitlements from Superwall */
  entitlements: Entitlement[];
  
  /** Detailed entitlements info from Superwall */
  entitlementsInfo: EntitlementsInfo | null;
  
  // ============================================
  // Feature-specific paywall triggers
  // With Gated paywalls: onFeatureGranted is called only after successful purchase
  // ============================================
  
  /** Show Download paywall (pro_download placement) - pass callback to execute after purchase */
  requestDownload: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show Share paywall (pro_share placement) - pass callback to execute after purchase */
  requestShare: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show Remove Watermark paywall (pro_watermark placement) */
  requestRemoveWatermark: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show Auto Quality paywall (studio_auto_quality placement) - pass callback to execute after purchase */
  requestAutoQuality: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show BG Remove paywall (studio_bg_remove placement) - pass callback to execute after purchase */
  requestBGRemove: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show BG Replace paywall (studio_bg_replace placement) - pass callback to execute after purchase */
  requestBGReplace: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  /** Show Membership paywall (membership_manage placement) */
  requestMembership: (onFeatureGranted?: () => void | Promise<void>) => Promise<void>;
  
  // ============================================
  // Legacy helpers (for backwards compatibility)
  // ============================================
  
  /** @deprecated Use feature-specific functions instead */
  requestProAccess: (onGranted?: () => void, featureRequested?: string, previewImageUrl?: string) => Promise<void>;
  
  /** @deprecated Use feature-specific functions instead */
  requestStudioAccess: (onGranted?: () => void, featureRequested?: string, previewImageUrl?: string) => Promise<void>;
}

/**
 * Placement parameters for paywall customization
 */
export interface PlacementParams {
  /** Feature that triggered the paywall */
  feature_requested?: string;
  /** User's current tier */
  current_tier?: SubscriptionTier;
  /** Preview image URL for dynamic paywall content */
  preview_image_url?: string;
  /** Any additional custom parameters */
  [key: string]: string | number | boolean | undefined;
}

// ============================================
// Tier Resolution Logic
// ============================================

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  studio: 2,
};

// ============================================
// Product Price Mapping for Meta Analytics
// Prices from App Store Connect (USD)
// ============================================

const PRODUCT_PRICE_MAP: Record<string, number> = {
  'resulta_pro_weekly': 4.49,
  'resulta_pro_monthly': 11.99,
  'resulta_pro_yearly': 114.99,
  'resulta_studio_weekly': 9.49,
  'resulta_studio_monthly': 26.99,
  'resulta_studio_yearly': 259.99,
};

/**
 * Resolve tier from Superwall entitlements
 * Maps entitlement IDs to subscription tiers
 */
function getTierFromEntitlements(entitlements: Entitlement[]): SubscriptionTier {
  const entitlementIds = entitlements.map(e => e.id.toLowerCase());
  
  // Check for studio entitlement (includes pro features)
  if (entitlementIds.includes('studio')) {
    return 'studio';
  }
  
  // Check for pro entitlement
  if (entitlementIds.includes('pro')) {
    return 'pro';
  }
  
  // Fallback: check for common patterns
  if (entitlementIds.some(id => id.includes('studio'))) {
    return 'studio';
  }
  if (entitlementIds.some(id => id.includes('pro') || id.includes('premium'))) {
    return 'pro';
  }
  
  return 'free';
}

/**
 * Detect current plan from entitlements
 */
function detectCurrentPlan(entitlements: Entitlement[]): TieredSubscription['currentPlan'] {
  const entitlementIds = entitlements.map(e => e.id.toLowerCase());
  
  // Studio plans
  if (entitlementIds.some(id => id.includes('studio') && id.includes('week'))) return 'studio_weekly';
  if (entitlementIds.some(id => id.includes('studio') && id.includes('month'))) return 'studio_monthly';
  if (entitlementIds.some(id => id.includes('studio') && id.includes('year'))) return 'studio_yearly';
  
  // Pro plans
  if (entitlementIds.some(id => id.includes('pro') && id.includes('week'))) return 'pro_weekly';
  if (entitlementIds.some(id => id.includes('pro') && id.includes('month'))) return 'pro_monthly';
  if (entitlementIds.some(id => id.includes('pro') && id.includes('year'))) return 'pro_yearly';
  
  // Legacy patterns (weekly/monthly without tier prefix)
  if (entitlementIds.includes('weekly') || entitlementIds.some(id => id.includes('week'))) return 'pro_weekly';
  if (entitlementIds.includes('monthly') || entitlementIds.some(id => id.includes('month'))) return 'pro_monthly';
  
  return 'unknown';
}

/**
 * Resolve the final tier from all sources (Superwall + Supabase)
 * Takes the HIGHEST tier available
 */
function resolveTier(
  superwallEntitlements: Entitlement[],
  supabaseTier: SubscriptionTier | undefined
): { tier: SubscriptionTier; source: SubscriptionTierSource | 'none' } {
  // Get tier from Superwall entitlements
  const superwallTier = getTierFromEntitlements(superwallEntitlements);
  
  // Get tier from Supabase (complimentary)
  const complimentaryTier = supabaseTier || 'free';
  
  // Take the HIGHER tier
  if (TIER_RANK[superwallTier] >= TIER_RANK[complimentaryTier]) {
    return {
      tier: superwallTier,
      source: superwallTier === 'free' ? 'none' : 'superwall',
    };
  } else {
    return {
      tier: complimentaryTier,
      source: 'complimentary',
    };
  }
}

// ============================================
// Main Hook
// ============================================

/**
 * Main tiered subscription hook
 * Use this throughout the app to check subscription tier and gate features
 */
export function useTieredSubscription(): TieredSubscription {
  const { subscriptionStatus, user: superwallUser } = useUser();
  const { getEntitlements, setUserAttributes } = useSuperwall();
  
  // Supabase tier state
  const [supabaseTier, setSupabaseTier] = useState<SubscriptionTier | undefined>(undefined);
  const [isCheckingSupabase, setIsCheckingSupabase] = useState(true);
  
  // Entitlements state
  const [entitlementsInfo, setEntitlementsInfo] = useState<EntitlementsInfo | null>(null);
  
  // Ref to store pending feature callback for Gated paywalls
  // When user purchases, we execute this callback to run the feature they wanted
  const pendingFeatureCallback = useRef<(() => void | Promise<void>) | null>(null);
  
  // Paywall placement hook - handles feature execution after successful gating
  const { registerPlacement: hookRegisterPlacement } = usePlacement({
    onPresent: (info) => {
      trackInitiatedCheckout(info.name);
    },
    onDismiss: (info, result) => {
      if (result.type === 'purchased') {
        // Get actual price from product ID mapping for accurate Meta attribution
        const price = PRODUCT_PRICE_MAP[result.productId] || 11.99; // fallback to pro monthly
        
        // Track subscription event for Meta with actual revenue
        trackSubscribe(result.productId, price, 'USD');
        
        // Also log as purchase event for ROAS optimization
        trackPurchase(price, 'USD', result.productId);
        
        // IMPORTANT: Execute the pending feature callback after successful purchase
        // With Gated paywalls, this is when the user gains access to the feature
        if (pendingFeatureCallback.current) {
          const callback = pendingFeatureCallback.current;
          pendingFeatureCallback.current = null; // Clear before executing
          
          // Execute the callback (could be async)
          try {
            const result = callback();
            // If it returns a promise, we don't need to await it here
            // The calling component handles any loading states
            if (result instanceof Promise) {
              result.catch((error) => {
                console.error('Feature callback error:', error);
              });
            }
          } catch (error) {
            console.error('Feature callback error:', error);
          }
        }
      } else {
        // User dismissed without purchasing - clear the pending callback
        pendingFeatureCallback.current = null;
      }
    },
    onSkip: (reason) => {
      // Paywall was skipped (user already subscribed) - clear callback
      // Note: If skipped, the feature should already be accessible via canDownload/canShare checks
      pendingFeatureCallback.current = null;
    },
    onError: (error) => {
      // Error occurred - clear the pending callback
      pendingFeatureCallback.current = null;
    },
  });

  // Check Supabase subscriptions table - THE SINGLE SOURCE OF TRUTH
  // This table is synced via Superwall webhooks and admin grants
  useEffect(() => {
    const checkSupabaseTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Read from subscriptions table (single source of truth)
          const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('tier, status, superwall_expires_at, admin_expires_at, source')
            .eq('user_id', user.id)
            .single();
          
          if (!error && subscription) {
            // Check if subscription is still valid (not expired)
            const now = new Date();
            const isExpired = 
              (subscription.superwall_expires_at && new Date(subscription.superwall_expires_at) < now) ||
              (subscription.admin_expires_at && new Date(subscription.admin_expires_at) < now);
            
            // Check if subscription is active
            const isActive = subscription.status === 'active' && !isExpired;
            
            if (isActive && subscription.tier !== 'free') {
              setSupabaseTier(subscription.tier as SubscriptionTier);
            } else {
              setSupabaseTier('free');
            }
          } else {
            // No subscription record found - default to free
            setSupabaseTier('free');
          }
        } else {
          setSupabaseTier('free');
        }
      } catch (error) {
        setSupabaseTier('free');
      } finally {
        setIsCheckingSupabase(false);
      }
    };

    checkSupabaseTier();

    // Re-check on auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setIsCheckingSupabase(true);
      checkSupabaseTier();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch entitlements when subscription is active
  useEffect(() => {
    const fetchEntitlements = async () => {
      if (subscriptionStatus?.status === 'ACTIVE') {
        try {
          const info = await getEntitlements();
          setEntitlementsInfo(info);
        } catch (error) {
          // Failed to fetch entitlements
        }
      } else {
        setEntitlementsInfo(null);
      }
    };

    fetchEntitlements();
  }, [subscriptionStatus?.status, getEntitlements]);

  // Get active entitlements from Superwall
  const activeEntitlements = subscriptionStatus?.status === 'ACTIVE'
    ? (subscriptionStatus as { status: 'ACTIVE'; entitlements: Entitlement[] }).entitlements || []
    : [];

  // Resolve final tier
  const { tier, source } = resolveTier(activeEntitlements, supabaseTier);

  // Calculate loading state
  // Use OR (||) so isLoading is true while EITHER source is still checking
  // This prevents showing "free" state while Supabase is still fetching complimentary tier
  const superwallLoading = subscriptionStatus?.status === 'UNKNOWN' || subscriptionStatus === undefined;
  const isLoading = superwallLoading || isCheckingSupabase;

  // ============================================
  // Feature-specific paywall triggers
  // Pass onFeatureGranted callback to execute after successful purchase (Gated paywalls)
  // ============================================
  
  /** Show Download paywall - onFeatureGranted executes after successful purchase */
  const requestDownload = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'pro_download',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // pro_download error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Share paywall - onFeatureGranted executes after successful purchase */
  const requestShare = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'pro_share',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // pro_share error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Remove Watermark paywall - onFeatureGranted executes after successful purchase */
  const requestRemoveWatermark = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'pro_watermark',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // pro_watermark error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Auto Quality paywall - onFeatureGranted executes after successful purchase */
  const requestAutoQuality = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'studio_auto_quality',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // studio_auto_quality error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show BG Remove paywall - onFeatureGranted executes after successful purchase */
  const requestBGRemove = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'studio_bg_remove',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // studio_bg_remove error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show BG Replace paywall - onFeatureGranted executes after successful purchase */
  const requestBGReplace = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'studio_bg_replace',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // studio_bg_replace error
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Membership paywall - onFeatureGranted executes after successful purchase */
  const requestMembership = useCallback(async (onFeatureGranted?: () => void | Promise<void>) => {
    try {
      // Store the callback to execute after successful purchase
      pendingFeatureCallback.current = onFeatureGranted || null;
      
      await hookRegisterPlacement({
        placement: 'membership_manage',
        params: { current_tier: tier },
      });
    } catch (error) {
      pendingFeatureCallback.current = null;
      // membership_manage error
    }
  }, [hookRegisterPlacement, tier]);

  // ============================================
  // Legacy helpers (for backwards compatibility)
  // ============================================
  
  /** @deprecated Use requestDownload, requestShare, or requestRemoveWatermark instead */
  const requestProAccess = useCallback(async (
    onGranted?: () => void,
    featureRequested?: string,
    previewImageUrl?: string
  ) => {
    try {
      await hookRegisterPlacement({
        placement: 'pro_download',
        params: {
          feature_requested: featureRequested || 'download',
          current_tier: tier,
        } as PlacementParams,
      });
    } catch (error) {
      // pro_download (legacy) error
    }
  }, [hookRegisterPlacement, tier]);

  /** @deprecated Use requestAutoQuality, requestBGRemove, or requestBGReplace instead */
  const requestStudioAccess = useCallback(async (
    onGranted?: () => void,
    featureRequested?: string,
    previewImageUrl?: string
  ) => {
    try {
      await hookRegisterPlacement({
        placement: 'studio_ai_generate',
        params: {
          feature_requested: featureRequested || 'ai_studio',
          current_tier: tier,
        } as PlacementParams,
      });
    } catch (error) {
      // studio_ai_generate (legacy) error
    }
  }, [hookRegisterPlacement, tier]);

  return {
    tier,
    isLoading,
    
    // Convenience booleans
    canDownload: tier !== 'free',
    canShare: tier !== 'free',
    canUseAIStudio: tier === 'studio',
    
    source,
    superwallUserId: superwallUser?.appUserId,
    currentPlan: subscriptionStatus?.status === 'ACTIVE' ? detectCurrentPlan(activeEntitlements) : undefined,
    entitlements: activeEntitlements,
    entitlementsInfo,
    
    // Feature-specific paywall triggers
    requestDownload,
    requestShare,
    requestRemoveWatermark,
    requestAutoQuality,
    requestBGRemove,
    requestBGReplace,
    requestMembership,
    
    // Legacy helpers
    requestProAccess,
    requestStudioAccess,
  };
}

// ============================================
// Legacy Compatibility
// ============================================

/**
 * @deprecated Use useTieredSubscription instead
 * This is kept for backwards compatibility during migration
 */
export function usePremiumStatus() {
  const tiered = useTieredSubscription();
  
  return {
    // Legacy interface
    isPremium: tiered.tier !== 'free',
    isLoading: tiered.isLoading,
    subscriptionStatus: { status: tiered.tier === 'free' ? 'INACTIVE' : 'ACTIVE' },
    subscriptionDetails: {
      status: tiered.tier === 'free' ? 'INACTIVE' : 'ACTIVE',
      entitlements: tiered.entitlements,
      source: tiered.source,
      superwallUserId: tiered.superwallUserId,
      currentPlan: tiered.currentPlan,
    },
    entitlementsInfo: tiered.entitlementsInfo,
    isComplimentaryPro: tiered.source === 'complimentary' && tiered.tier !== 'free',
    superwallUserId: tiered.superwallUserId,
    
    // New tiered interface (for gradual migration)
    ...tiered,
  };
}

/**
 * Hook to trigger a paywall for premium features
 * @deprecated Use useTieredSubscription().requestProAccess or requestStudioAccess instead
 */
export function usePremiumFeature() {
  const { requestProAccess, requestStudioAccess, tier } = useTieredSubscription();
  
  const requestPremiumAccess = useCallback(async (
    placement: string,
    onFeatureAccess?: () => void,
    params?: PlacementParams
  ) => {
    // Route to appropriate tier based on placement
    if (placement.includes('studio') || placement.includes('ai')) {
      await requestStudioAccess(onFeatureAccess, params?.feature_requested as string, params?.preview_image_url);
    } else {
      await requestProAccess(onFeatureAccess, params?.feature_requested as string, params?.preview_image_url);
    }
  }, [requestProAccess, requestStudioAccess]);

  return {
    requestPremiumAccess,
    paywallState: undefined, // No longer tracked at this level
  };
}

/**
 * Hook to restore purchases
 * 
 * NOTE: Superwall automatically syncs entitlements from StoreKit on app launch.
 * This hook provides a way for users to manually trigger a refresh.
 * 
 * The proper way to restore with Superwall:
 * 1. Show a paywall that has "Restore Purchases" link (all paywalls have this by default)
 * 2. Or use getEntitlements() to force refresh from Superwall servers
 * 
 * For users who want to manage their subscription, direct them to:
 * - The membership_manage placement (shows plans + restore link)
 * - Or directly to Apple's subscription management
 */
export function useRestorePurchases() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  
  const { getEntitlements } = useSuperwall();

  /**
   * Refreshes entitlements from Superwall servers.
   * This will pick up any purchases that may have been made on other devices
   * or weren't synced properly.
   */
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; error?: string; hasEntitlements?: boolean }> => {
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      // Force refresh entitlements from Superwall servers
      // This syncs with StoreKit and returns current entitlements
      const entitlementsInfo = await getEntitlements();
      
      // Check if user has any active entitlements
      const hasActiveEntitlements = entitlementsInfo?.active && entitlementsInfo.active.length > 0;
      
      setRestoreSuccess(true);
      return { 
        success: true, 
        hasEntitlements: hasActiveEntitlements 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      setRestoreError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsRestoring(false);
    }
  }, [getEntitlements]);

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

// Re-export types for convenience
export type { SubscriptionTier, SubscriptionTierSource };

export default usePremiumStatus;
