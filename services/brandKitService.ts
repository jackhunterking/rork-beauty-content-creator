/**
 * Brand Kit Service
 * 
 * Manages brand assets like logo for Pro overlay features.
 * Primary storage: Supabase (database + storage bucket)
 * Secondary storage: Local cache for offline access and fast loading
 * 
 * Architecture:
 * - Save: Upload to Supabase first, then cache locally
 * - Load: Load from local cache first, sync with Supabase in background
 * - Offline: Gracefully fall back to local cache when network unavailable
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandKit, BrandKitRow } from '@/types';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

// Storage keys
const BRAND_KIT_STORAGE_KEY = '@beauty_app_brand_kit';
const BRAND_LOGO_FILENAME = 'brand_logo.jpg';
const STORAGE_BUCKET = 'brand-logos';

// Directory for brand assets (local cache)
const BRAND_KIT_DIRECTORY = `${FileSystem.documentDirectory}brand-kit/`;

// ============================================
// Helper Functions
// ============================================

/**
 * Get the default brand kit configuration
 */
export function getDefaultBrandKit(): BrandKit {
  return {
    logoUri: undefined,
    logoWidth: undefined,
    logoHeight: undefined,
    primaryColor: undefined,
    applyLogoAutomatically: false,
    addDisclaimer: false,
    updatedAt: undefined,
  };
}

/**
 * Map database row to BrandKit type
 */
function mapRowToBrandKit(row: BrandKitRow, localLogoUri?: string): BrandKit {
  return {
    logoUri: localLogoUri || row.logo_url || undefined,
    logoWidth: row.logo_width || undefined,
    logoHeight: row.logo_height || undefined,
    primaryColor: row.primary_color || undefined,
    applyLogoAutomatically: row.apply_logo_automatically,
    addDisclaimer: row.add_disclaimer,
    updatedAt: row.updated_at,
  };
}

/**
 * Ensure the brand kit directory exists
 */
async function ensureBrandKitDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BRAND_KIT_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BRAND_KIT_DIRECTORY, { intermediates: true });
    console.log('[BrandKit] Created brand kit directory');
  }
}

/**
 * Get the local logo file path
 */
function getLogoPath(): string {
  return `${BRAND_KIT_DIRECTORY}${BRAND_LOGO_FILENAME}`;
}

/**
 * Get the current authenticated user ID
 */
async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

/**
 * Normalize an image URI by processing it through ImageManipulator
 * This handles various URI schemes (ph://, file://, content://) and
 * returns a local file:// URI that can be reliably processed
 */
async function normalizeImageUri(sourceUri: string): Promise<{ uri: string; width: number; height: number }> {
  console.log('[BrandKit] Normalizing image URI:', sourceUri.substring(0, 100) + '...');
  console.log('[BrandKit] URI scheme:', sourceUri.split(':')[0]);
  
  try {
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [], // No transformations, just process to get a local file
      { 
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.9,
      }
    );
    
    console.log('[BrandKit] Normalized URI:', result.uri.substring(0, 100) + '...');
    console.log('[BrandKit] Result dimensions:', result.width, 'x', result.height);
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Failed to normalize image URI:', errorMessage);
    throw new Error(`Failed to process image: ${errorMessage}`);
  }
}

// ============================================
// Local Cache Functions
// ============================================

/**
 * Save brand kit to local cache (AsyncStorage + file system)
 */
async function saveToLocalCache(brandKit: BrandKit): Promise<void> {
  try {
    const cacheData: BrandKit = {
      ...brandKit,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(cacheData));
    console.log('[BrandKit] Saved to local cache');
  } catch (error) {
    console.error('[BrandKit] Failed to save to local cache:', error);
  }
}

/**
 * Load brand kit from local cache
 */
async function loadFromLocalCache(): Promise<BrandKit | null> {
  try {
    const stored = await AsyncStorage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const brandKit = JSON.parse(stored) as BrandKit;

    // Verify the logo file still exists locally
    if (brandKit.logoUri) {
      const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
      if (!fileInfo.exists) {
        console.warn('[BrandKit] Local logo file not found');
        brandKit.logoUri = undefined;
        brandKit.logoWidth = undefined;
        brandKit.logoHeight = undefined;
      }
    }

    return brandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to load from local cache:', error);
    return null;
  }
}

/**
 * Clear local cache
 */
async function clearLocalCache(): Promise<void> {
  try {
    // Delete local logo file
    const logoPath = getLogoPath();
    const fileInfo = await FileSystem.getInfoAsync(logoPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }

    // Clear AsyncStorage
    await AsyncStorage.removeItem(BRAND_KIT_STORAGE_KEY);
    console.log('[BrandKit] Local cache cleared');
  } catch (error) {
    console.error('[BrandKit] Failed to clear local cache:', error);
  }
}

