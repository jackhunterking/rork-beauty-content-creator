/**
 * Brand Kit Service - Simplified & Efficient
 * 
 * Handles logo upload with minimal overhead:
 * - Local storage as primary (fast)
 * - Cloud sync when authenticated (background)
 * - No excessive logging or diagnostics during normal flow
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandKit, BrandKitRow } from '@/types';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

// Constants
const BRAND_KIT_STORAGE_KEY = '@beauty_app_brand_kit';
const BRAND_KIT_DIRECTORY = `${FileSystem.documentDirectory}brand-kit/`;
const LOGO_FILENAME = 'brand_logo.jpg';
const STORAGE_BUCKET = 'brand-logos';
const ENCODING_BASE64 = 'base64' as const;

// ============================================
// Types
// ============================================

export interface BrandKitSaveResult {
  success: boolean;
  brandKit: BrandKit;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

function getDefaultBrandKit(): BrandKit {
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

async function getCurrentUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function ensureDirectory(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(BRAND_KIT_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(BRAND_KIT_DIRECTORY, { intermediates: true });
  }
}

// ============================================
// Local Storage (Primary - Fast)
// ============================================

async function saveToLocalCache(brandKit: BrandKit): Promise<void> {
  await AsyncStorage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify({
    ...brandKit,
    updatedAt: new Date().toISOString(),
  }));
}

async function loadFromLocalCache(): Promise<BrandKit | null> {
  const stored = await AsyncStorage.getItem(BRAND_KIT_STORAGE_KEY);
  if (!stored) return null;
  
  const brandKit = JSON.parse(stored) as BrandKit;
  
  // Verify logo file exists
  if (brandKit.logoUri) {
    const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
    if (!fileInfo.exists) {
      brandKit.logoUri = undefined;
      brandKit.logoWidth = undefined;
      brandKit.logoHeight = undefined;
    }
  }
  
  return brandKit;
}

// ============================================
// Cloud Storage (Secondary - Background)
// ============================================

async function uploadToCloud(localPath: string, width: number, height: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(localPath, {
      encoding: ENCODING_BASE64,
    });
    
    // Upload to storage
    const filePath = `${userId}/logo.jpg`;
    const arrayBuffer = decode(base64);
    
    await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    
    // Get signed URL
    const { data: urlData } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);
    
    if (urlData?.signedUrl) {
      // Save metadata to database
      await supabase
        .from('brand_kits')
        .upsert({
          user_id: userId,
          logo_url: urlData.signedUrl,
          logo_width: width,
          logo_height: height,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
    }
  } catch (error) {
    // Cloud upload failed - logo is still saved locally
    console.warn('[BrandKit] Cloud sync failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// ============================================
// Public API
// ============================================

/**
 * Load brand kit - from local cache (instant)
 */
export async function loadBrandKit(): Promise<BrandKit> {
  const cached = await loadFromLocalCache();
  return cached || getDefaultBrandKit();
}

/**
 * Save brand logo - optimized flow
 * 1. Process image with ImageManipulator
 * 2. Save locally (immediate feedback)
 * 3. Upload to cloud in background (if authenticated)
 */
export async function saveBrandLogo(sourceUri: string): Promise<BrandKitSaveResult> {
  try {
    // 1. Ensure directory exists
    await ensureDirectory();
    
    // 2. Process image (normalize and compress)
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: 500 } }], // Resize to reasonable size
      { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
    );
    
    const { uri: processedUri, width, height } = result;
    
    // 3. Read processed image as base64
    const base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: ENCODING_BASE64,
    });
    
    // 4. Write to local storage
    const logoPath = `${BRAND_KIT_DIRECTORY}${LOGO_FILENAME}`;
    
    // Delete existing file if present
    const existingInfo = await FileSystem.getInfoAsync(logoPath);
    if (existingInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }
    
    await FileSystem.writeAsStringAsync(logoPath, base64, {
      encoding: ENCODING_BASE64,
    });
    
    // 5. Update local cache
    const brandKit: BrandKit = {
      ...(await loadFromLocalCache() || getDefaultBrandKit()),
      logoUri: logoPath,
      logoWidth: width,
      logoHeight: height,
      updatedAt: new Date().toISOString(),
    };
    
    await saveToLocalCache(brandKit);
    
    // 6. Upload to cloud in background (don't wait)
    uploadToCloud(logoPath, width, height).catch(() => {
      // Silently fail - logo is saved locally
    });
    
    return { success: true, brandKit };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[BrandKit] Save failed:', errorMessage);
    return {
      success: false,
      brandKit: getDefaultBrandKit(),
      error: 'Failed to save logo. Please try again.',
    };
  }
}

