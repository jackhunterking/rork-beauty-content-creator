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

// ============================================
// Error Types for Better Error Handling
// ============================================

export type BrandKitErrorCode = 
  | 'IMAGE_PROCESSING_FAILED'
  | 'STORAGE_UPLOAD_FAILED'
  | 'DATABASE_ERROR'
  | 'LOCAL_CACHE_FAILED'
  | 'NOT_AUTHENTICATED'
  | 'NETWORK_ERROR'
  | 'FILE_READ_ERROR'
  | 'UNKNOWN_ERROR';

export class BrandKitError extends Error {
  code: BrandKitErrorCode;
  details?: string;
  
  constructor(code: BrandKitErrorCode, message: string, details?: string) {
    super(message);
    this.name = 'BrandKitError';
    this.code = code;
    this.details = details;
  }
  
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case 'IMAGE_PROCESSING_FAILED':
        return 'Failed to process the image. Please try a different photo.';
      case 'STORAGE_UPLOAD_FAILED':
        return 'Failed to upload logo to cloud. Logo saved locally only.';
      case 'DATABASE_ERROR':
        return 'Failed to save logo settings. Please try again.';
      case 'LOCAL_CACHE_FAILED':
        return 'Failed to save logo locally. Please try again.';
      case 'NOT_AUTHENTICATED':
        return 'Please sign in to save your logo to the cloud.';
      case 'NETWORK_ERROR':
        return 'Network error. Logo saved locally, will sync when online.';
      case 'FILE_READ_ERROR':
        return 'Could not read the selected image. Please try another photo.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }
}

// Result type for operations that can partially succeed
export interface BrandKitSaveResult {
  success: boolean;
  brandKit: BrandKit;
  savedToCloud: boolean;
  savedLocally: boolean;
  warning?: string;
  error?: BrandKitError;
}

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
  try {
    const dirInfo = await FileSystem.getInfoAsync(BRAND_KIT_DIRECTORY);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(BRAND_KIT_DIRECTORY, { intermediates: true });
      console.log('[BrandKit] Created brand kit directory');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Failed to create directory:', errorMsg);
    throw new BrandKitError(
      'LOCAL_CACHE_FAILED',
      'Failed to create storage directory',
      errorMsg
    );
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
 * Detect if a file is an SVG based on URI or content
 */
function isSvgFile(uri: string): boolean {
  const lowerUri = uri.toLowerCase();
  return lowerUri.endsWith('.svg') || lowerUri.includes('svg');
}

/**
 * Normalize an image URI by processing it through ImageManipulator
 * This handles various URI schemes (ph://, file://, content://) and
 * returns a local file:// URI that can be reliably processed
 * 
 * Note: SVG files cannot be processed by ImageManipulator and will be
 * handled separately with estimated dimensions
 */
async function normalizeImageUri(sourceUri: string): Promise<{ uri: string; width: number; height: number }> {
  console.log('[BrandKit] Normalizing image URI:', sourceUri.substring(0, 100) + '...');
  console.log('[BrandKit] URI scheme:', sourceUri.split(':')[0]);
  
  // Check if it's an SVG - ImageManipulator can't process SVGs
  if (isSvgFile(sourceUri)) {
    console.log('[BrandKit] Detected SVG file, skipping ImageManipulator processing');
    // For SVGs, we'll use the original URI and default dimensions
    // SVGs are scalable, so we use a reasonable default
    return {
      uri: sourceUri,
      width: 200,
      height: 200,
    };
  }
  
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
    
    // If ImageManipulator fails, it might be an unsupported format
    // Try to use the original file if it exists
    console.log('[BrandKit] Attempting to use original file as fallback...');
    const fileInfo = await FileSystem.getInfoAsync(sourceUri);
    if (fileInfo.exists) {
      console.log('[BrandKit] Using original file with default dimensions');
      return {
        uri: sourceUri,
        width: 200,
        height: 200,
      };
    }
    
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
 * Uses .maybeSingle() instead of .single() to avoid 406 errors when no row exists
 */
async function fetchFromSupabase(): Promise<BrandKitRow | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[BrandKit] User not authenticated, skipping Supabase fetch');
      return null;
    }

    // Use .maybeSingle() to gracefully handle 0 rows (returns null instead of error)
    const { data, error } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      // Log the full error for debugging
      console.error('[BrandKit] Supabase fetch error:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) {
      console.log('[BrandKit] No brand kit found in Supabase for user');
      return null;
    }

    return data as BrandKitRow;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Failed to fetch from Supabase:', errorMsg);
    return null;
  }
}

