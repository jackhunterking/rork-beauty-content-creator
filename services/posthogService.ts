/**
 * PostHog Analytics Service
 * 
 * Centralized service for PostHog analytics tracking including:
 * - Session replay
 * - Event capture
 * - User identification
 * - Feature flags
 * - Funnel tracking
 * 
 * PostHog is integrated with Superwall to provide unified analytics
 * for paywall events, subscription tracking, and user journeys.
 * 
 * @see https://posthog.com/docs/libraries/react-native
 */

import PostHog from 'posthog-react-native';
import { Platform } from 'react-native';

// ============================================
// PostHog Event Names
// Consistent naming convention for all tracked events
// ============================================
export const POSTHOG_EVENTS = {
  // App lifecycle events
  APP_OPENED: 'app_opened',
  APP_BACKGROUNDED: 'app_backgrounded',
  APP_INSTALLED: 'app_installed',
  
  // Authentication events
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  
  // Onboarding events
  ONBOARDING_STARTED: 'onboarding_started',
  ONBOARDING_SURVEY_COMPLETED: 'onboarding_survey_completed',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  
  // Superwall/Paywall events (forwarded from Superwall)
  PAYWALL_PRESENTED: 'paywall_presented',
  PAYWALL_DISMISSED: 'paywall_dismissed',
  PAYWALL_SKIPPED: 'paywall_skipped',
  PAYWALL_ERROR: 'paywall_error',
  PAYWALL_TRIGGERED: 'paywall_triggered', // When a paywall is triggered (pre-present)
  
  // Transaction events (forwarded from Superwall)
  TRANSACTION_START: 'transaction_start',
  TRANSACTION_COMPLETE: 'transaction_complete',
  TRANSACTION_FAIL: 'transaction_fail',
  TRANSACTION_RESTORE: 'transaction_restore',
  SUBSCRIPTION_START: 'subscription_start',
  TRIAL_START: 'trial_start',
  
  // Tier change events
  TIER_UPGRADED: 'tier_upgraded', // { from_tier, to_tier, source }
  TIER_DOWNGRADED: 'tier_downgraded', // { from_tier, to_tier }
  COMPLIMENTARY_TIER_GRANTED: 'complimentary_tier_granted', // { tier, user_id }
  COMPLIMENTARY_TIER_REVOKED: 'complimentary_tier_revoked', // { previous_tier, user_id }
  
  // Feature interest tracking
  DOWNLOAD_ATTEMPTED: 'download_attempted', // { platform, tier }
  AI_GENERATE_ATTEMPTED: 'ai_generate_attempted', // { feature, tier }
  
  // Content creation events
  TEMPLATE_SELECTED: 'template_selected',
  TEMPLATE_VIEWED: 'template_viewed',
  IMAGE_CAPTURED: 'image_captured',
  IMAGE_UPLOADED: 'image_uploaded',
  CONTENT_EDITED: 'content_edited',
  CONTENT_SAVED: 'content_saved',
  CONTENT_EXPORTED: 'content_exported',
  CONTENT_SHARED: 'content_shared',
  
  // Draft events
  DRAFT_CREATED: 'draft_created',
  DRAFT_OPENED: 'draft_opened',
  DRAFT_DELETED: 'draft_deleted',
  
  // Feature usage events
  FEATURE_USED: 'feature_used',
  PREMIUM_FEATURE_ATTEMPTED: 'premium_feature_attempted',
  WATERMARK_REMOVED: 'watermark_removed',
  
  // AI Enhancement events
  AI_ENHANCEMENT_STARTED: 'ai_enhancement_started',
  AI_ENHANCEMENT_COMPLETED: 'ai_enhancement_completed',
  AI_ENHANCEMENT_FAILED: 'ai_enhancement_failed',
  /** @deprecated Credits system replaced by tiered subscriptions */
  AI_CREDITS_DEPLETED: 'ai_credits_depleted',
  /** @deprecated Credits system replaced by tiered subscriptions */
  AI_CREDITS_REFRESHED: 'ai_credits_refreshed',
  AI_FEATURE_CONFIG_LOADED: 'ai_feature_config_loaded',
  AI_BACKGROUND_PRESET_SELECTED: 'ai_background_preset_selected',
  
  // Settings events
  SETTINGS_CHANGED: 'settings_changed',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  
  // Error events
  ERROR_OCCURRED: 'error_occurred',
} as const;