/**
 * Delete brand logo
 */
export async function deleteBrandLogo(): Promise<BrandKit> {
  try {
    // Delete local file
    const logoPath = `${BRAND_KIT_DIRECTORY}${LOGO_FILENAME}`;
    const fileInfo = await FileSystem.getInfoAsync(logoPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }
    
    // Update local cache
    const brandKit = getDefaultBrandKit();
    await saveToLocalCache(brandKit);
    
    // Delete from cloud in background
    const userId = await getCurrentUserId();
    if (userId) {
      supabase.storage
        .from(STORAGE_BUCKET)
        .remove([`${userId}/logo.jpg`])
        .catch(() => {});
      
      supabase
        .from('brand_kits')
        .upsert({
          user_id: userId,
          logo_url: null,
          logo_width: null,
          logo_height: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
        .catch(() => {});
    }
    
    return brandKit;
  } catch (error) {
    console.error('[BrandKit] Delete failed:', error);
    throw error;
  }
}

/**
 * Get brand logo info
 */
export async function getBrandLogo(): Promise<{ uri: string; width: number; height: number } | null> {
  const brandKit = await loadBrandKit();
  
  if (!brandKit.logoUri) return null;
  
  // Verify file exists
  const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
  if (!fileInfo.exists) return null;
  
  return {
    uri: brandKit.logoUri,
    width: brandKit.logoWidth || 200,
    height: brandKit.logoHeight || 200,
  };
}

/**
 * Update brand kit settings (not logo)
 */
export async function updateBrandKitSettings(
  settings: Partial<Omit<BrandKit, 'logoUri' | 'logoWidth' | 'logoHeight'>>
): Promise<BrandKit> {
  const current = await loadFromLocalCache() || getDefaultBrandKit();
  const updated: BrandKit = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  
  await saveToLocalCache(updated);
  
  // Sync to cloud in background
  const userId = await getCurrentUserId();
  if (userId) {
    supabase
      .from('brand_kits')
      .upsert({
        user_id: userId,
        primary_color: settings.primaryColor || null,
        apply_logo_automatically: settings.applyLogoAutomatically ?? false,
        add_disclaimer: settings.addDisclaimer ?? false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .catch(() => {});
  }
  
  return updated;
}

/**
 * Sync from cloud (call on app start or sign-in)
 */
export async function syncFromCloud(): Promise<BrandKit> {
  const userId = await getCurrentUserId();
  if (!userId) return await loadBrandKit();
  
  try {
    const { data } = await supabase
      .from('brand_kits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!data?.logo_url) return await loadBrandKit();
    
    // Download logo from cloud
    await ensureDirectory();
    const logoPath = `${BRAND_KIT_DIRECTORY}${LOGO_FILENAME}`;
    
    const downloadResult = await FileSystem.downloadAsync(data.logo_url, logoPath);
    if (downloadResult.status !== 200) return await loadBrandKit();
    
    // Update local cache
    const brandKit: BrandKit = {
      logoUri: logoPath,
      logoWidth: data.logo_width || undefined,
      logoHeight: data.logo_height || undefined,
      primaryColor: data.primary_color || undefined,
      applyLogoAutomatically: data.apply_logo_automatically,
      addDisclaimer: data.add_disclaimer,
      updatedAt: data.updated_at,
    };
    
    await saveToLocalCache(brandKit);
    return brandKit;
    
  } catch (error) {
    console.warn('[BrandKit] Cloud sync failed:', error);
    return await loadBrandKit();
  }
}

// Legacy exports for backwards compatibility
export { getDefaultBrandKit };
export type { BrandKit };
