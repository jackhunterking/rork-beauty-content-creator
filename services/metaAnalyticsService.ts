/**
 * Meta Analytics Service
 * 
 * Tracks key events for Meta (Facebook) Ads attribution.
 * Uses react-native-fbsdk-next to send events to Facebook.
 * 
 * Events tracked:
 * 1. Install - Automatic via SDK
 * 2. Complete Registration - User signs up/in
 * 3. Purchase - User subscribes to Pro
 * 
 * @see https://developers.facebook.com/docs/app-events/reference
 */

import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import { Platform } from 'react-native';

/**
 * Initialize Facebook SDK
 * Call this early in app lifecycle (e.g., in _layout.tsx)
 */
export async function initializeFacebookSDK(): Promise<void> {
  try {
    console.log('[MetaAnalytics] === INITIALIZING FACEBOOK SDK ===');
    
    console.log('[MetaAnalytics] Platform:', Platform.OS);
    
    // Initialize the SDK
    await Settings.initializeSDK();
    console.log('[MetaAnalytics] SDK initialized');
    
    // Log the app ID to verify it's set correctly
    try {
      const appId = await Settings.getAppID();
      console.log('[MetaAnalytics] Facebook App ID from SDK:', appId || 'NOT SET');
    } catch (e) {
      console.log('[MetaAnalytics] Could not get App ID:', e);
    }
    
    // Enable automatic logging of app events
    await Settings.setAutoLogAppEventsEnabled(true);
    console.log('[MetaAnalytics] Auto log app events enabled');
    
    // Enable advertiser ID collection (works without ATT, but limited)
    // Note: For full tracking, ATT permission would be needed
    await Settings.setAdvertiserIDCollectionEnabled(true);
    console.log('[MetaAnalytics] Advertiser ID collection enabled');
    
    // Enable debug mode for Facebook SDK (shows more info in native logs)
    // This helps identify if events are being sent correctly
    if (__DEV__) {
      try {
        // @ts-ignore - setDebugMode might not be in types but exists in native
        if (typeof Settings.setDebugMode === 'function') {
          Settings.setDebugMode(true);
          console.log('[MetaAnalytics] Debug mode enabled');
        }
      } catch (e) {
        console.log('[MetaAnalytics] Debug mode not available');
      }
    }
    
    // Log app activation - this sends the "app install" / "app open" event
    AppEventsLogger.logEvent('fb_mobile_activate_app');
    console.log('[MetaAnalytics] App activation event sent');
    
    // Flush to ensure events are sent immediately
    AppEventsLogger.flush();
    console.log('[MetaAnalytics] Events flushed');
    
    console.log('[MetaAnalytics] ✓ Facebook SDK initialized successfully');
    console.log('[MetaAnalytics] === INITIALIZATION COMPLETE ===');
  } catch (error) {
    console.error('[MetaAnalytics] ✗ Failed to initialize Facebook SDK:', error);
    console.error('[MetaAnalytics] Error details:', JSON.stringify(error, null, 2));
  }
}

/**
 * Send a test event to verify SDK is working
 * Use this to trigger events for Facebook Events Manager testing
 */
export function sendTestEvent(): void {
  console.log('[MetaAnalytics] === SENDING TEST EVENT ===');
  try {
    // Log the constants to verify they're not null
    const eventName = AppEventsLogger.AppEvents?.ViewedContent;
    const contentTypeKey = AppEventsLogger.AppEventParams?.ContentType;
    const contentIdKey = AppEventsLogger.AppEventParams?.ContentID;
    
    console.log('[MetaAnalytics] Event constants:', {
      eventName: eventName || 'NULL',
      contentTypeKey: contentTypeKey || 'NULL',
      contentIdKey: contentIdKey || 'NULL',
      hasAppEvents: !!AppEventsLogger.AppEvents,
      hasAppEventParams: !!AppEventsLogger.AppEventParams,
    });
    
    // Use string literals as fallback if constants are undefined
    const safeEventName = eventName || 'fb_mobile_content_view';
    const safeParams: Record<string, string> = {};
    
    if (contentTypeKey) {
      safeParams[contentTypeKey] = 'test';
    } else {
      safeParams['fb_content_type'] = 'test';
    }
    
    if (contentIdKey) {
      safeParams[contentIdKey] = 'test_content_' + Date.now();
    } else {
      safeParams['fb_content_id'] = 'test_content_' + Date.now();
    }
    
    console.log('[MetaAnalytics] Sending event with params:', { eventName: safeEventName, params: safeParams });
    
    // Send a ViewContent event as a test with safe values
    AppEventsLogger.logEvent(safeEventName, safeParams);
    console.log('[MetaAnalytics] ViewContent test event sent');
    
    // Also send app activation
    AppEventsLogger.logEvent('fb_mobile_activate_app');
    console.log('[MetaAnalytics] App activation event sent');
    
    // Flush immediately
    AppEventsLogger.flush();
    console.log('[MetaAnalytics] ✓ Test events flushed to Facebook');
    console.log('[MetaAnalytics] === TEST EVENT COMPLETE ===');
  } catch (error) {
    console.error('[MetaAnalytics] ✗ Failed to send test event:', error);
    console.error('[MetaAnalytics] Error details:', JSON.stringify(error));
  }
}