// ============================================
// User Property Keys
// ============================================
export const USER_PROPERTIES = {
  // Profile properties
  INDUSTRY: 'industry',
  GOAL: 'goal',
  SIGN_UP_METHOD: 'sign_up_method',
  
  // Subscription properties
  IS_PREMIUM: 'is_premium',
  SUBSCRIPTION_STATUS: 'subscription_status',
  SUBSCRIPTION_SOURCE: 'subscription_source', // 'superwall' | 'complimentary'
  CURRENT_PLAN: 'current_plan',
  SUBSCRIPTION_TIER: 'subscription_tier', // 'free' | 'pro' | 'studio'
  
  // Paywall analytics
  MOST_REQUESTED_FEATURE: 'most_requested_feature', // Track what users want most
  PAYWALL_VIEWS_COUNT: 'paywall_views_count',
  LAST_PAYWALL_PLACEMENT: 'last_paywall_placement',
  
  // App properties
  APP_VERSION: 'app_version',
  BUILD_NUMBER: 'build_number',
  PLATFORM: 'platform',
  
  // Engagement properties
  TOTAL_PROJECTS_CREATED: 'total_projects_created',
  TOTAL_EXPORTS: 'total_exports',
  
  // AI properties
  /** @deprecated Credits system replaced by tiered subscriptions */
  AI_CREDITS_REMAINING: 'ai_credits_remaining',
  AI_TOTAL_GENERATIONS: 'ai_total_generations',
  AI_FAVORITE_FEATURE: 'ai_favorite_feature',
  AI_LAST_GENERATION_DATE: 'ai_last_generation_date',
} as const;

// ============================================
// PostHog Client Instance
// IMPORTANT: The PostHogProvider in _layout.tsx is the PRIMARY
// source of the PostHog instance. This service acts as a bridge
// to allow non-React code to access PostHog functions.
// ============================================
let posthogClient: PostHog | null = null;
let isInitialized = false;

/**
 * Set the PostHog client instance from the PostHogProvider
 * This should be called from a component that has access to usePostHog()
 * 
 * IMPORTANT: Session replay is handled by PostHogProvider, not this service.
 * The provider creates the instance with the correct session replay config.
 */
export function setPostHogClient(client: PostHog | null): void {
  if (client) {
    posthogClient = client;
    isInitialized = true;
    
    // Register super properties that persist across all events
    posthogClient.register({
      platform: Platform.OS,
      platform_version: Platform.Version,
    });
  }
}

/**
 * Initialize PostHog analytics
 * @deprecated Use PostHogProvider and setPostHogClient instead for proper session replay support
 */
export async function initializePostHog(
  apiKey: string,
  host: string = 'https://us.i.posthog.com'
): Promise<PostHog | null> {
  // If already set from provider, use that instance
  if (isInitialized && posthogClient) {
    return posthogClient;
  }
  
  // Fallback initialization (without session replay working properly)
  if (!apiKey) {
    return null;
  }

  try {
    posthogClient = new PostHog(apiKey, {
      host,
      debug: __DEV__,
    });
    isInitialized = true;
    return posthogClient;
  } catch (error) {
    return null;
  }
}

/**
 * Get the PostHog client instance
 * Returns null if not initialized
 */
export function getPostHog(): PostHog | null {
  return posthogClient;
}

/**
 * Check if PostHog is initialized
 */
export function isPostHogInitialized(): boolean {
  return isInitialized && posthogClient !== null;
}

// ============================================
// Event Capture Functions
// ============================================

/**
 * Capture a custom event
 */
export function captureEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.capture(eventName, properties);
  } catch (error) {
    // Silent failure
  }
}

/**
 * Capture a screen view event
 */
export function captureScreen(
  screenName: string,
  properties?: Record<string, any>
): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.screen(screenName, properties);
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// User Identity Functions
// ============================================

/**
 * Identify a user with their unique ID and properties
 * Call this after user authentication
 */
export function identifyUser(
  userId: string,
  userProperties?: Record<string, any>
): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.identify(userId, userProperties);
  } catch (error) {
    // Silent failure
  }
}