/**
 * Download logo from URL and cache locally
 */
async function cacheLogoLocally(logoUrl: string): Promise<string | null> {
  try {
    await ensureBrandKitDirectory();
    const logoPath = getLogoPath();

    // Delete existing if present
    const existingInfo = await FileSystem.getInfoAsync(logoPath);
    if (existingInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }

    // Download the logo
    const downloadResult = await FileSystem.downloadAsync(logoUrl, logoPath);
    if (downloadResult.status === 200) {
      console.log('[BrandKit] Logo cached locally');
      return logoPath;
    } else {
      console.warn('[BrandKit] Failed to download logo, status:', downloadResult.status);
      return null;
    }
  } catch (error) {
    console.error('[BrandKit] Failed to cache logo locally:', error);
    return null;
  }
}

// ============================================
// Supabase Functions
// ============================================

/**
 * Fetch brand kit from Supabase database
 */
async function fetchFromSupabase(): Promise<BrandKitRow | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[BrandKit] User not authenticated, skipping Supabase fetch');
      return null;
    }

    const { data, error } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found - this is normal for new users
        console.log('[BrandKit] No brand kit found in Supabase');
        return null;
      }
      console.error('[BrandKit] Supabase fetch error:', error);
      return null;
    }

    return data as BrandKitRow;
  } catch (error) {
    console.error('[BrandKit] Failed to fetch from Supabase:', error);
    return null;
  }
}

/**
 * Upsert brand kit in Supabase database
 */
async function upsertToSupabase(brandKit: Partial<BrandKitRow>): Promise<BrandKitRow | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[BrandKit] User not authenticated, skipping Supabase upsert');
      return null;
    }

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert({
        user_id: userId,
        ...brandKit,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) {
      console.error('[BrandKit] Supabase upsert error:', error);
      return null;
    }

    console.log('[BrandKit] Saved to Supabase');
    return data as BrandKitRow;
  } catch (error) {
    console.error('[BrandKit] Failed to upsert to Supabase:', error);
    return null;
  }
}

/**
 * Upload logo to Supabase Storage
 */
async function uploadLogoToStorage(localUri: string): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[BrandKit] User not authenticated, cannot upload logo');
      return null;
    }

    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload to Supabase Storage
    const filePath = `${userId}/logo.jpg`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      console.error('[BrandKit] Storage upload error:', error);
      return null;
    }

    // Get signed URL (private bucket)
    const { data: urlData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    if (!urlData?.signedUrl) {
      console.error('[BrandKit] Failed to get signed URL');
      return null;
    }

    console.log('[BrandKit] Logo uploaded to Supabase Storage');
    return urlData.signedUrl;
  } catch (error) {
    console.error('[BrandKit] Failed to upload logo to storage:', error);
    return null;
  }
}

/**
 * Delete logo from Supabase Storage
 */
async function deleteLogoFromStorage(): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return;
    }

    const filePath = `${userId}/logo.jpg`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error('[BrandKit] Storage delete error:', error);
    } else {
      console.log('[BrandKit] Logo deleted from Supabase Storage');
    }
  } catch (error) {
    console.error('[BrandKit] Failed to delete logo from storage:', error);
  }
}

// ============================================
// Public API
// ============================================

/**
 * Load the brand kit - uses local cache first, syncs with Supabase in background
 */
export async function loadBrandKit(): Promise<BrandKit> {
  console.log('[BrandKit] Loading brand kit...');
  
  // First, try to load from local cache for instant display
  const cached = await loadFromLocalCache();
  if (cached) {
    console.log('[BrandKit] Loaded from local cache');
    
    // Sync with Supabase in background (don't await)
    syncBrandKit().catch(err => console.warn('[BrandKit] Background sync failed:', err));
    
    return cached;
  }

  // No local cache - try to fetch from Supabase
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log('[BrandKit] User not authenticated, returning default brand kit');
    return getDefaultBrandKit();
  }

  const supabaseData = await fetchFromSupabase();
  if (!supabaseData) {
    console.log('[BrandKit] No brand kit in Supabase, returning default');
    return getDefaultBrandKit();
  }

  // Cache the logo locally if available
  let localLogoUri: string | undefined;
  if (supabaseData.logo_url) {
    const cachedPath = await cacheLogoLocally(supabaseData.logo_url);
    if (cachedPath) {
      localLogoUri = cachedPath;
    }
  }

  // Convert to BrandKit and cache locally
  const brandKit = mapRowToBrandKit(supabaseData, localLogoUri);
  await saveToLocalCache(brandKit);

  console.log('[BrandKit] Loaded from Supabase and cached locally');
  return brandKit;
}

