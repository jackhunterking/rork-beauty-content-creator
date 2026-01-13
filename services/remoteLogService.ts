/**
 * Remote Error Logging Service
 * 
 * Sends error logs to Supabase so we can debug issues on TestFlight/production devices
 * where we don't have access to console logs.
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

interface ErrorLogPayload {
  error_type: string;
  error_message: string;
  error_details?: Record<string, any>;
  device_info?: Record<string, any>;
}

/**
 * Get device information for debugging
 */
async function getDeviceInfo(): Promise<Record<string, any>> {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    appVersion: Constants.expoConfig?.version || 'unknown',
    buildNumber: Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || 'unknown',
    expoRuntimeVersion: Constants.expoConfig?.runtimeVersion || 'unknown',
    isDevice: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
  };
}

/**
 * Log an error to Supabase for remote debugging
 */
export async function logErrorRemotely(
  errorType: string,
  errorMessage: string,
  errorDetails?: Record<string, any>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('[RemoteLog] No user logged in, skipping remote log');
      return;
    }

    const deviceInfo = await getDeviceInfo();

    const payload: ErrorLogPayload = {
      error_type: errorType,
      error_message: errorMessage,
      error_details: errorDetails,
      device_info: deviceInfo,
    };

    const { error } = await supabase
      .from('error_logs')
      .insert({
        user_id: user.id,
        ...payload,
      });

    if (error) {
      console.error('[RemoteLog] Failed to log error remotely:', error.message);
    } else {
      console.log('[RemoteLog] Error logged remotely successfully');
    }
  } catch (logError) {
    // Don't throw - we don't want logging to break the app
    console.error('[RemoteLog] Exception while logging:', logError);
  }
}

/**
 * Log a diagnostic event (not an error, but useful info)
 */
export async function logDiagnostic(
  eventType: string,
  details: Record<string, any>
): Promise<void> {
  await logErrorRemotely(eventType, 'diagnostic', details);
}
