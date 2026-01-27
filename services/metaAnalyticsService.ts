/**
 * Meta Analytics Service
 * 
 * Tracks key events for Meta (Facebook) Ads attribution.
 * Uses react-native-fbsdk-next to send events to Facebook.
 * 
 * IMPORTANT: Event names and parameters follow Facebook's official naming conventions
 * to ensure proper recognition as standard events (not custom events).
 * 
 * Standard Events Used:
 * - fb_mobile_complete_registration - User completes signup
 * - fb_mobile_purchase - User makes a purchase (via logPurchase)
 * - fb_mobile_subscribe - User starts subscription
 * - fb_mobile_start_trial - User starts free trial
 * - fb_mobile_content_view - User views content (optional)
 * 
 * @see https://developers.facebook.com/docs/app-events/reference
 * @see https://developers.facebook.com/docs/marketing-api/app-event-api/
 */

import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';

// ============================================
// Facebook Standard Event Names
// These MUST match exactly for Facebook to recognize them as standard events
// ============================================
const FB_EVENTS = {
  // Core standard events
  COMPLETE_REGISTRATION: 'fb_mobile_complete_registration',
  PURCHASE: 'fb_mobile_purchase', // Note: Use logPurchase() method instead
  SUBSCRIBE: 'fb_mobile_subscribe',
  START_TRIAL: 'fb_mobile_start_trial',
  CONTENT_VIEW: 'fb_mobile_content_view',
  ADD_TO_CART: 'fb_mobile_add_to_cart',
  INITIATED_CHECKOUT: 'fb_mobile_initiated_checkout',
  ADD_PAYMENT_INFO: 'fb_mobile_add_payment_info',
} as const;

// ============================================
// Facebook Standard Parameter Names
// These MUST use the exact fb_ prefix naming convention
// ============================================
const FB_PARAMS = {
  // Common parameters
  CONTENT_ID: 'fb_content_id',
  CONTENT_TYPE: 'fb_content_type',
  CURRENCY: 'fb_currency',
  REGISTRATION_METHOD: 'fb_registration_method',
  SEARCH_STRING: 'fb_search_string',
  SUCCESS: 'fb_success',
  DESCRIPTION: 'fb_description',
  // Special parameter for revenue value
  VALUE_TO_SUM: '_valueToSum',
} as const;

/**
 * Initialize Facebook SDK with ATT-aware configuration
 * 
 * IMPORTANT: This must be called AFTER requesting ATT permission to ensure
 * the SDK is properly configured based on user's tracking choice.
 * 
 * Call this early in app lifecycle (e.g., in _layout.tsx) but AFTER ATT prompt.
 * 
 * @param isTrackingAuthorized - Whether user authorized tracking via ATT (iOS 14.5+)
 */
export async function initializeFacebookSDK(isTrackingAuthorized: boolean = false): Promise<void> {
  try {
    // Initialize the SDK - this must be called first
    await Settings.initializeSDK();
    
    // Enable automatic logging of app events (includes app open/install)
    // This is allowed regardless of ATT status - it's for aggregate analytics
    await Settings.setAutoLogAppEventsEnabled(true);
    
    // Configure advertiser tracking based on ATT authorization status
    // This is the critical setting that respects user's ATT choice
    await Settings.setAdvertiserTrackingEnabled(isTrackingAuthorized);
    
    // Only enable advertiser ID (IDFA) collection if user authorized tracking
    // This ensures we comply with Apple's ATT requirements
    await Settings.setAdvertiserIDCollectionEnabled(isTrackingAuthorized);
    
    // Flush any pending events
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure - analytics should not crash the app
  }
}

/**
 * Update advertiser tracking status after ATT permission changes
 * 
 * Call this if user changes their tracking preference in Settings
 * or if you need to update the SDK's tracking status dynamically.
 * 
 * @param isTrackingAuthorized - Whether tracking is now authorized
 */
export async function updateTrackingStatus(isTrackingAuthorized: boolean): Promise<void> {
  try {
    await Settings.setAdvertiserTrackingEnabled(isTrackingAuthorized);
    await Settings.setAdvertiserIDCollectionEnabled(isTrackingAuthorized);
  } catch (error) {
    // Silent failure
  }
}

/**
 * Track user registration/sign-up completion
 * 
 * Standard Event: fb_mobile_complete_registration
 * 
 * @param method - The registration method used (apple, google, email)
 */