/**
 * Update user properties without changing identity
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!posthogClient) {
    return;
  }

  try {
    // Use capture with $set to update properties
    posthogClient.capture('$set', {
      $set: properties,
    });
  } catch (error) {
    // Silent failure
  }
}

/**
 * Set properties that should only be set once (first time only)
 */
export function setUserPropertiesOnce(properties: Record<string, any>): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.capture('$set', {
      $set_once: properties,
    });
  } catch (error) {
    // Silent failure
  }
}

/**
 * Reset user identity (call on logout)
 * This creates a new anonymous ID
 */
export function resetUser(): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.reset();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Create an alias for the current user
 * Useful for linking anonymous sessions to authenticated users
 */
export function aliasUser(alias: string): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.alias(alias);
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// Super Properties (Persistent Properties)
// ============================================

/**
 * Register super properties that will be sent with every event
 */
export function registerSuperProperties(properties: Record<string, any>): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.register(properties);
  } catch (error) {
    // Silent failure
  }
}

/**
 * Unregister a super property
 */
export function unregisterSuperProperty(propertyName: string): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.unregister(propertyName);
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// Feature Flags
// ============================================

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  if (!posthogClient) {
    return false;
  }

  try {
    const enabled = await posthogClient.isFeatureEnabled(flagKey);
    return enabled ?? false;
  } catch (error) {
    return false;
  }
}

/**
 * Get feature flag value (for multivariate flags)
 */
export async function getFeatureFlagValue(
  flagKey: string
): Promise<string | boolean | undefined> {
  if (!posthogClient) {
    return undefined;
  }

  try {
    return await posthogClient.getFeatureFlag(flagKey);
  } catch (error) {
    return undefined;
  }
}

/**
 * Get feature flag payload (additional data)
 */
export async function getFeatureFlagPayload(
  flagKey: string
): Promise<any> {
  if (!posthogClient) {
    return undefined;
  }

  try {
    return await posthogClient.getFeatureFlagPayload(flagKey);
  } catch (error) {
    return undefined;
  }
}

/**
 * Reload feature flags (call after user properties change)
 */
export function reloadFeatureFlags(): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.reloadFeatureFlags();
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// Session Replay Control
// ============================================

/**
 * Start session recording (if not already recording)
 */
export function startSessionRecording(): void {
  if (!posthogClient) {
    return;
  }

  // Session replay is controlled by the enableSessionReplay config
  // This is here for future manual control if needed
}

// ============================================
// Superwall Event Forwarding
// ============================================

/**
 * Forward a Superwall event to PostHog
 * Maps Superwall event names to PostHog event names
 */
export function forwardSuperwallEvent(
  eventName: string,
  params?: Record<string, any>
): void {
  const mappedEvent = mapSuperwallEventName(eventName);
  captureEvent(mappedEvent, {
    source: 'superwall',
    original_event: eventName,
    ...params,
  });
}

/**
 * Map Superwall event names to PostHog event names
 */
function mapSuperwallEventName(superwallEvent: string): string {
  const eventMap: Record<string, string> = {
    'paywallPresent': POSTHOG_EVENTS.PAYWALL_PRESENTED,
    'paywall_present': POSTHOG_EVENTS.PAYWALL_PRESENTED,
    'paywallOpen': POSTHOG_EVENTS.PAYWALL_PRESENTED,
    'paywall_open': POSTHOG_EVENTS.PAYWALL_PRESENTED,
    
    'paywallDismiss': POSTHOG_EVENTS.PAYWALL_DISMISSED,
    'paywall_dismiss': POSTHOG_EVENTS.PAYWALL_DISMISSED,
    'paywallClose': POSTHOG_EVENTS.PAYWALL_DISMISSED,
    'paywall_close': POSTHOG_EVENTS.PAYWALL_DISMISSED,
    
    'paywallSkip': POSTHOG_EVENTS.PAYWALL_SKIPPED,
    'paywall_skip': POSTHOG_EVENTS.PAYWALL_SKIPPED,
    
    'paywallError': POSTHOG_EVENTS.PAYWALL_ERROR,
    'paywall_error': POSTHOG_EVENTS.PAYWALL_ERROR,
    
    'transactionStart': POSTHOG_EVENTS.TRANSACTION_START,
    'transaction_start': POSTHOG_EVENTS.TRANSACTION_START,
    
    'transactionComplete': POSTHOG_EVENTS.TRANSACTION_COMPLETE,
    'transaction_complete': POSTHOG_EVENTS.TRANSACTION_COMPLETE,
    
    'transactionFail': POSTHOG_EVENTS.TRANSACTION_FAIL,
    'transaction_fail': POSTHOG_EVENTS.TRANSACTION_FAIL,
    
    'transactionRestore': POSTHOG_EVENTS.TRANSACTION_RESTORE,
    'transaction_restore': POSTHOG_EVENTS.TRANSACTION_RESTORE,
    
    'subscriptionStart': POSTHOG_EVENTS.SUBSCRIPTION_START,
    'subscription_start': POSTHOG_EVENTS.SUBSCRIPTION_START,
    
    'freeTrialStart': POSTHOG_EVENTS.TRIAL_START,
    'free_trial_start': POSTHOG_EVENTS.TRIAL_START,
    'trialStart': POSTHOG_EVENTS.TRIAL_START,
    'trial_start': POSTHOG_EVENTS.TRIAL_START,
  };

  return eventMap[superwallEvent] || `superwall_${superwallEvent}`;
}

