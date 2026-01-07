import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export async function isSharingAvailable(): Promise<boolean> {
  return Sharing.isAvailableAsync();
}

export interface ShareOptions {
  mimeType?: string;
  dialogTitle?: string;
  UTI?: string;
}

export interface ShareResult {
  success: boolean;
  action?: 'shared' | 'dismissed' | 'unknown';
  error?: string;
}

export async function shareImage(
  localPath: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  try {
    const isAvailable = await isSharingAvailable();
    if (!isAvailable) {
      return {
        success: false,
        error: 'Sharing is not available on this device',
      };
    }
    
    if (Platform.OS !== 'web') {
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (!fileInfo.exists) {
        return {
          success: false,
          error: 'File not found',
        };
      }
    }
    
    await Sharing.shareAsync(localPath, {
      mimeType: options.mimeType || 'image/jpeg',
      dialogTitle: options.dialogTitle || 'Share your creation',
      UTI: options.UTI || 'public.jpeg',
    });
    
    return {
      success: true,
      action: 'unknown',
    };
    
  } catch (error) {
    console.error('Share failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Share failed',
    };
  }
}

export async function downloadAndShare(
  remoteUrl: string,
  filename?: string,
  options: ShareOptions = {}
): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Not supported on web' };
  }
  
  try {
    const name = filename || `share_${Date.now()}`;
    const localPath = `${FileSystem.cacheDirectory}${name}.jpg`;
    
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);
    
    if (downloadResult.status !== 200) {
      return {
        success: false,
        error: 'Download failed',
      };
    }
    
    return shareImage(downloadResult.uri, options);
    
  } catch (error) {
    console.error('Download and share failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download and share failed',
    };
  }
}

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
  
  return shareImage(localPaths[0], options);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export async function copyImageToClipboard(localPath: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(localPath);
    return true;
  } catch (error) {
    console.error('Failed to copy image to clipboard:', error);
    return false;
  }
}

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

export function generateTwitterText(caption?: string): string {
  return caption || 'Check out my transformation! ✨ #BeforeAndAfter';
}

export interface SocialPlatformInfo {
  name: string;
  maxFileSize: number;
  supportedFormats: string[];
  aspectRatioRange: { min: number; max: number };
  notes: string;
}

export const SOCIAL_PLATFORMS: Record<string, SocialPlatformInfo> = {
  instagram: {
    name: 'Instagram',
    maxFileSize: 30 * 1024 * 1024,
    supportedFormats: ['jpeg', 'png'],
    aspectRatioRange: { min: 0.8, max: 1.91 },
    notes: 'Square (1:1) works best for feed posts',
  },
  tiktok: {
    name: 'TikTok',
    maxFileSize: 287 * 1024 * 1024,
    supportedFormats: ['mp4', 'jpeg', 'png'],
    aspectRatioRange: { min: 0.5625, max: 0.5625 },
    notes: 'Vertical format preferred',
  },
  facebook: {
    name: 'Facebook',
    maxFileSize: 25 * 1024 * 1024,
    supportedFormats: ['jpeg', 'png', 'gif'],
    aspectRatioRange: { min: 0.5, max: 2 },
    notes: 'Square or horizontal works well',
  },
  twitter: {
    name: 'X (Twitter)',
    maxFileSize: 5 * 1024 * 1024,
    supportedFormats: ['jpeg', 'png', 'gif', 'webp'],
    aspectRatioRange: { min: 0.5, max: 2 },
    notes: 'Horizontal 16:9 or square recommended',
  },
};

export async function checkPlatformRequirements(
  localPath: string,
  platform: keyof typeof SOCIAL_PLATFORMS
): Promise<{ valid: boolean; issues: string[] }> {
  const platformInfo = SOCIAL_PLATFORMS[platform];
  const issues: string[] = [];
  
  if (Platform.OS === 'web') {
    return { valid: true, issues: [] };
  }
  
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    
    if (!fileInfo.exists) {
      return { valid: false, issues: ['File not found'] };
    }
    
    const fileSize = fileInfo.size ?? 0;
    if (fileSize > platformInfo.maxFileSize) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      const maxMB = (platformInfo.maxFileSize / (1024 * 1024)).toFixed(0);
      issues.push(`File size (${sizeMB}MB) exceeds ${platformInfo.name} limit (${maxMB}MB)`);
    }
    
    const extension = localPath.split('.').pop()?.toLowerCase() || '';
    if (!platformInfo.supportedFormats.includes(extension)) {
      issues.push(`${extension.toUpperCase()} format may not be optimal for ${platformInfo.name}`);
    }
    
    return { valid: issues.length === 0, issues };
    
  } catch {
    return { valid: false, issues: ['Could not verify file'] };
  }
}

export async function prepareForSharing(
  localPath: string,
  filename: string = 'beauty_creation'
): Promise<string> {
  if (Platform.OS === 'web') {
    return localPath;
  }
  const extension = localPath.split('.').pop() || 'jpg';
  const destPath = `${FileSystem.cacheDirectory}${filename}_${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: localPath, to: destPath });
  return destPath;
}

export async function cleanupShareFiles(): Promise<void> {
  if (Platform.OS === 'web') return;
  
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    
    const items = await FileSystem.readDirectoryAsync(cacheDir);
    
    for (const item of items) {
      if (item.startsWith('share_') || item.startsWith('beauty_creation_')) {
        await FileSystem.deleteAsync(`${cacheDir}${item}`, { idempotent: true });
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup share files:', error);
  }
}
