import createContextHook from '@nkzw/create-context-hook';
import { useTieredSubscription } from '@/hooks/usePremiumStatus';

/**
 * Subscription context provides access to subscription state and paywall actions.
 * This is a thin wrapper around useTieredSubscription hook to make it available
 * via context for components that don't have direct access to hooks.
 */
export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const subscription = useTieredSubscription();
  
  return {
    // State
    tier: subscription.tier,
    isLoading: subscription.isLoading,
    
    // Feature checks
    canDownload: subscription.canDownload,
    canShare: subscription.canShare,
    canUseAIStudio: subscription.canUseAIStudio,
    isPremium: subscription.tier !== 'free',
    
    // Paywall actions
    requestDownload: subscription.requestDownload,
    requestShare: subscription.requestShare,
    requestRemoveWatermark: subscription.requestRemoveWatermark,
    requestProAccess: subscription.requestProAccess,
    requestStudioAccess: subscription.requestStudioAccess,
  };
});