// ============================================
// Flush and Shutdown
// ============================================

/**
 * Flush all pending events immediately
 */
export function flushEvents(): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.flush();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Shutdown PostHog (call on app terminate)
 */
export async function shutdownPostHog(): Promise<void> {
  if (!posthogClient) {
    return;
  }

  try {
    await posthogClient.shutdown();
    posthogClient = null;
    isInitialized = false;
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// AI Enhancement Tracking
// ============================================

/**
 * Track when an AI enhancement is started
 */
export function trackAIEnhancementStarted(
  featureKey: string,
  properties?: {
    slotId?: string;
    draftId?: string;
    presetId?: string;
    creditsRequired?: number;
  }
): void {
  captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_STARTED, {
    feature_key: featureKey,
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track when an AI enhancement completes successfully
 */
export function trackAIEnhancementCompleted(
  featureKey: string,
  properties?: {
    generationId?: string;
    slotId?: string;
    draftId?: string;
    creditsCharged?: number;
    processingTimeMs?: number;
    creditsRemaining?: number;
  }
): void {
  captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_COMPLETED, {
    feature_key: featureKey,
    ...properties,
    timestamp: new Date().toISOString(),
  });
  
  // Update user properties
  if (properties?.creditsRemaining !== undefined) {
    setUserProperties({
      [USER_PROPERTIES.AI_CREDITS_REMAINING]: properties.creditsRemaining,
      [USER_PROPERTIES.AI_LAST_GENERATION_DATE]: new Date().toISOString(),
    });
  }
}

/**
 * Track when an AI enhancement fails
 */
export function trackAIEnhancementFailed(
  featureKey: string,
  errorMessage: string,
  properties?: {
    generationId?: string;
    slotId?: string;
    draftId?: string;
    errorCode?: string;
  }
): void {
  captureEvent(POSTHOG_EVENTS.AI_ENHANCEMENT_FAILED, {
    feature_key: featureKey,
    error_message: errorMessage,
    ...properties,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track when user runs out of AI credits
 */
export function trackAICreditsDepleted(
  featureKey: string,
  creditsRequired: number
): void {
  captureEvent(POSTHOG_EVENTS.AI_CREDITS_DEPLETED, {
    feature_key: featureKey,
    credits_required: creditsRequired,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track when AI credits are refreshed
 */
export function trackAICreditsRefreshed(
  creditsRemaining: number,
  monthlyAllocation: number
): void {
  captureEvent(POSTHOG_EVENTS.AI_CREDITS_REFRESHED, {
    credits_remaining: creditsRemaining,
    monthly_allocation: monthlyAllocation,
    timestamp: new Date().toISOString(),
  });
  
  setUserProperties({
    [USER_PROPERTIES.AI_CREDITS_REMAINING]: creditsRemaining,
  });
}

/**
 * Track background preset selection
 */
export function trackBackgroundPresetSelected(
  presetId: string,
  presetName: string,
  category: string,
  isPremium: boolean
): void {
  captureEvent(POSTHOG_EVENTS.AI_BACKGROUND_PRESET_SELECTED, {
    preset_id: presetId,
    preset_name: presetName,
    category,
    is_premium: isPremium,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Subscription Tier Tracking
// ============================================

/**
 * Track when a paywall is triggered (before it's presented)
 */
export function trackPaywallTriggered(
  placement: string,
  featureRequested: string,
  currentTier: string
): void {
  captureEvent(POSTHOG_EVENTS.PAYWALL_TRIGGERED, {
    placement,
    feature_requested: featureRequested,
    current_tier: currentTier,
    timestamp: new Date().toISOString(),
  });
  
  // Update user properties for funnel analysis
  setUserProperties({
    [USER_PROPERTIES.LAST_PAYWALL_PLACEMENT]: placement,
    [USER_PROPERTIES.MOST_REQUESTED_FEATURE]: featureRequested,
  });
}

/**
 * Track tier upgrade
 */
export function trackTierUpgraded(
  fromTier: string,
  toTier: string,
  source: 'superwall' | 'complimentary'
): void {
  captureEvent(POSTHOG_EVENTS.TIER_UPGRADED, {
    from_tier: fromTier,
    to_tier: toTier,
    source,
    timestamp: new Date().toISOString(),
  });
  
  setUserProperties({
    [USER_PROPERTIES.SUBSCRIPTION_TIER]: toTier,
    [USER_PROPERTIES.SUBSCRIPTION_SOURCE]: source,
  });
}

/**
 * Track tier downgrade
 */
export function trackTierDowngraded(
  fromTier: string,
  toTier: string
): void {
  captureEvent(POSTHOG_EVENTS.TIER_DOWNGRADED, {
    from_tier: fromTier,
    to_tier: toTier,
    timestamp: new Date().toISOString(),
  });
  
  setUserProperties({
    [USER_PROPERTIES.SUBSCRIPTION_TIER]: toTier,
  });
}

/**
 * Track download attempt (for feature interest analysis)
 */
export function trackDownloadAttempted(
  platform: string,
  currentTier: string
): void {
  captureEvent(POSTHOG_EVENTS.DOWNLOAD_ATTEMPTED, {
    platform,
    current_tier: currentTier,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Track AI generate attempt (for feature interest analysis)
 */
export function trackAIGenerateAttempted(
  feature: string,
  currentTier: string
): void {
  captureEvent(POSTHOG_EVENTS.AI_GENERATE_ATTEMPTED, {
    feature,
    current_tier: currentTier,
    timestamp: new Date().toISOString(),
  });
}

// ============================================
// Opt-out Control
// ============================================

/**
 * Opt out of all tracking (GDPR compliance)
 */
export function optOut(): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.optOut();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Opt back in to tracking
 */
export function optIn(): void {
  if (!posthogClient) {
    return;
  }

  try {
    posthogClient.optIn();
  } catch (error) {
    // Silent failure
  }
}

// ============================================
// Export default service object
// ============================================
export default {
  // Initialization
  initializePostHog,
  getPostHog,
  isPostHogInitialized,
  
  // Event capture
  captureEvent,
  captureScreen,
  
  // User identity
  identifyUser,
  setUserProperties,
  setUserPropertiesOnce,
  resetUser,
  aliasUser,
  
  // Super properties
  registerSuperProperties,
  unregisterSuperProperty,
  
  // Feature flags
  isFeatureEnabled,
  getFeatureFlagValue,
  getFeatureFlagPayload,
  reloadFeatureFlags,
  
  // Session replay
  startSessionRecording,
  
  // Superwall integration
  forwardSuperwallEvent,
  
  // AI Enhancement tracking
  trackAIEnhancementStarted,
  trackAIEnhancementCompleted,
  trackAIEnhancementFailed,
  trackAICreditsDepleted,
  trackAICreditsRefreshed,
  trackBackgroundPresetSelected,
  
  // Tier tracking
  trackPaywallTriggered,
  trackTierUpgraded,
  trackTierDowngraded,
  trackDownloadAttempted,
  trackAIGenerateAttempted,
  
  // Lifecycle
  flushEvents,
  shutdownPostHog,
  
  // Privacy
  optOut,
  optIn,
  
  // Constants
  POSTHOG_EVENTS,
  USER_PROPERTIES,
};