/**
 * Track user registration/sign-up completion
 * 
 * @param method - The registration method used (apple, google, email)
 */
export function trackRegistrationComplete(
  method: 'apple' | 'google' | 'email'
): void {
  console.log('[MetaAnalytics] === REGISTRATION TRACKING START ===');
  console.log('[MetaAnalytics] Attempting to track registration for method:', method);
  
  try {
    // Log the event name we're using
    const eventName = AppEventsLogger.AppEvents.CompletedRegistration;
    console.log('[MetaAnalytics] Using event name:', eventName);
    
    // Use Facebook's standard event for registration
    AppEventsLogger.logEvent(
      eventName,
      {
        [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
      }
    );
    
    // Also flush events to ensure they're sent immediately
    AppEventsLogger.flush();
    
    console.log('[MetaAnalytics] ✓ Registration event tracked successfully:', method);
    console.log('[MetaAnalytics] === REGISTRATION TRACKING END ===');
  } catch (error) {
    console.error('[MetaAnalytics] ✗ Failed to track registration:', error);
    console.error('[MetaAnalytics] Error details:', JSON.stringify(error, null, 2));
  }
}

/**
 * Track subscription purchase
 * 
 * @param price - The subscription price
 * @param currency - Currency code (default: USD)
 * @param subscriptionType - Type of subscription (weekly, monthly, etc.)
 */
export function trackPurchase(
  price: number,
  currency: string = 'USD',
  subscriptionType?: string
): void {
  try {
    // Use Facebook's standard purchase event
    AppEventsLogger.logPurchase(price, currency, {
      subscription_type: subscriptionType || 'pro',
      content_type: 'subscription',
    });
    
    console.log('[MetaAnalytics] Purchase event tracked:', { price, currency, subscriptionType });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track purchase:', error);
  }
}

/**
 * Track subscription start (trial or paid)
 * Use this when user starts a subscription through Superwall
 * 
 * @param productId - The product identifier
 * @param price - The subscription price
 * @param currency - Currency code (default: USD)
 */
export function trackSubscriptionStart(
  productId: string,
  price: number,
  currency: string = 'USD'
): void {
  try {
    // Log as both Subscribe and Purchase for better attribution
    AppEventsLogger.logEvent('fb_mobile_subscribe', {
      fb_content_id: productId,
      fb_content_type: 'subscription',
      _valueToSum: price,
      fb_currency: currency,
    });
    
    // Also log as purchase for revenue tracking
    AppEventsLogger.logPurchase(price, currency, {
      content_id: productId,
      content_type: 'subscription',
    });
    
    console.log('[MetaAnalytics] Subscription start tracked:', { productId, price, currency });
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track subscription start:', error);
  }
}

/**
 * Track trial started
 * 
 * @param productId - The product identifier
 */
export function trackTrialStarted(productId?: string): void {
  try {
    AppEventsLogger.logEvent('fb_mobile_start_trial', {
      fb_content_id: productId || 'pro_trial',
      fb_content_type: 'subscription',
    });
    
    console.log('[MetaAnalytics] Trial started tracked:', productId);
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track trial start:', error);
  }
}

/**
 * Track custom event (for any additional events you want to track)
 * 
 * @param eventName - The event name
 * @param params - Optional parameters
 */
export function trackCustomEvent(
  eventName: string,
  params?: Record<string, string | number>
): void {
  try {
    AppEventsLogger.logEvent(eventName, params);
    console.log('[MetaAnalytics] Custom event tracked:', eventName, params);
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
    console.log('[MetaAnalytics] User ID set:', userId);
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
    console.log('[MetaAnalytics] User ID cleared');
  } catch (error) {
    console.error('[MetaAnalytics] Failed to clear user ID:', error);
  }
}

export default {
  initializeFacebookSDK,
  sendTestEvent,
  trackRegistrationComplete,
  trackPurchase,
  trackSubscriptionStart,
  trackTrialStarted,
  trackCustomEvent,
  setUserId,
  clearUserId,
};
