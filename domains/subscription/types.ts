/**
 * Subscription tiers
 */
export type SubscriptionTier = 'free' | 'pro' | 'studio';

/**
 * Feature access levels
 */
export interface FeatureAccess {
  canDownload: boolean;
  canShare: boolean;
  canUseAIStudio: boolean;
  canRemoveWatermark: boolean;
}

/**
 * Subscription context state
 */
export interface SubscriptionState {
  tier: SubscriptionTier;
  isLoading: boolean;
  featureAccess: FeatureAccess;
}

/**
 * Subscription context actions
 */
export interface SubscriptionActions {
  requestDownload: () => Promise<boolean>;
  requestShare: () => Promise<boolean>;
  requestRemoveWatermark: () => Promise<boolean>;
  requestProAccess: (feature?: string) => Promise<boolean>;
  requestStudioAccess: (feature?: string) => Promise<boolean>;
}

/**
 * Get feature access for a tier
 */
export function getFeatureAccess(tier: SubscriptionTier): FeatureAccess {
  switch (tier) {
    case 'studio':
      return {
        canDownload: true,
        canShare: true,
        canUseAIStudio: true,
        canRemoveWatermark: true,
      };
    case 'pro':
      return {
        canDownload: true,
        canShare: true,
        canUseAIStudio: false,
        canRemoveWatermark: true,
      };
    case 'free':
    default:
      return {
        canDownload: false,
        canShare: false,
        canUseAIStudio: false,
        canRemoveWatermark: false,
      };
  }
}