/**
 * Sync local brand kit with Supabase
 * Called in background to ensure data consistency
 */
export async function syncBrandKit(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return; // Not authenticated, nothing to sync
  }

  const [localData, supabaseRow] = await Promise.all([
    loadFromLocalCache(),
    fetchFromSupabase(),
  ]);

  if (!localData && !supabaseRow) {
    return; // Nothing to sync
  }

  // Determine which is newer
  const localTime = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
  const supabaseTime = supabaseRow?.updated_at ? new Date(supabaseRow.updated_at).getTime() : 0;

  if (supabaseTime > localTime && supabaseRow) {
    // Supabase is newer - update local cache
    console.log('[BrandKit] Supabase is newer, updating local cache');
    
    let localLogoUri: string | undefined;
    if (supabaseRow.logo_url) {
      const cachedPath = await cacheLogoLocally(supabaseRow.logo_url);
      if (cachedPath) {
        localLogoUri = cachedPath;
      }
    }

    const brandKit = mapRowToBrandKit(supabaseRow, localLogoUri);
    await saveToLocalCache(brandKit);
  } else if (localData && localTime > supabaseTime) {
    // Local is newer - should rarely happen, but handle it
    console.log('[BrandKit] Local is newer, updating Supabase');
    await upsertToSupabase({
      logo_url: localData.logoUri, // This might be local path, needs handling
      logo_width: localData.logoWidth || null,
      logo_height: localData.logoHeight || null,
      primary_color: localData.primaryColor || null,
      apply_logo_automatically: localData.applyLogoAutomatically,
      add_disclaimer: localData.addDisclaimer,
    });
  }
}

/**
 * Save a logo image to the brand kit
 * Uploads to Supabase first, then caches locally
 */
export async function saveBrandLogo(sourceUri: string): Promise<BrandKit> {
  console.log('[BrandKit] ========== Starting logo save ==========');
  console.log('[BrandKit] Source URI:', sourceUri.substring(0, 100) + '...');
  
  try {
    // Step 1: Ensure local directory exists
    await ensureBrandKitDirectory();
    console.log('[BrandKit] Step 1: Directory ready');

    // Step 2: Normalize the image URI
    console.log('[BrandKit] Step 2: Normalizing image...');
    const normalized = await normalizeImageUri(sourceUri);
    console.log('[BrandKit] Step 2: Image normalized');
    console.log('[BrandKit] Dimensions:', normalized.width, 'x', normalized.height);

    // Step 3: Check if user is authenticated
    const userId = await getCurrentUserId();
    let logoUrl: string | undefined;
    let localLogoPath: string | undefined;

    if (userId) {
      // Step 4: Upload to Supabase Storage
      console.log('[BrandKit] Step 3: Uploading to Supabase Storage...');
      logoUrl = await uploadLogoToStorage(normalized.uri) || undefined;
      if (logoUrl) {
        console.log('[BrandKit] Step 3: Uploaded to Supabase');
      } else {
        console.warn('[BrandKit] Step 3: Supabase upload failed, continuing with local-only');
      }

      // Step 5: Save metadata to Supabase database
      console.log('[BrandKit] Step 4: Saving metadata to Supabase...');
      await upsertToSupabase({
        logo_url: logoUrl || null,
        logo_width: normalized.width,
        logo_height: normalized.height,
      });
      console.log('[BrandKit] Step 4: Metadata saved to Supabase');
    } else {
      console.log('[BrandKit] User not authenticated, saving locally only');
    }

    // Step 6: Cache logo locally
    console.log('[BrandKit] Step 5: Caching locally...');
    const logoPath = getLogoPath();
    
    // Delete existing local logo
    const existingInfo = await FileSystem.getInfoAsync(logoPath);
    if (existingInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }

    // Copy normalized image to local cache
    try {
      await FileSystem.copyAsync({
        from: normalized.uri,
        to: logoPath,
      });
      localLogoPath = logoPath;
      console.log('[BrandKit] Step 5: Logo cached locally');
    } catch (copyError) {
      console.warn('[BrandKit] Copy failed, trying move:', copyError);
      try {
        await FileSystem.moveAsync({
          from: normalized.uri,
          to: logoPath,
        });
        localLogoPath = logoPath;
        console.log('[BrandKit] Step 5: Logo moved to local cache');
      } catch (moveError) {
        console.error('[BrandKit] Local caching failed:', moveError);
        // Continue anyway if we have Supabase URL
        if (!logoUrl) {
          throw new Error('Failed to save logo locally and no Supabase upload');
        }
      }
    }

    // Step 7: Update local cache
    const currentBrandKit = await loadFromLocalCache() || getDefaultBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      logoUri: localLogoPath || logoUrl,
      logoWidth: normalized.width,
      logoHeight: normalized.height,
      updatedAt: new Date().toISOString(),
    };

    await saveToLocalCache(updatedBrandKit);
    console.log('[BrandKit] ========== Logo save completed ==========');

    return updatedBrandKit;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] ========== Logo save FAILED ==========');
    console.error('[BrandKit] Error:', errorMessage);
    throw error;
  }
}

