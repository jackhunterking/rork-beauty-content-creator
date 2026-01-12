/**
 * Brand Kit Service
 * 
 * Manages brand assets like logo for Pro overlay features.
 * Stores logo locally using expo-file-system and metadata in AsyncStorage.
 * Optionally syncs to Supabase Storage for cloud backup.
 */

import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BrandKit } from '@/types';
import { supabase } from '@/lib/supabase';
import * as ImageManipulator from 'expo-image-manipulator';

// Storage keys
const BRAND_KIT_STORAGE_KEY = '@beauty_app_brand_kit';
const BRAND_LOGO_FILENAME = 'brand_logo.png';

// Directory for brand assets
const BRAND_KIT_DIRECTORY = `${FileSystem.documentDirectory}brand-kit/`;

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
 * Load the brand kit configuration from storage
 */
export async function loadBrandKit(): Promise<BrandKit> {
  try {
    const stored = await AsyncStorage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!stored) {
      return getDefaultBrandKit();
    }

    const brandKit = JSON.parse(stored) as BrandKit;

    // Verify the logo file still exists
    if (brandKit.logoUri) {
      const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
      if (!fileInfo.exists) {
        console.warn('[BrandKit] Logo file not found, clearing reference');
        brandKit.logoUri = undefined;
        brandKit.logoWidth = undefined;
        brandKit.logoHeight = undefined;
      }
    }

    return brandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to load brand kit:', error);
    return getDefaultBrandKit();
  }
}

/**
 * Save the brand kit configuration to storage
 */
export async function saveBrandKit(brandKit: BrandKit): Promise<void> {
  try {
    const updated: BrandKit = {
      ...brandKit,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(updated));
    console.log('[BrandKit] Saved brand kit configuration');
  } catch (error) {
    console.error('[BrandKit] Failed to save brand kit:', error);
    throw error;
  }
}

/**
 * Get image dimensions from a file URI
 */
async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  try {
    // Use ImageManipulator to get dimensions
    const result = await ImageManipulator.manipulateAsync(uri, [], { format: ImageManipulator.SaveFormat.PNG });
    return { width: result.width, height: result.height };
  } catch (error) {
    console.error('[BrandKit] Failed to get image dimensions:', error);
    // Return default dimensions if we can't read the image
    return { width: 200, height: 200 };
  }
}

/**
 * Save a logo image to the brand kit
 * 
 * @param sourceUri - The source URI of the logo image (from picker or camera)
 * @returns The saved brand kit with the new logo
 */
export async function saveBrandLogo(sourceUri: string): Promise<BrandKit> {
  try {
    await ensureBrandKitDirectory();

    // Get image dimensions before saving
    const dimensions = await getImageDimensions(sourceUri);

    // Copy the logo to our brand kit directory
    const logoPath = getLogoPath();
    
    // Delete existing logo if present
    const existingInfo = await FileSystem.getInfoAsync(logoPath);
    if (existingInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }

    // Copy new logo
    await FileSystem.copyAsync({
      from: sourceUri,
      to: logoPath,
    });

    console.log('[BrandKit] Logo saved to:', logoPath);

    // Update brand kit configuration
    const currentBrandKit = await loadBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      logoUri: logoPath,
      logoWidth: dimensions.width,
      logoHeight: dimensions.height,
    };

    await saveBrandKit(updatedBrandKit);

    return updatedBrandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to save brand logo:', error);
    throw error;
  }
}

/**
 * Get the current brand logo URI
 * Returns undefined if no logo is set
 */
export async function getBrandLogo(): Promise<{ uri: string; width: number; height: number } | null> {
  try {
    const brandKit = await loadBrandKit();
    
    if (!brandKit.logoUri) {
      return null;
    }

    // Verify file exists
    const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
    if (!fileInfo.exists) {
      console.warn('[BrandKit] Logo file not found');
      return null;
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
  try {
    const brandKit = await loadBrandKit();

    // Delete the logo file if it exists
    if (brandKit.logoUri) {
      const fileInfo = await FileSystem.getInfoAsync(brandKit.logoUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(brandKit.logoUri, { idempotent: true });
        console.log('[BrandKit] Logo file deleted');
      }
    }

    // Update brand kit configuration
    const updatedBrandKit: BrandKit = {
      ...brandKit,
      logoUri: undefined,
      logoWidth: undefined,
      logoHeight: undefined,
    };

    await saveBrandKit(updatedBrandKit);

    return updatedBrandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to delete brand logo:', error);
    throw error;
  }
}

/**
 * Upload brand logo to Supabase Storage for cloud backup
 * Requires authenticated user
 */
export async function uploadBrandLogoToCloud(): Promise<string | null> {
  try {
    const brandKit = await loadBrandKit();
    
    if (!brandKit.logoUri) {
      console.warn('[BrandKit] No logo to upload');
      return null;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[BrandKit] User not authenticated');
      return null;
    }

    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(brandKit.logoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Upload to Supabase Storage
    const filePath = `${user.id}/logo.png`;
    const { data, error } = await supabase.storage
      .from('brand-logos')
      .upload(filePath, decode(base64), {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      console.error('[BrandKit] Failed to upload to cloud:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('brand-logos')
      .getPublicUrl(filePath);

    console.log('[BrandKit] Logo uploaded to cloud:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[BrandKit] Failed to upload brand logo to cloud:', error);
    return null;
  }
}

/**
 * Download brand logo from Supabase Storage
 * Useful when restoring on a new device
 */
export async function downloadBrandLogoFromCloud(): Promise<BrandKit | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[BrandKit] User not authenticated');
      return null;
    }

    // Get the logo URL
    const filePath = `${user.id}/logo.png`;
    const { data: urlData } = supabase.storage
      .from('brand-logos')
      .getPublicUrl(filePath);

    // Download the file
    await ensureBrandKitDirectory();
    const logoPath = getLogoPath();

    const downloadResult = await FileSystem.downloadAsync(
      urlData.publicUrl,
      logoPath
    );

    if (downloadResult.status !== 200) {
      console.warn('[BrandKit] Logo not found in cloud');
      return null;
    }

    // Get dimensions
    const dimensions = await getImageDimensions(logoPath);

    // Update brand kit
    const currentBrandKit = await loadBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      logoUri: logoPath,
      logoWidth: dimensions.width,
      logoHeight: dimensions.height,
    };

    await saveBrandKit(updatedBrandKit);

    console.log('[BrandKit] Logo downloaded from cloud');
    return updatedBrandKit;
  } catch (error) {
    console.error('[BrandKit] Failed to download brand logo from cloud:', error);
    return null;
  }
}

/**
 * Update brand kit settings (not logo)
 */
export async function updateBrandKitSettings(settings: Partial<Omit<BrandKit, 'logoUri' | 'logoWidth' | 'logoHeight'>>): Promise<BrandKit> {
  try {
    const currentBrandKit = await loadBrandKit();
    const updatedBrandKit: BrandKit = {
      ...currentBrandKit,
      ...settings,
    };

    await saveBrandKit(updatedBrandKit);
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
    // Delete logo file
    const logoPath = getLogoPath();
    const fileInfo = await FileSystem.getInfoAsync(logoPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(logoPath, { idempotent: true });
    }

    // Clear storage
    await AsyncStorage.removeItem(BRAND_KIT_STORAGE_KEY);

    console.log('[BrandKit] Brand kit cleared');
  } catch (error) {
    console.error('[BrandKit] Failed to clear brand kit:', error);
    throw error;
  }
}

// Helper function to decode base64
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