/**
 * Upsert brand kit in Supabase database
 * Uses .maybeSingle() for safer handling of edge cases
 */
async function upsertToSupabase(brandKit: Partial<BrandKitRow>): Promise<BrandKitRow | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.warn('[BrandKit] User not authenticated, skipping Supabase upsert');
      return null;
    }

    console.log('[BrandKit] Upserting to Supabase for user:', userId);
    console.log('[BrandKit] Upsert data:', JSON.stringify(brandKit, null, 2));

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert({
        user_id: userId,
        ...brandKit,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[BrandKit] Supabase upsert error:', JSON.stringify(error, null, 2));
      return null;
    }

    if (!data) {
      console.warn('[BrandKit] Upsert completed but no data returned');
      return null;
    }

    console.log('[BrandKit] Saved to Supabase successfully');
    return data as BrandKitRow;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Failed to upsert to Supabase:', errorMsg);
    return null;
  }
}

/**
 * Detect MIME type from file URI or extension
 */
function detectMimeType(uri: string): { mimeType: string; extension: string } {
  const lowerUri = uri.toLowerCase();
  
  if (lowerUri.endsWith('.svg') || lowerUri.includes('svg')) {
    return { mimeType: 'image/svg+xml', extension: 'svg' };
  }
  if (lowerUri.endsWith('.png')) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (lowerUri.endsWith('.webp')) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (lowerUri.endsWith('.gif')) {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  // Default to JPEG (most common, and ImageManipulator outputs JPEG)
  return { mimeType: 'image/jpeg', extension: 'jpg' };
}

/**
 * Upload logo to Supabase Storage
 * Now throws BrandKitError instead of returning null for better error handling
 * Supports multiple image formats: JPEG, PNG, WebP, SVG, GIF
 */
async function uploadLogoToStorage(localUri: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new BrandKitError(
      'NOT_AUTHENTICATED',
      'User not authenticated',
      'Cannot upload logo without authentication'
    );
  }

  console.log('[BrandKit] Reading file for upload:', localUri.substring(0, 80) + '...');
  
  // Step 1: Verify file exists
  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) {
    throw new BrandKitError(
      'FILE_READ_ERROR',
      'Source file does not exist',
      `File not found at: ${localUri.substring(0, 80)}...`
    );
  }
  console.log('[BrandKit] File exists, size:', (fileInfo as any).size || 'unknown');

  // Step 2: Detect MIME type
  const { mimeType, extension } = detectMimeType(localUri);
  console.log('[BrandKit] Detected MIME type:', mimeType, 'extension:', extension);

  // Step 3: Read the file as base64
  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('[BrandKit] File read as base64, length:', base64.length);
  } catch (readError) {
    const errorMessage = readError instanceof Error ? readError.message : 'Unknown error';
    console.error('[BrandKit] Failed to read file as base64:', errorMessage);
    throw new BrandKitError(
      'FILE_READ_ERROR',
      'Failed to read image file',
      errorMessage
    );
  }

  // Step 4: Upload to Supabase Storage with correct MIME type
  const filePath = `${userId}/logo.${extension}`;
  console.log('[BrandKit] Uploading to path:', filePath);
  
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = decode(base64);
    console.log('[BrandKit] Base64 decoded, buffer size:', arrayBuffer.byteLength);
  } catch (decodeError) {
    const errorMessage = decodeError instanceof Error ? decodeError.message : 'Unknown error';
    console.error('[BrandKit] Failed to decode base64:', errorMessage);
    throw new BrandKitError(
      'FILE_READ_ERROR',
      'Failed to decode image data',
      errorMessage
    );
  }

  console.log('[BrandKit] Uploading with MIME type:', mimeType);
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[BrandKit] Storage upload error:', JSON.stringify(uploadError, null, 2));
    
    // Check for specific error types
    const errorMessage = uploadError.message || 'Unknown storage error';
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      throw new BrandKitError(
        'NETWORK_ERROR',
        'Network error during upload',
        errorMessage
      );
    }
    
    throw new BrandKitError(
      'STORAGE_UPLOAD_FAILED',
      'Failed to upload logo to storage',
      `Error: ${errorMessage}, Code: ${(uploadError as any).statusCode || 'N/A'}`
    );
  }

  console.log('[BrandKit] Upload successful:', uploadData?.path);

  // Step 4: Get signed URL (private bucket)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

  if (urlError || !urlData?.signedUrl) {
    console.error('[BrandKit] Failed to get signed URL:', urlError);
    throw new BrandKitError(
      'STORAGE_UPLOAD_FAILED',
      'Failed to generate access URL for logo',
      urlError?.message || 'No signed URL returned'
    );
  }

  console.log('[BrandKit] Logo uploaded successfully, signed URL generated');
  return urlData.signedUrl;
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
 * CRITICAL: Saves locally FIRST, then uploads to cloud
 * This ensures the temp file from ImageManipulator isn't cleaned up before we can use it
 * Returns detailed result for better UI feedback
 */
