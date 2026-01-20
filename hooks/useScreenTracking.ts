import { useEffect, useRef } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { captureScreen, captureEvent, POSTHOG_EVENTS } from '@/services/posthogService';

/**
 * Screen Tracking Hook
 * 
 * Automatically tracks screen views when navigation changes.
 * Uses expo-router's usePathname and useSegments to detect navigation.
 * 
 * Usage:
 * Place this hook in a component that wraps all navigable screens,
 * typically in the root layout or a navigation container.
 * 
 * @param options - Optional configuration for screen tracking
 */
interface ScreenTrackingOptions {
  /** Whether to track screen views (default: true) */
  enabled?: boolean;
  /** Custom screen name mapper function */
  mapScreenName?: (pathname: string, segments: string[]) => string;
  /** Additional properties to include with every screen event */
  additionalProperties?: Record<string, any>;
}

/**
 * Default screen name mapper
 * Converts pathname to a human-readable screen name
 */
function defaultMapScreenName(pathname: string, segments: string[]): string {
  // Handle root path
  if (pathname === '/' || pathname === '') {
    return 'Home';
  }

  // Remove leading slash and split into parts
  const parts = pathname.replace(/^\//, '').split('/');
  
  // Map common route patterns to readable names
  const screenNameMap: Record<string, string> = {
    '(tabs)': 'Tabs',
    'index': 'Home',
    'library': 'Library',
    'settings': 'Settings',
    'editor-v2': 'Editor',
    'publish': 'Publish',
    'capture': 'Capture',
    'adjust': 'Adjust',
    'viewer': 'Library Viewer',
    'sign-in': 'Sign In',
    'sign-up': 'Sign Up',
    'onboarding-auth': 'Onboarding Auth',
    'membership': 'Membership',
  };

  // Build readable screen name
  const mappedParts = parts
    .filter(part => !part.startsWith('(') || part === '(tabs)') // Keep tabs but filter other groups
    .filter(part => !part.startsWith('[')) // Filter dynamic segments from name
    .map(part => screenNameMap[part] || part.charAt(0).toUpperCase() + part.slice(1));

  return mappedParts.join(' > ') || 'Unknown';
}

/**
 * Extract route parameters from pathname and segments
 */
function extractRouteParams(pathname: string, segments: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Look for dynamic segments (e.g., [slotId])
  const pathParts = pathname.split('/');
  
  segments.forEach((segment, index) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      // This is a dynamic segment
      const paramName = segment.slice(1, -1); // Remove brackets
      const value = pathParts[index + 1]; // +1 because pathname has leading slash
      if (value) {
        params[paramName] = value;
      }
    }
  });

  return params;
}

/**
 * Hook to track screen views automatically
 */
export function useScreenTracking(options: ScreenTrackingOptions = {}) {
  const {
    enabled = true,
    mapScreenName = defaultMapScreenName,
    additionalProperties = {},
  } = options;

  const pathname = usePathname();
  const segments = useSegments();
  const previousPathname = useRef<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    // Skip if pathname hasn't changed (avoid duplicate tracking)
    if (previousPathname.current === pathname) {
      return;
    }

    // Skip the first render (app launch is tracked separately)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPathname.current = pathname;
      return;
    }

    // Generate screen name
    const screenName = mapScreenName(pathname, segments);
    
    // Extract route parameters
    const routeParams = extractRouteParams(pathname, segments);

    // Track screen view in PostHog
    captureScreen(screenName, {
      pathname,
      segments: segments.join('/'),
      ...routeParams,
      ...additionalProperties,
    });

    // Track as an event for funnel analysis
    captureEvent('$screen_view', {
      $screen_name: screenName,
      pathname,
      segments: segments.join('/'),
      ...routeParams,
      ...additionalProperties,
    });

    // Update previous pathname
    previousPathname.current = pathname;

    console.log('[ScreenTracking] Screen viewed:', screenName, pathname);
  }, [pathname, segments, enabled, mapScreenName, additionalProperties]);

  return {
    currentPathname: pathname,
    currentSegments: segments,
  };
}

/**
 * Track a custom screen view manually
 * Use this for modal or overlay screens that don't change the route
 */
export function trackCustomScreen(
  screenName: string,
  properties?: Record<string, any>
): void {
  captureScreen(screenName, properties);
  captureEvent('$screen_view', {
    $screen_name: screenName,
    custom_screen: true,
    ...properties,
  });
  console.log('[ScreenTracking] Custom screen tracked:', screenName);
}

export default useScreenTracking;
