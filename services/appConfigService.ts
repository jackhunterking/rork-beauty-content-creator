import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { AppConfig, AppConfigRow, ForceUpdateStatus } from '@/types';

/**
 * App Configuration Service
 * 
 * Handles fetching remote app configuration from Supabase,
 * including force update settings and version checking.
 */

/**
 * Get the current app version from Expo config
 */
export function getCurrentAppVersion(): string {
  // Get version from Expo config (set in app.config.js)
  const version = Constants.expoConfig?.version || '1.0.0';
  return version;
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  // Pad arrays to same length
  const maxLength = Math.max(parts1.length, parts2.length);
  while (parts1.length < maxLength) parts1.push(0);
  while (parts2.length < maxLength) parts2.push(0);
  
  for (let i = 0; i < maxLength; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }
  
  return 0;
}

/**
 * Check if current version is below minimum required version
 */
export function isVersionBelowMinimum(currentVersion: string, minimumVersion: string): boolean {
  return compareVersions(currentVersion, minimumVersion) < 0;
}

/**
 * Transform database row to AppConfig object
 */
function transformAppConfigRow(row: AppConfigRow): AppConfig {
  return {
    id: row.id,
    minIosVersion: row.min_ios_version,
    minAndroidVersion: row.min_android_version,
    forceUpdateEnabled: row.force_update_enabled,
    updateMessage: row.update_message,
    storeUrlIos: row.store_url_ios,
    storeUrlAndroid: row.store_url_android,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch app configuration from Supabase
 * Returns null if fetch fails (app should continue normally on error)
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('id', 'global')
      .single();
    
    if (error) {
      return null;
    }
    
    if (!data) {
      return null;
    }
    
    return transformAppConfigRow(data as AppConfigRow);
  } catch (error) {
    return null;
  }
}

/**
 * Get the minimum required version for the current platform
 */
export function getMinimumVersionForPlatform(config: AppConfig): string {
  return Platform.OS === 'ios' 
    ? config.minIosVersion 
    : config.minAndroidVersion;
}

/**
 * Get the store URL for the current platform
 */
export function getStoreUrlForPlatform(config: AppConfig): string | null {
  return Platform.OS === 'ios'
    ? config.storeUrlIos
    : config.storeUrlAndroid;
}

/**
 * Check if a force update is required
 * Returns ForceUpdateStatus with all relevant information
 */
export async function checkForceUpdate(): Promise<ForceUpdateStatus> {
  const currentVersion = getCurrentAppVersion();
  
  // Default status - no update required
  const defaultStatus: ForceUpdateStatus = {
    isRequired: false,
    message: '',
    storeUrl: null,
    currentVersion,
    minimumVersion: currentVersion,
  };
  
  // Skip on web platform
  if (Platform.OS === 'web') {
    return defaultStatus;
  }
  
  try {
    const config = await fetchAppConfig();
    
    // If config fetch fails, don't block the user
    if (!config) {
      return defaultStatus;
    }
    
    // If force update is disabled globally, no update required
    if (!config.forceUpdateEnabled) {
      return defaultStatus;
    }
    
    const minimumVersion = getMinimumVersionForPlatform(config);
    const storeUrl = getStoreUrlForPlatform(config);
    
    // Check if current version is below minimum
    const isRequired = isVersionBelowMinimum(currentVersion, minimumVersion);
    
    return {
      isRequired,
      message: config.updateMessage,
      storeUrl,
      currentVersion,
      minimumVersion,
    };
  } catch (error) {
    return defaultStatus;
  }
}
