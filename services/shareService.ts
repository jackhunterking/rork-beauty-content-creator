import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';

/**
 * Share Service
 * 
 * Handles sharing images to social media and other apps.
 * Uses the native share sheet for cross-platform support.
 * 
 * Features:
 * - Share images via native share sheet
 * - Copy image to clipboard
 * - Share to specific apps (when available)
 * - Generate shareable text with images
 */

// ============================================
// Check Availability
// ============================================

/**
 * Check if sharing is available on this device
 */
export async function isSharingAvailable(): Promise<boolean> {
  return Sharing.isAvailableAsync();
}

// ============================================
// Share Functions
// ============================================

export interface ShareOptions {
  mimeType?: string;
  dialogTitle?: string;
  UTI?: string;  // iOS Uniform Type Identifier
}

export interface ShareResult {
  success: boolean;
  action?: 'shared' | 'dismissed' | 'unknown';
  error?: string;
}

/**
 * Share a local image file using the native share sheet
 * 
 * @param localPath - Path to local file (file:// URI)
 * @param options - Optional sharing options
 * @returns ShareResult
 */
export async function shareImage(
  localPath: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  try {
    // Check if sharing is available
    const isAvailable = await isSharingAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: 'Sharing is not available on this device',
      };
    }
    
    // Verify file exists
    const file = new File(localPath);
    if (!file.exists) {
      return {
        success: false,
        error: 'File not found',
      };
    }
    
    // Share the file
    await Sharing.shareAsync(localPath, {
      mimeType: options.mimeType || 'image/jpeg',
      dialogTitle: options.dialogTitle || 'Share your creation',
      UTI: options.UTI || 'public.jpeg',
    });
    
    // expo-sharing doesn't return result info
    return {
      success: true,
      action: 'unknown',  // We don't know if user actually shared or dismissed
    };
    
  } catch (error) {
    console.error('Share failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

/**
 * Download a remote image and share it
 * 
 * @param remoteUrl - URL of image to share
 * @param filename - Optional filename
 * @param options - Optional sharing options
 * @returns ShareResult
 */
export async function downloadAndShare(
  remoteUrl: string,
  filename?: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  try {
    // Generate local path
    const name = filename || `share_${Date.now()}`;
    const localPath = `${Paths.cache}/${name}.jpg`;
    
    // Download the file
    const downloadedFile = await File.downloadFileAsync(remoteUrl, new File(localPath));
    
    if (!downloadedFile.exists) {
      return {
        success: false,
        error: 'Download failed',
      };
    }
    
    // Share the downloaded file
    return shareImage(localPath, options);
    
  } catch (error) {
    console.error('Download and share failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download and share failed',
    };
  }
}

/**
 * Share multiple images
 * Note: On iOS, only single file sharing is supported by expo-sharing
 * On Android, we can potentially share multiple, but for consistency we share one
 */
export async function shareImages(
  localPaths: string[],
  options: ShareOptions = {}
): Promise<ShareResult> {
  if (localPaths.length === 0) {
    return {
      success: false,
      error: 'No images to share',
    };
  }
  
  // For now, share just the first image
  // Future: Could create a collage or zip for multiple images
  return shareImage(localPaths[0], options);
}

// ============================================
// Clipboard Functions
// ============================================

/**
 * Copy text to clipboard
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Copy image to clipboard (if supported)
 * Note: Image clipboard is limited on mobile platforms
 */
export async function copyImageToClipboard(localPath: string): Promise<boolean> {
  try {
    // expo-clipboard has setImageAsync but it's web-only
    // For mobile, we can only copy the path as text
    await Clipboard.setStringAsync(localPath);
    return true;
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    return false;
  }
}

// ============================================
// Social Media Helpers
// ============================================

/**
 * Generate Instagram-friendly caption
 */
export function generateInstagramCaption(hashtags: string[] = []): string {
  const defaultHashtags = [
    '#beforeandafter',
    '#transformation',
    '#beautycreator',
    '#skincare',
    '#beauty',
  ];
  
  const allHashtags = [...new Set([...hashtags, ...defaultHashtags])];
  return allHashtags.join(' ');
}

/**
 * Generate Twitter/X-friendly text
 */
export function generateTwitterText(caption?: string): string {
  return caption || 'Check out my transformation! ✨ #BeforeAndAfter';
}

/**
 * Prepare image for specific social platforms
 * Some platforms have specific requirements
 */
export interface SocialPlatformInfo {
  name: string;
  maxFileSize: number;  // in bytes
  supportedFormats: string[];
  aspectRatioRange: { min: number; max: number };
  notes: string;
}

export const SOCIAL_PLATFORMS: Record<string, SocialPlatformInfo> = {
  instagram: {
    name: 'Instagram',
    maxFileSize: 30 * 1024 * 1024, // 30MB
    supportedFormats: ['jpeg', 'png'],
    aspectRatioRange: { min: 0.8, max: 1.91 }, // 4:5 to 1.91:1
    notes: 'Square (1:1) works best for feed posts',
  },
  tiktok: {
    name: 'TikTok',
    maxFileSize: 287 * 1024 * 1024, // 287MB
    supportedFormats: ['mp4', 'jpeg', 'png'],
    aspectRatioRange: { min: 0.5625, max: 0.5625 }, // 9:16
    notes: 'Vertical format preferred',
  },
  facebook: {
    name: 'Facebook',
    maxFileSize: 25 * 1024 * 1024, // 25MB
    supportedFormats: ['jpeg', 'png', 'gif'],
    aspectRatioRange: { min: 0.5, max: 2 },
    notes: 'Square or horizontal works well',
  },
  twitter: {
    name: 'X (Twitter)',
    maxFileSize: 5 * 1024 * 1024, // 5MB for images
    supportedFormats: ['jpeg', 'png', 'gif', 'webp'],
    aspectRatioRange: { min: 0.5, max: 2 },
    notes: 'Horizontal 16:9 or square recommended',
  },
};

/**
 * Check if file meets platform requirements
 */
export async function checkPlatformRequirements(
  localPath: string,
  platform: keyof typeof SOCIAL_PLATFORMS
): Promise<{ valid: boolean; issues: string[] }> {
  const platformInfo = SOCIAL_PLATFORMS[platform];
  const issues: string[] = [];
  
  try {
    const file = new File(localPath);
    
    if (!file.exists) {
      return { valid: false, issues: ['File not found'] };
    }
    
    // Check file size
    const fileSize = file.size ?? 0;
    if (fileSize > platformInfo.maxFileSize) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      const maxMB = (platformInfo.maxFileSize / (1024 * 1024)).toFixed(0);
      issues.push(`File size (${sizeMB}MB) exceeds ${platformInfo.name} limit (${maxMB}MB)`);
    }
    
    // Check format
    const extension = localPath.split('.').pop()?.toLowerCase() || '';
    if (!platformInfo.supportedFormats.includes(extension)) {
      issues.push(`${extension.toUpperCase()} format may not be optimal for ${platformInfo.name}`);
    }
    
    return { valid: issues.length === 0, issues };
    
  } catch {
    return { valid: false, issues: ['Could not verify file'] };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Prepare a file with a nice filename for sharing
 */
export async function prepareForSharing(
  localPath: string,
  filename: string = 'beauty_creation'
): Promise<string> {
  const extension = localPath.split('.').pop() || 'jpg';
  const sharePath = `${Paths.cache}/${filename}_${Date.now()}.${extension}`;
  
  const sourceFile = new File(localPath);
  await sourceFile.copy(new File(sharePath));
  
  return sharePath;
}

/**
 * Clean up temporary share files
 */
export async function cleanupShareFiles(): Promise<void> {
  try {
    const { Directory } = await import('expo-file-system');
    const cacheDir = new Directory(Paths.cache);
    if (!cacheDir.exists) return;
    
    const items = cacheDir.list();
    
    for (const item of items) {
      if (item instanceof File && (item.name.startsWith('share_') || item.name.startsWith('beauty_creation_'))) {
        item.delete();
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup share files:', error);
  }
}

