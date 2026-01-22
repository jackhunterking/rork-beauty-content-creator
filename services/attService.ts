/**
 * App Tracking Transparency (ATT) Service
 * 
 * Handles Apple's ATT framework for iOS 14.5+ to request user permission
 * for tracking across apps and websites.
 * 
 * IMPORTANT: This service must be called BEFORE initializing any tracking SDKs
 * (Facebook SDK, etc.) to ensure compliance with Apple's requirements.
 * 
 * @see https://developer.apple.com/documentation/apptrackingtransparency
 * @see https://docs.expo.dev/versions/latest/sdk/tracking-transparency/
 */

import { Platform } from 'react-native';
import {
  requestTrackingPermissionsAsync,
  getTrackingPermissionsAsync,
  PermissionStatus,
} from 'expo-tracking-transparency';

// ============================================
// ATT Authorization Status Types
// ============================================

/**
 * ATT Authorization Status
 * Maps to Apple's ATTrackingManager.AuthorizationStatus
 */
export type ATTAuthorizationStatus = 
  | 'not-determined' // User hasn't made a choice yet
  | 'restricted'     // Device-level restriction (e.g., parental controls)
  | 'denied'         // User denied tracking
  | 'authorized';    // User authorized tracking

/**
 * Result of ATT permission request
 */
export interface ATTResult {
  status: ATTAuthorizationStatus;
  canTrack: boolean;
}

// ============================================
// Service State
// ============================================

let cachedStatus: ATTAuthorizationStatus | null = null;

// ============================================
// Core Functions
// ============================================

/**
 * Request App Tracking Transparency permission from the user.
 * 
 * This will show the native iOS permission dialog if the user hasn't
 * made a choice yet. The dialog shows the NSUserTrackingUsageDescription
 * message defined in Info.plist.
 * 
 * IMPORTANT: 
 * - Only works on iOS 14.5+
 * - On Android and older iOS, returns 'authorized' by default
 * - Dialog only shows once - subsequent calls return cached status
 * 
 * @returns Promise<ATTResult> - The authorization status and whether tracking is allowed
 */
export async function requestATTPermission(): Promise<ATTResult> {
  // ATT is only relevant on iOS
  if (Platform.OS !== 'ios') {
    console.log('[ATT] Not iOS, tracking allowed by default');
    return {
      status: 'authorized',
      canTrack: true,
    };
  }

  try {
    console.log('[ATT] Requesting tracking permission...');
    
    const { status } = await requestTrackingPermissionsAsync();
    const attStatus = mapExpoStatusToATT(status);
    
    // Cache the result
    cachedStatus = attStatus;
    
    const canTrack = attStatus === 'authorized';
    
    console.log('[ATT] Permission result:', { status: attStatus, canTrack });
    
    return {
      status: attStatus,
      canTrack,
    };
  } catch (error) {
    console.error('[ATT] Error requesting permission:', error);
    // On error, assume tracking is not allowed (privacy-first approach)
    return {
      status: 'denied',
      canTrack: false,
    };
  }
}

/**
 * Get the current ATT authorization status without prompting.
 * 
 * Use this to check the status before deciding whether to show
 * the permission dialog or when you need to know the current status
 * without prompting the user.
 * 
 * @returns Promise<ATTResult> - The current authorization status
 */
export async function getATTStatus(): Promise<ATTResult> {
  // Return cached status if available
  if (cachedStatus !== null) {
    return {
      status: cachedStatus,
      canTrack: cachedStatus === 'authorized',
    };
  }

  // ATT is only relevant on iOS
  if (Platform.OS !== 'ios') {
    return {
      status: 'authorized',
      canTrack: true,
    };
  }

  try {
    const { status } = await getTrackingPermissionsAsync();
    const attStatus = mapExpoStatusToATT(status);
    
    // Cache the result
    cachedStatus = attStatus;
    
    return {
      status: attStatus,
      canTrack: attStatus === 'authorized',
    };
  } catch (error) {
    console.error('[ATT] Error getting status:', error);
    return {
      status: 'denied',
      canTrack: false,
    };
  }
}

/**
 * Check if the ATT prompt should be shown.
 * 
 * Returns true only if:
 * - Running on iOS
 * - User hasn't made a choice yet (status is 'not-determined')
 * 
 * @returns Promise<boolean> - Whether to show the ATT prompt
 */
export async function shouldShowATTPrompt(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const { status } = await getATTStatus();
  return status === 'not-determined';
}

/**
 * Check if tracking is allowed based on current ATT status.
 * 
 * @returns Promise<boolean> - Whether tracking is allowed
 */
export async function isTrackingAllowed(): Promise<boolean> {
  const { canTrack } = await getATTStatus();
  return canTrack;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Map Expo's PermissionStatus to our ATT status type
 */
function mapExpoStatusToATT(status: PermissionStatus): ATTAuthorizationStatus {
  switch (status) {
    case PermissionStatus.GRANTED:
      return 'authorized';
    case PermissionStatus.DENIED:
      return 'denied';
    case PermissionStatus.UNDETERMINED:
      return 'not-determined';
    default:
      // Handle any unknown status as denied for safety
      return 'denied';
  }
}

/**
 * Clear the cached status (useful for testing)
 */
export function clearATTCache(): void {
  cachedStatus = null;
}

// ============================================
// Export default service object
// ============================================

export default {
  requestATTPermission,
  getATTStatus,
  shouldShowATTPrompt,
  isTrackingAllowed,
  clearATTCache,
};
