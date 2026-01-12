import { useState, useEffect, useCallback } from 'react';
import { ForceUpdateStatus } from '@/types';
import { checkForceUpdate } from '@/services/appConfigService';

/**
 * Force Update Hook
 * 
 * Checks if a force update is required based on remote config.
 * Should be used after splash screen completes to determine
 * if user needs to update before accessing the app.
 */

interface UseForceUpdateResult {
  /** Whether an update is required to continue */
  isUpdateRequired: boolean;
  /** Message to display to the user */
  updateMessage: string;
  /** URL to the app store for updating */
  storeUrl: string | null;
  /** Current app version */
  currentVersion: string;
  /** Minimum required version */
  minimumVersion: string;
  /** Whether the check is still in progress */
  isChecking: boolean;
  /** Whether the check has completed */
  hasChecked: boolean;
  /** Re-run the check (useful after app returns from background) */
  recheckUpdate: () => Promise<void>;
}

export function useForceUpdate(shouldCheck: boolean = false): UseForceUpdateResult {
  const [status, setStatus] = useState<ForceUpdateStatus>({
    isRequired: false,
    message: '',
    storeUrl: null,
    currentVersion: '1.0.0',
    minimumVersion: '1.0.0',
  });
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const performCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkForceUpdate();
      setStatus(result);
      setHasChecked(true);
      console.log('[useForceUpdate] Check complete:', result);
    } catch (error) {
      console.error('[useForceUpdate] Check failed:', error);
      // On error, don't block the user
      setHasChecked(true);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (shouldCheck && !hasChecked && !isChecking) {
      performCheck();
    }
  }, [shouldCheck, hasChecked, isChecking, performCheck]);

  return {
    isUpdateRequired: status.isRequired,
    updateMessage: status.message,
    storeUrl: status.storeUrl,
    currentVersion: status.currentVersion,
    minimumVersion: status.minimumVersion,
    isChecking,
    hasChecked,
    recheckUpdate: performCheck,
  };
}