export function trackCompleteRegistration(
  method: 'apple' | 'google' | 'email'
): void {
  try {
    AppEventsLogger.logEvent(FB_EVENTS.COMPLETE_REGISTRATION, {
      [FB_PARAMS.REGISTRATION_METHOD]: method,
    });
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

// Legacy alias for backwards compatibility
export const trackRegistrationComplete = trackCompleteRegistration;

/**
 * Track subscription purchase
 * 
 * Standard Event: fb_mobile_purchase (via logPurchase method)
 * 
 * This uses the native logPurchase method which Facebook recommends
 * for all revenue-generating events as it properly handles currency
 * and value for optimization and ROAS tracking.
 * 
 * @param price - The subscription price
 * @param currency - Currency code (default: USD)
 * @param productId - Optional product identifier
 */
export function trackPurchase(
  price: number,
  currency: string = 'USD',
  productId?: string
): void {
  try {
    const params: Record<string, string> = {
      [FB_PARAMS.CONTENT_TYPE]: 'subscription',
    };
    
    if (productId) {
      params[FB_PARAMS.CONTENT_ID] = productId;
    }
    
    // logPurchase automatically creates fb_mobile_purchase event
    // with proper value and currency handling
    AppEventsLogger.logPurchase(price, currency, params);
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Track subscription start (paid subscription)
 * 
 * Standard Event: fb_mobile_subscribe
 * 
 * Use this when user starts a paid subscription through Superwall/StoreKit.
 * This event is optimized for subscription-based app attribution.
 * 
 * @param productId - The product identifier (e.g., 'com.app.monthly')
 * @param price - The subscription price
 * @param currency - Currency code (default: USD)
 */
export function trackSubscribe(
  productId: string,
  price: number,
  currency: string = 'USD'
): void {
  try {
    // Log Subscribe event for attribution
    AppEventsLogger.logEvent(FB_EVENTS.SUBSCRIBE, {
      [FB_PARAMS.CONTENT_ID]: productId,
      [FB_PARAMS.CONTENT_TYPE]: 'subscription',
      [FB_PARAMS.VALUE_TO_SUM]: price,
      [FB_PARAMS.CURRENCY]: currency,
    });
    
    // Also log as purchase for revenue tracking and ROAS optimization
    AppEventsLogger.logPurchase(price, currency, {
      [FB_PARAMS.CONTENT_ID]: productId,
      [FB_PARAMS.CONTENT_TYPE]: 'subscription',
    });
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

// Legacy alias for backwards compatibility
export const trackSubscriptionStart = trackSubscribe;

/**
 * Track trial started
 * 
 * Standard Event: fb_mobile_start_trial
 * 
 * @param productId - The product identifier
 */
export function trackStartTrial(productId?: string): void {
  try {
    AppEventsLogger.logEvent(FB_EVENTS.START_TRIAL, {
      [FB_PARAMS.CONTENT_ID]: productId || 'pro_trial',
      [FB_PARAMS.CONTENT_TYPE]: 'subscription',
    });
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

// Legacy alias for backwards compatibility
export const trackTrialStarted = trackStartTrial;

/**
 * Track content view
 * 
 * Standard Event: fb_mobile_content_view
 * 
 * Use this when user views significant content (e.g., template, portfolio item)
 * 
 * @param contentId - The content identifier
 * @param contentType - Type of content (e.g., 'template', 'portfolio')
 */
export function trackContentView(
  contentId: string,
  contentType: string = 'template'
): void {
  try {
    AppEventsLogger.logEvent(FB_EVENTS.CONTENT_VIEW, {
      [FB_PARAMS.CONTENT_ID]: contentId,
      [FB_PARAMS.CONTENT_TYPE]: contentType,
    });
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Track initiated checkout
 * 
 * Standard Event: fb_mobile_initiated_checkout
 * 
 * Use this when user starts the subscription flow (views paywall)
 * 
 * @param productId - The product identifier
 * @param price - Optional expected price
 * @param currency - Currency code (default: USD)
 */
export function trackInitiatedCheckout(
  productId?: string,
  price?: number,
  currency: string = 'USD'
): void {
  try {
    const params: Record<string, string | number> = {
      [FB_PARAMS.CONTENT_TYPE]: 'subscription',
    };
    
    if (productId) {
      params[FB_PARAMS.CONTENT_ID] = productId;
    }
    if (price !== undefined) {
      params[FB_PARAMS.VALUE_TO_SUM] = price;
      params[FB_PARAMS.CURRENCY] = currency;
    }
    
    AppEventsLogger.logEvent(FB_EVENTS.INITIATED_CHECKOUT, params);
    
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Track custom event (for any additional events you want to track)
 * 
 * Note: Custom events are not optimized for ads like standard events.
 * Use standard events when possible.
 * 
 * @param eventName - The event name (use snake_case, max 40 chars)
 * @param params - Optional parameters
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, string | number>
): void {
  try {
    AppEventsLogger.logEvent(eventName, params);
    AppEventsLogger.flush();
  } catch (error) {
    // Silent failure
  }
}

/**
 * Set user ID for attribution (optional)
 * Call after user signs in to associate events with user
 * 
 * @param userId - The user's unique identifier
 */
export function setUserId(userId: string): void {
  try {
    AppEventsLogger.setUserID(userId);
  } catch (error) {
    // Silent failure
  }
}

/**
 * Clear user ID (call on sign out)
 */
export function clearUserId(): void {
  try {
    AppEventsLogger.setUserID(null);
  } catch (error) {
    // Silent failure
  }
}

// Export constants for consumers who need them
export { FB_EVENTS, FB_PARAMS };

export default {
  // Initialization
  initializeFacebookSDK,
  updateTrackingStatus,
  
  // Standard events (new naming)
  trackCompleteRegistration,
  trackPurchase,
  trackSubscribe,
  trackStartTrial,
  trackContentView,
  trackInitiatedCheckout,
  trackCustomEvent,
  
  // Legacy aliases (for backwards compatibility)
  trackRegistrationComplete,
  trackSubscriptionStart,
  trackTrialStarted,
  
  // User management
  setUserId,
  clearUserId,
  
  // Constants
  FB_EVENTS,
  FB_PARAMS,
};
