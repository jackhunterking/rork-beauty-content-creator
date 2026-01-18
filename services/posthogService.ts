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
  
  // Transaction events (forwarded from Superwall)
  TRANSACTION_START: 'transaction_start',
  TRANSACTION_COMPLETE: 'transaction_complete',
  TRANSACTION_FAIL: 'transaction_fail',
  TRANSACTION_RESTORE: 'transaction_restore',
  SUBSCRIPTION_START: 'subscription_start',
  TRIAL_START: 'trial_start',
  
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
  
  // App properties
  APP_VERSION: 'app_version',
  BUILD_NUMBER: 'build_number',
  PLATFORM: 'platform',
  
  // Engagement properties
  TOTAL_PROJECTS_CREATED: 'total_projects_created',
  TOTAL_EXPORTS: 'total_exports',
} as const;

// ============================================
// PostHog Client Instance
// ============================================
let posthogClient: PostHog | null = null;
let isInitialized = false;

/**
 * Initialize PostHog analytics
 * Must be called early in app lifecycle, before other analytics
 */
export async function initializePostHog(
  apiKey: string,
  host: string = 'https://us.i.posthog.com'
): Promise<PostHog | null> {
  // #region agent log - Hypothesis A: Check if already initialized
  fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'posthogService.ts:initializePostHog:entry',message:'PostHog init called',data:{apiKeyProvided:!!apiKey,apiKeyPrefix:apiKey?.substring(0,10),host,isAlreadyInitialized:isInitialized,hasClient:!!posthogClient},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (isInitialized && posthogClient) {
    console.log('[PostHog] Already initialized');
    return posthogClient;
  }

  if (!apiKey) {
    // #region agent log - Hypothesis A: No API key
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'posthogService.ts:initializePostHog:noApiKey',message:'PostHog NO API KEY',data:{apiKey},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.warn('[PostHog] No API key provided, analytics disabled');
    return null;
  }

  try {
    // #region agent log - Hypothesis B: Creating PostHog instance
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'posthogService.ts:initializePostHog:creating',message:'Creating PostHog instance',data:{host,enableSessionReplay:true},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    posthogClient = new PostHog(apiKey, {
      host,
      // Enable session replay for mobile
      enableSessionReplay: true,
      // Automatically capture app lifecycle events
      captureApplicationLifecycleEvents: true,
      // Automatically capture screen views
      captureDeepLinks: true,
      // Flush events every 30 seconds
      flushInterval: 30,
      // Queue up to 1000 events before forcing flush
      flushAt: 20,
      // Session replay configuration
      sessionReplayConfig: {
        // Mask all text inputs for privacy
        maskAllTextInputs: true,
        // Mask images to protect user content
        maskAllImages: false, // We want to see the templates/content UI
        // Capture network requests for debugging
        captureNetworkTelemetry: true,
        // Android-specific: use screenshot mode for better quality
        androidDebouncerDelayMs: 500,
        // iOS-specific: screenshot mode for better quality
        iOSdebouncerDelayMs: 500,
      },
      // Enable debug logging in development
      debug: __DEV__,
    });

    // Register super properties that persist across all events
    posthogClient.register({
      platform: Platform.OS,
      platform_version: Platform.Version,
    });

    isInitialized = true;
    console.log('[PostHog] Initialized successfully');
    
    // #region agent log - Hypothesis B: PostHog client created successfully
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'posthogService.ts:initializePostHog:success',message:'PostHog initialized successfully',data:{isInitialized:true,hasClient:!!posthogClient,platform:Platform.OS,platformVersion:Platform.Version},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    return posthogClient;
  } catch (error) {
    // #region agent log - Hypothesis B: PostHog initialization failed
    fetch('http://127.0.0.1:7246/ingest/96b6634d-47b8-4197-a801-c2723e77a437',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'posthogService.ts:initializePostHog:error',message:'PostHog initialization FAILED',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.error('[PostHog] Failed to initialize:', error);
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
    console.warn('[PostHog] Not initialized, skipping event:', eventName);
    return;
  }

  try {
    posthogClient.capture(eventName, properties);
    console.log('[PostHog] Event captured:', eventName, properties);
  } catch (error) {
    console.error('[PostHog] Failed to capture event:', eventName, error);
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
    console.log('[PostHog] Screen captured:', screenName);
  } catch (error) {
    console.error('[PostHog] Failed to capture screen:', screenName, error);
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
    console.warn('[PostHog] Not initialized, skipping identify');
    return;
  }

  try {
    posthogClient.identify(userId, userProperties);
    console.log('[PostHog] User identified:', userId);
  } catch (error) {
    console.error('[PostHog] Failed to identify user:', error);
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
    console.log('[PostHog] User properties updated:', properties);
  } catch (error) {
    console.error('[PostHog] Failed to set user properties:', error);
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
    console.log('[PostHog] User properties set once:', properties);
  } catch (error) {
    console.error('[PostHog] Failed to set user properties once:', error);
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
    console.log('[PostHog] User reset (logged out)');
  } catch (error) {
    console.error('[PostHog] Failed to reset user:', error);
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
    console.log('[PostHog] User aliased:', alias);
  } catch (error) {
    console.error('[PostHog] Failed to alias user:', error);
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
    console.log('[PostHog] Super properties registered:', properties);
  } catch (error) {
    console.error('[PostHog] Failed to register super properties:', error);
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
    console.log('[PostHog] Super property unregistered:', propertyName);
  } catch (error) {
    console.error('[PostHog] Failed to unregister super property:', error);
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
    console.error('[PostHog] Failed to check feature flag:', flagKey, error);
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
    console.error('[PostHog] Failed to get feature flag:', flagKey, error);
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
    console.error('[PostHog] Failed to get feature flag payload:', flagKey, error);
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
    console.log('[PostHog] Feature flags reloaded');
  } catch (error) {
    console.error('[PostHog] Failed to reload feature flags:', error);
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

  try {
    // Session replay is controlled by the enableSessionReplay config
    // This is here for future manual control if needed
    console.log('[PostHog] Session recording controlled by config');
  } catch (error) {
    console.error('[PostHog] Failed to start session recording:', error);
  }
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
    console.log('[PostHog] Events flushed');
  } catch (error) {
    console.error('[PostHog] Failed to flush events:', error);
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
    console.log('[PostHog] Shutdown complete');
  } catch (error) {
    console.error('[PostHog] Failed to shutdown:', error);
  }
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
    console.log('[PostHog] User opted out of tracking');
  } catch (error) {
    console.error('[PostHog] Failed to opt out:', error);
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
    console.log('[PostHog] User opted in to tracking');
  } catch (error) {
    console.error('[PostHog] Failed to opt in:', error);
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
