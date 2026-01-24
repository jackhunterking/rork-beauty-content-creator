/**
 * Analytics Service
 * 
 * Unified analytics interface that dispatches to analytics backends.
 * Currently wraps PostHog, but provides a simpler API and could
 * easily support additional backends in the future.
 * 
 * Benefits:
 * - Single import for all analytics needs
 * - Simpler API than direct PostHog usage
 * - Easy to add additional backends
 * - Better testability
 */

import { captureEvent, captureScreen, identifyUser, resetPostHog, POSTHOG_EVENTS } from '@/services/posthogService';

// ============================================
// Types
// ============================================

export type AnalyticsProperties = Record<string, string | number | boolean | undefined | null>;

// ============================================
// Analytics Interface
// ============================================

/**
 * Track a custom event with optional properties
 * 
 * @param eventName - The event name (use EVENTS constants)
 * @param properties - Optional properties object
 */
export function track(eventName: string, properties?: AnalyticsProperties): void {
  captureEvent(eventName, properties);
}

/**
 * Track a screen view
 * 
 * @param screenName - The screen name
 * @param properties - Optional properties
 */
export function screen(screenName: string, properties?: AnalyticsProperties): void {
  captureScreen(screenName, properties);
}

/**
 * Identify a user with optional traits
 * 
 * @param userId - The user's unique ID
 * @param traits - Optional user traits
 */
export function identify(userId: string, traits?: AnalyticsProperties): void {
  identifyUser(userId, traits);
}

/**
 * Reset the analytics state (call on logout)
 */
export function reset(): void {
  resetPostHog();
}

// ============================================
// Re-export Event Names
// ============================================

/**
 * Standard event names for consistency
 */
export const EVENTS = POSTHOG_EVENTS;

// ============================================
// Convenience Methods
// ============================================

/**
 * Track when a user starts creating content
 */
export function trackTemplateSelected(templateId: string, templateName?: string): void {
  track(EVENTS.TEMPLATE_SELECTED, {
    template_id: templateId,
    template_name: templateName,
  });
}

/**
 * Track when a user captures an image
 */
export function trackImageCaptured(slotId: string, source: 'camera' | 'gallery'): void {
  track(EVENTS.IMAGE_CAPTURED, {
    slot_id: slotId,
    source,
  });
}

/**
 * Track when content is saved
 */
export function trackContentSaved(draftId: string, templateId: string): void {
  track(EVENTS.CONTENT_SAVED, {
    draft_id: draftId,
    template_id: templateId,
  });
}

/**
 * Track when content is exported/downloaded
 */
export function trackContentExported(
  draftId: string,
  format: 'png' | 'jpg' | 'webp',
  isPremium: boolean
): void {
  track(EVENTS.CONTENT_EXPORTED, {
    draft_id: draftId,
    format,
    is_premium: isPremium,
  });
}

/**
 * Track AI enhancement events
 */
export function trackAIEnhancement(
  action: 'started' | 'completed' | 'failed',
  feature: string,
  properties?: AnalyticsProperties
): void {
  const event = action === 'started'
    ? EVENTS.AI_ENHANCEMENT_STARTED
    : action === 'completed'
    ? EVENTS.AI_ENHANCEMENT_COMPLETED
    : EVENTS.AI_ENHANCEMENT_FAILED;

  track(event, {
    feature,
    ...properties,
  });
}

/**
 * Track paywall events
 */
export function trackPaywall(
  action: 'presented' | 'dismissed' | 'skipped' | 'error',
  properties?: AnalyticsProperties
): void {
  const event = action === 'presented'
    ? EVENTS.PAYWALL_PRESENTED
    : action === 'dismissed'
    ? EVENTS.PAYWALL_DISMISSED
    : action === 'skipped'
    ? EVENTS.PAYWALL_SKIPPED
    : EVENTS.PAYWALL_ERROR;

  track(event, properties);
}

// ============================================
// Default Export
// ============================================

export const analytics = {
  track,
  screen,
  identify,
  reset,
  EVENTS,
  // Convenience methods
  trackTemplateSelected,
  trackImageCaptured,
  trackContentSaved,
  trackContentExported,
  trackAIEnhancement,
  trackPaywall,
};

export default analytics;
