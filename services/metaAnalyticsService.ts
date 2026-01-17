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
    // Initialize the SDK
    await Settings.initializeSDK();
    
    // Enable automatic logging of app events
    await Settings.setAutoLogAppEventsEnabled(true);
    
    // Enable advertiser ID collection (works without ATT, but limited)
    // Note: For full tracking, ATT permission would be needed
    await Settings.setAdvertiserIDCollectionEnabled(true);
    
    console.log('[MetaAnalytics] Facebook SDK initialized successfully');
  } catch (error) {
    console.error('[MetaAnalytics] Failed to initialize Facebook SDK:', error);
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
    // Use Facebook's standard event for registration
    AppEventsLogger.logEvent(
      AppEventsLogger.AppEvents.CompletedRegistration,
      {
        [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
      }
    );
    
    console.log('[MetaAnalytics] Registration event tracked:', method);
  } catch (error) {
    console.error('[MetaAnalytics] Failed to track registration:', error);
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
  trackRegistrationComplete,
  trackPurchase,
  trackSubscriptionStart,
  trackTrialStarted,
  trackCustomEvent,
  setUserId,
  clearUserId,
};
