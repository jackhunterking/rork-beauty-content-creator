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
 * Initialize Facebook SDK
 * Call this early in app lifecycle (e.g., in _layout.tsx)
 */
export async function initializeFacebookSDK(): Promise<void> {
  try {
    // Initialize the SDK - this must be called first
    await Settings.initializeSDK();
    
    // Enable automatic logging of app events (includes app open/install)
    await Settings.setAutoLogAppEventsEnabled(true);
    
    // Enable advertiser ID collection for attribution
    await Settings.setAdvertiserIDCollectionEnabled(true);
    
    // Set Advertiser Tracking Enabled (ATE) flag for iOS 14.5+
    // Enables full tracking capabilities for ad attribution
    try {
      await Settings.setAdvertiserTrackingEnabled(true);
    } catch {
      // ATE flag not critical - continue initialization
      console.log('[MetaAnalytics] ATE flag could not be set (may require ATT consent)');
    }
    
    // Flush any pending events
    AppEventsLogger.flush();
    
    console.log('[MetaAnalytics] Facebook SDK initialized successfully');
  } catch (error) {
    console.error('[MetaAnalytics] Failed to initialize Facebook SDK:', error);
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
    
    console.log('[MetaAnalytics] Tracked complete registration:', method);
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track registration:', error);
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
    
    console.log('[MetaAnalytics] Tracked purchase:', { price, currency, productId });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track purchase:', error);
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
    
    console.log('[MetaAnalytics] Tracked subscribe:', { productId, price, currency });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track subscription:', error);
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
    
    console.log('[MetaAnalytics] Tracked start trial:', productId);
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track trial start:', error);
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
    
    console.log('[MetaAnalytics] Tracked content view:', { contentId, contentType });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track content view:', error);
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
    
    console.log('[MetaAnalytics] Tracked initiated checkout:', { productId, price });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track initiated checkout:', error);
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
    
    console.log('[MetaAnalytics] Tracked custom event:', eventName, params);
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track custom event:', error);
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
    console.log('[MetaAnalytics] Set user ID');
  } catch (error) {
    console.error('[MetaAnalytics] Failed to set user ID:', error);
  }
}

/**
 * Clear user ID (call on sign out)
 */
export function clearUserId(): void {
  try {
    AppEventsLogger.setUserID(null);
    console.log('[MetaAnalytics] Cleared user ID');
  } catch (error) {
    console.error('[MetaAnalytics] Failed to clear user ID:', error);
  }
}

// Export constants for consumers who need them
export { FB_EVENTS, FB_PARAMS };

export default {
  // Initialization
  initializeFacebookSDK,
  
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