export async function saveBrandLogo(sourceUri: string): Promise<BrandKitSaveResult> {
  console.log('[BrandKit] ========== Starting logo save ==========');
  console.log('[BrandKit] Source URI:', sourceUri.substring(0, 100) + '...');
  
  let savedToCloud = false;
  let savedLocally = false;
  let warning: string | undefined;
  let logoUrl: string | undefined;
  let localLogoPath: string | undefined;
  
  try {
    // Step 1: Ensure local directory exists
    await ensureBrandKitDirectory();
    console.log('[BrandKit] Step 1: Directory ready');

    // Step 2: Normalize the image URI (convert ph://, content:// to file://)
    console.log('[BrandKit] Step 2: Normalizing image...');
    let normalized: { uri: string; width: number; height: number };
    try {
      normalized = await normalizeImageUri(sourceUri);
      console.log('[BrandKit] Step 2: Image normalized');
      console.log('[BrandKit] Dimensions:', normalized.width, 'x', normalized.height);
      console.log('[BrandKit] Normalized URI:', normalized.uri.substring(0, 100) + '...');
    } catch (normalizeError) {
      const details = normalizeError instanceof Error ? normalizeError.message : 'Unknown error';
      console.error('[BrandKit] Step 2 FAILED:', details);
      throw new BrandKitError(
        'IMAGE_PROCESSING_FAILED',
        'Failed to process the selected image',
        details
      );
    }

    // Step 3: IMMEDIATELY save locally (before temp file can be cleaned up)
    // This is critical - ImageManipulator creates temp files that may be cleaned up
    console.log('[BrandKit] Step 3: Saving locally FIRST (critical step)...');
    const logoPath = getLogoPath();
    
    // Delete existing local logo
    try {
      const existingInfo = await FileSystem.getInfoAsync(logoPath);
      if (existingInfo.exists) {
        await FileSystem.deleteAsync(logoPath, { idempotent: true });
        console.log('[BrandKit] Step 3: Deleted existing logo');
      }
    } catch (deleteError) {
      console.warn('[BrandKit] Step 3: Could not delete existing file:', deleteError);
    }

    // Verify the normalized file exists before copying
    const normalizedFileInfo = await FileSystem.getInfoAsync(normalized.uri);
    console.log('[BrandKit] Step 3: Normalized file exists:', normalizedFileInfo.exists);
    if (!normalizedFileInfo.exists) {
      throw new BrandKitError(
        'FILE_READ_ERROR',
        'Processed image file not found',
        'The image may have been cleaned up. Please try again.'
      );
    }

    // Copy/move the normalized image to permanent local storage
    try {
      await FileSystem.copyAsync({
        from: normalized.uri,
        to: logoPath,
      });
      localLogoPath = logoPath;
      savedLocally = true;
      console.log('[BrandKit] Step 3: Logo saved locally via copy');
    } catch (copyError) {
      console.warn('[BrandKit] Step 3: Copy failed, trying move:', copyError);
      try {
        await FileSystem.moveAsync({
          from: normalized.uri,
          to: logoPath,
        });
        localLogoPath = logoPath;
        savedLocally = true;
        console.log('[BrandKit] Step 3: Logo saved locally via move');
      } catch (moveError) {
        const errorMsg = moveError instanceof Error ? moveError.message : 'Unknown error';
        console.error('[BrandKit] Step 3 FAILED: Local save failed:', errorMsg);
        throw new BrandKitError(
          'LOCAL_CACHE_FAILED',
          'Failed to save logo locally',
          errorMsg
        );
      }
    }

    // Verify the local file was saved successfully
    const savedFileInfo = await FileSystem.getInfoAsync(logoPath);
    if (!savedFileInfo.exists) {
      throw new BrandKitError(
        'LOCAL_CACHE_FAILED',
        'Failed to save logo locally',
        'File was copied but verification failed'
      );
    }
    console.log('[BrandKit] Step 3: Local save verified, size:', (savedFileInfo as any).size || 'unknown');

    // Step 4: Check if user is authenticated
    const userId = await getCurrentUserId();
    console.log('[BrandKit] Step 4: Auth check - userId:', userId ? 'present' : 'null');

    // Step 5: Upload to Supabase (if authenticated) - use the LOCAL file, not the temp file
    if (userId) {
      console.log('[BrandKit] Step 5: Uploading to Supabase Storage...');
      try {
        // Upload from the LOCAL file (guaranteed to exist), not the temp normalized file
        logoUrl = await uploadLogoToStorage(localLogoPath);
        savedToCloud = true;
        console.log('[BrandKit] Step 5: Uploaded to Supabase successfully');
        console.log('[BrandKit] Step 5: Logo URL:', logoUrl?.substring(0, 100) + '...');
      } catch (uploadError) {
        // Log the detailed error but don't fail - we already saved locally
        if (uploadError instanceof BrandKitError) {
          console.warn('[BrandKit] Step 5: Cloud upload failed:', uploadError.code, uploadError.details);
          warning = uploadError.getUserFriendlyMessage();
        } else {
          const errorMsg = uploadError instanceof Error ? uploadError.message : 'Unknown error';
          console.warn('[BrandKit] Step 5: Cloud upload failed:', errorMsg);
          warning = 'Cloud upload failed. Logo saved locally only.';
        }
      }

      // Step 6: Save metadata to Supabase database
      if (savedToCloud && logoUrl) {
        console.log('[BrandKit] Step 6: Saving metadata to Supabase...');
        try {
          const dbResult = await upsertToSupabase({
            logo_url: logoUrl,
            logo_width: normalized.width,
            logo_height: normalized.height,
          });
          if (dbResult) {
            console.log('[BrandKit] Step 6: Metadata saved to Supabase');
          } else {
            console.warn('[BrandKit] Step 6: Database upsert returned null');
            if (!warning) {
              warning = 'Logo uploaded but settings may not be synced.';
            }
          }
        } catch (dbError) {
          const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
          console.error('[BrandKit] Step 6: Database error:', errorMsg);
          if (!warning) {
            warning = 'Logo uploaded but settings failed to save.';
          }
        }
      }
    }

    // Step 7: Update local brand kit cache
    console.log('[BrandKit] Step 7: Updating local brand kit metadata...');
    const currentBrandKit = await loadFromLocalCache() || getDefaultBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      logoUri: localLogoPath, // Always use local path - we saved locally first
      logoWidth: normalized.width,
      logoHeight: normalized.height,
      updatedAt: new Date().toISOString(),
    };

    await saveToLocalCache(updatedBrandKit);
    console.log('[BrandKit] Step 7: Local metadata saved');
    console.log('[BrandKit] ========== Logo save completed ==========');
    console.log('[BrandKit] Result: savedToCloud=', savedToCloud, ', savedLocally=', savedLocally);

    return {
      success: true,
      brandKit: updatedBrandKit,
      savedToCloud,
      savedLocally,
      warning,
    };
  } catch (error) {
    console.error('[BrandKit] ========== Logo save FAILED ==========');
    
    if (error instanceof BrandKitError) {
      console.error('[BrandKit] Error code:', error.code);
      console.error('[BrandKit] Error message:', error.message);
      console.error('[BrandKit] Error details:', error.details);
      
      return {
        success: false,
        brandKit: getDefaultBrandKit(),
        savedToCloud,
        savedLocally,
        error,
      };
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Unexpected error:', errorMessage);
    
    return {
      success: false,
      brandKit: getDefaultBrandKit(),
      savedToCloud,
      savedLocally,
      error: new BrandKitError('UNKNOWN_ERROR', 'An unexpected error occurred', errorMessage),
    };
  }
}

