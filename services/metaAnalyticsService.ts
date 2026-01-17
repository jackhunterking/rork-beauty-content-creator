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

// Only log in development mode
const log = __DEV__ ? console.log : () => {};
const logError = console.error; // Always log errors

/**
 * Initialize Facebook SDK
 * Call this early in app lifecycle (e.g., in _layout.tsx)
 */
export async function initializeFacebookSDK(): Promise<void> {
  try {
    log('[MetaAnalytics] Initializing Facebook SDK...');
    
    // Initialize the SDK
    await Settings.initializeSDK();
    
    // Enable automatic logging of app events
    await Settings.setAutoLogAppEventsEnabled(true);
    
    // Enable advertiser ID collection
    await Settings.setAdvertiserIDCollectionEnabled(true);
    
    // Set Advertiser Tracking Enabled (ATE) flag for iOS 14.5+
    // Set to false since we're not requesting ATT permission
    try {
      await Settings.setAdvertiserTrackingEnabled(false);
    } catch {
      // ATE flag not critical - continue initialization
    }
    
    // Log app activation - sends "app install" / "app open" event
    AppEventsLogger.logEvent('fb_mobile_activate_app');
    AppEventsLogger.flush();
    
    log('[MetaAnalytics] ✓ Facebook SDK initialized successfully');
  } catch (error) {
    logError('[MetaAnalytics] Failed to initialize Facebook SDK:', error);
  }
}

/**
 * Send a test event to verify SDK is working
 * Use this to trigger events for Facebook Events Manager testing
 */
export function sendTestEvent(): void {
  try {
    const eventName = AppEventsLogger.AppEvents?.ViewedContent || 'fb_mobile_content_view';
    const contentTypeKey = AppEventsLogger.AppEventParams?.ContentType || 'fb_content_type';
    const contentIdKey = AppEventsLogger.AppEventParams?.ContentID || 'fb_content_id';
    
    AppEventsLogger.logEvent(eventName, {
      [contentTypeKey]: 'test',
      [contentIdKey]: `test_content_${Date.now()}`,
    });
    
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Test event sent');
  } catch (error) {
    logError('[MetaAnalytics] Failed to send test event:', error);
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
  try {
    const eventName = AppEventsLogger.AppEvents?.CompletedRegistration || 'fb_mobile_complete_registration';
    const methodKey = AppEventsLogger.AppEventParams?.RegistrationMethod || 'fb_registration_method';
    
    AppEventsLogger.logEvent(eventName, {
      [methodKey]: method,
    });
    
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Registration tracked:', method);
  } catch (error) {
    logError('[MetaAnalytics] Failed to track registration:', error);
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
    AppEventsLogger.logPurchase(price, currency, {
      subscription_type: subscriptionType || 'pro',
      content_type: 'subscription',
    });
    
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Purchase tracked:', { price, currency, subscriptionType });
  } catch (error) {
    logError('[MetaAnalytics] Failed to track purchase:', error);
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
    // Log Subscribe event for attribution
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
    
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Subscription start tracked:', { productId, price, currency });
  } catch (error) {
    logError('[MetaAnalytics] Failed to track subscription start:', error);
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
    
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Trial started tracked:', productId);
  } catch (error) {
    logError('[MetaAnalytics] Failed to track trial start:', error);
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
    AppEventsLogger.flush();
    log('[MetaAnalytics] ✓ Custom event tracked:', eventName);
  } catch (error) {
    logError('[MetaAnalytics] Failed to track custom event:', error);
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
    log('[MetaAnalytics] User ID set');
  } catch (error) {
    logError('[MetaAnalytics] Failed to set user ID:', error);
  }
}

/**
 * Clear user ID (call on sign out)
 */
export function clearUserId(): void {
  try {
    AppEventsLogger.setUserID(null);
    log('[MetaAnalytics] User ID cleared');
  } catch (error) {
    logError('[MetaAnalytics] Failed to clear user ID:', error);
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
