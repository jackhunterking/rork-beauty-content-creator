import { useState, useEffect, useCallback } from 'react';
import { useUser, usePlacement, useSuperwall } from 'expo-superwall';
import { supabase } from '@/lib/supabase';
import type { Entitlement, EntitlementsInfo } from 'expo-superwall';
import { 
  trackSubscribe, 
  trackInitiatedCheckout 
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
  // ============================================
  
  /** Show Download paywall (pro_download placement) */
  requestDownload: () => Promise<void>;
  
  /** Show Share paywall (pro_share placement) */
  requestShare: () => Promise<void>;
  
  /** Show Remove Watermark paywall (pro_watermark placement) */
  requestRemoveWatermark: () => Promise<void>;
  
  /** Show Auto Quality paywall (studio_auto_quality placement) */
  requestAutoQuality: () => Promise<void>;
  
  /** Show BG Remove paywall (studio_bg_remove placement) */
  requestBGRemove: () => Promise<void>;
  
  /** Show BG Replace paywall (studio_bg_replace placement) */
  requestBGReplace: () => Promise<void>;
  
  /** Show Membership paywall (membership_manage placement) */
  requestMembership: () => Promise<void>;
  
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
  
  // Paywall placement hook - used for callbacks only
  const { registerPlacement: hookRegisterPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('[Subscription] Paywall presented:', info.name);
      trackInitiatedCheckout(info.name);
    },
    onDismiss: (info, result) => {
      console.log('[Subscription] Paywall dismissed:', result);
      if (result.type === 'purchased') {
        trackSubscribe(info.name || 'subscription', 0, 'USD');
      }
    },
    onSkip: (reason) => console.log('[Subscription] Paywall skipped:', reason),
    onError: (error) => console.error('[Subscription] Paywall error:', error),
  });

  // Check Supabase for complimentary tier
  useEffect(() => {
    const checkSupabaseTier = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();
          
          if (!error && profile?.subscription_tier) {
            setSupabaseTier(profile.subscription_tier as SubscriptionTier);
          } else {
            setSupabaseTier('free');
          }
        } else {
          setSupabaseTier('free');
        }
      } catch (error) {
        console.error('[Subscription] Failed to check Supabase tier:', error);
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
          console.log('[Subscription] Fetched entitlements:', info);
        } catch (error) {
          console.error('[Subscription] Failed to fetch entitlements:', error);
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
  const superwallLoading = subscriptionStatus?.status === 'UNKNOWN' || subscriptionStatus === undefined;
  const isLoading = superwallLoading && isCheckingSupabase;

  // ============================================
  // Feature-specific paywall triggers
  // ============================================
  
  /** Show Download paywall */
  const requestDownload = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'pro_download',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] pro_download error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Share paywall */
  const requestShare = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'pro_share',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] pro_share error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Remove Watermark paywall */
  const requestRemoveWatermark = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'pro_watermark',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] pro_watermark error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Auto Quality paywall */
  const requestAutoQuality = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'studio_auto_quality',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] studio_auto_quality error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show BG Remove paywall */
  const requestBGRemove = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'studio_bg_remove',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] studio_bg_remove error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show BG Replace paywall */
  const requestBGReplace = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'studio_bg_replace',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] studio_bg_replace error:', error);
    }
  }, [hookRegisterPlacement, tier]);
  
  /** Show Membership paywall - using usePlacement as per Superwall docs */
  const requestMembership = useCallback(async () => {
    try {
      await hookRegisterPlacement({
        placement: 'membership_manage',
        params: { current_tier: tier },
      });
    } catch (error) {
      console.error('[Subscription] membership_manage error:', error);
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
      console.error('[Subscription] pro_download (legacy) error:', error);
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
      console.error('[Subscription] studio_ai_generate (legacy) error:', error);
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
 */
export function useRestorePurchases() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  
  const { registerPlacement } = usePlacement({
    onSkip: (reason) => {
      console.log('[Restore] Skipped (user may already be subscribed):', reason);
      setRestoreSuccess(true);
    },
    onDismiss: (info, result) => {
      console.log('[Restore] Dismissed:', result);
      if (result.type === 'restored' || result.type === 'purchased') {
        setRestoreSuccess(true);
      }
    },
    onError: (error) => {
      console.error('[Restore] Error:', error);
      setRestoreError(error);
    },
  });

  const restorePurchases = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(false);

    try {
      await registerPlacement({
        placement: 'restore_purchases',
        feature: () => {
          console.log('[Restore] Subscription verified');
          setRestoreSuccess(true);
        },
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      setRestoreError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsRestoring(false);
    }
  }, [registerPlacement]);

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