/**
 * Legacy wrapper for saveBrandLogo that throws errors
 * Use saveBrandLogo directly for better error handling
 * @deprecated Use saveBrandLogo instead which returns BrandKitSaveResult
 */
export async function saveBrandLogoLegacy(sourceUri: string): Promise<BrandKit> {
  const result = await saveBrandLogo(sourceUri);
  if (!result.success && result.error) {
    throw result.error;
  }
  return result.brandKit;
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

// ============================================
// Diagnostic Functions
// ============================================

export interface BrandKitDiagnostics {
  timestamp: string;
  authentication: {
    isAuthenticated: boolean;
    userId: string | null;
  };
  localStorage: {
    directoryExists: boolean;
    directoryPath: string;
    logoFileExists: boolean;
    logoFilePath: string;
    asyncStorageHasData: boolean;
  };
  supabase: {
    canConnect: boolean;
    bucketExists: boolean;
    hasExistingBrandKit: boolean;
    hasExistingLogo: boolean;
    error?: string;
  };
}

/**
 * Run diagnostics to help debug brand kit issues
 * Returns detailed status of all components
 */
export async function runBrandKitDiagnostics(): Promise<BrandKitDiagnostics> {
  console.log('[BrandKit] ========== Running diagnostics ==========');
  
  const diagnostics: BrandKitDiagnostics = {
    timestamp: new Date().toISOString(),
    authentication: {
      isAuthenticated: false,
      userId: null,
    },
    localStorage: {
      directoryExists: false,
      directoryPath: BRAND_KIT_DIRECTORY,
      logoFileExists: false,
      logoFilePath: getLogoPath(),
      asyncStorageHasData: false,
    },
    supabase: {
      canConnect: false,
      bucketExists: false,
      hasExistingBrandKit: false,
      hasExistingLogo: false,
    },
  };

  // Check authentication
  try {
    const userId = await getCurrentUserId();
    diagnostics.authentication.userId = userId;
    diagnostics.authentication.isAuthenticated = !!userId;
    console.log('[BrandKit] Auth check:', diagnostics.authentication.isAuthenticated ? 'authenticated' : 'not authenticated');
  } catch (error) {
    console.error('[BrandKit] Auth check failed:', error);
  }

  // Check local storage
  try {
    const dirInfo = await FileSystem.getInfoAsync(BRAND_KIT_DIRECTORY);
    diagnostics.localStorage.directoryExists = dirInfo.exists;
    
    const logoInfo = await FileSystem.getInfoAsync(getLogoPath());
    diagnostics.localStorage.logoFileExists = logoInfo.exists;
    
    const asyncData = await AsyncStorage.getItem(BRAND_KIT_STORAGE_KEY);
    diagnostics.localStorage.asyncStorageHasData = !!asyncData;
    
    console.log('[BrandKit] Local storage check:', {
      dir: diagnostics.localStorage.directoryExists,
      logo: diagnostics.localStorage.logoFileExists,
      async: diagnostics.localStorage.asyncStorageHasData,
    });
  } catch (error) {
    console.error('[BrandKit] Local storage check failed:', error);
  }

  // Check Supabase connection and data
  if (diagnostics.authentication.isAuthenticated) {
    try {
      // Test connection by listing buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      
      if (bucketsError) {
        diagnostics.supabase.error = bucketsError.message;
        console.error('[BrandKit] Supabase bucket list failed:', bucketsError);
      } else {
        diagnostics.supabase.canConnect = true;
        diagnostics.supabase.bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET) || false;
        console.log('[BrandKit] Supabase connection OK, bucket exists:', diagnostics.supabase.bucketExists);
      }

      // Check for existing brand kit in database
      const existingKit = await fetchFromSupabase();
      diagnostics.supabase.hasExistingBrandKit = !!existingKit;
      diagnostics.supabase.hasExistingLogo = !!existingKit?.logo_url;
      console.log('[BrandKit] Existing brand kit:', diagnostics.supabase.hasExistingBrandKit);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      diagnostics.supabase.error = errorMsg;
      console.error('[BrandKit] Supabase check failed:', errorMsg);
    }
  }

  console.log('[BrandKit] ========== Diagnostics complete ==========');
  console.log('[BrandKit] Full diagnostics:', JSON.stringify(diagnostics, null, 2));
  
  return diagnostics;
}