/**
 * Get the current brand logo URI
 */
export async function getBrandLogo(): Promise<{ uri: string; width: number; height: number } | null> {
  try {
    const brandKit = await loadBrandKit();
    
    if (!brandKit.logoUri) {
      return null;
    }

    // If it's a local file, verify it exists
    if (brandKit.logoUri.startsWith('file://')) {
      const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
      if (!fileInfo.exists) {
        console.warn('[BrandKit] Local logo file not found');
        return null;
      }
    }

    return {
      uri: brandKit.logoUri,
      width: brandKit.logoWidth || 200,
      height: brandKit.logoHeight || 200,
    };
  } catch (error) {
    console.error('[BrandKit] Failed to get brand logo:', error);
    return null;
  }
}

/**
 * Delete the brand logo
 */
export async function deleteBrandLogo(): Promise<BrandKit> {
  console.log('[BrandKit] ========== Deleting logo ==========');
  
  try {
    // Delete from Supabase Storage
    await deleteLogoFromStorage();

    // Update Supabase database
    const userId = await getCurrentUserId();
    if (userId) {
      await upsertToSupabase({
        logo_url: null,
        logo_width: null,
        logo_height: null,
      });
    }

    // Clear local cache
    const logoPath = getLogoPath();
    const fileInfo = await FileSystem.getInfoAsync(logoPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
      console.log('[BrandKit] Local logo file deleted');
    }

    // Update local brand kit
    const currentBrandKit = await loadFromLocalCache() || getDefaultBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      logoUri: undefined,
      logoWidth: undefined,
      logoHeight: undefined,
      updatedAt: new Date().toISOString(),
    };

    await saveToLocalCache(updatedBrandKit);
    console.log('[BrandKit] ========== Logo deleted ==========');

    return updatedBrandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to delete brand logo:', error);
    throw error;
  }
}

/**
 * Update brand kit settings (not logo)
 */
export async function updateBrandKitSettings(
  settings: Partial<Omit<BrandKit, 'logoUri' | 'logoWidth' | 'logoHeight'>>
): Promise<BrandKit> {
  try {
    // Update Supabase
    const userId = await getCurrentUserId();
    if (userId) {
      await upsertToSupabase({
        primary_color: settings.primaryColor || null,
        apply_logo_automatically: settings.applyLogoAutomatically ?? false,
        add_disclaimer: settings.addDisclaimer ?? false,
      });
    }

    // Update local cache
    const currentBrandKit = await loadFromLocalCache() || getDefaultBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    await saveToLocalCache(updatedBrandKit);
    return updatedBrandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to update brand kit settings:', error);
    throw error;
  }
}

/**
 * Clear all brand kit data
 */
export async function clearBrandKit(): Promise<void> {
  try {
    // Delete from Supabase
    const userId = await getCurrentUserId();
    if (userId) {
      await deleteLogoFromStorage();
      
      const { error } = await supabase
        .from('brand_kits')
        .delete()
        .eq('user_id', userId);
      
      if (error) {
        console.error('[BrandKit] Supabase delete error:', error);
      }
    }

    // Clear local cache
    await clearLocalCache();

    console.log('[BrandKit] Brand kit cleared');
  } catch (error) {
    console.error('[BrandKit] Failed to clear brand kit:', error);
    throw error;
  }
}

/**
 * Force refresh brand kit from Supabase
 * Useful when user signs in or wants to restore from cloud
 */
export async function refreshBrandKitFromCloud(): Promise<BrandKit> {
  console.log('[BrandKit] Refreshing from cloud...');
  
  const userId = await getCurrentUserId();
  if (!userId) {
    console.log('[BrandKit] User not authenticated');
    return getDefaultBrandKit();
  }

  const supabaseData = await fetchFromSupabase();
  if (!supabaseData) {
    console.log('[BrandKit] No brand kit in cloud');
    return getDefaultBrandKit();
  }

  // Cache the logo locally
  let localLogoUri: string | undefined;
  if (supabaseData.logo_url) {
    const cachedPath = await cacheLogoLocally(supabaseData.logo_url);
    if (cachedPath) {
      localLogoUri = cachedPath;
    }
  }

  const brandKit = mapRowToBrandKit(supabaseData, localLogoUri);
  await saveToLocalCache(brandKit);

  console.log('[BrandKit] Refreshed from cloud');
  return brandKit;
}
