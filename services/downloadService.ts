import { File, Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

/**
 * Download Service
 * 
 * Handles saving images to the device's gallery/photos.
 * Works with both local cached files and remote URLs.
 * 
 * Features:
 * - Permission handling for media library
 * - Save from local path or download from URL
 * - Creates album for organized storage
 * - Cross-platform support (iOS & Android)
 */

const ALBUM_NAME = 'Beauty Creator';

// ============================================
// Permissions
// ============================================

/**
 * Check if we have permission to save to media library
 */
export async function hasMediaLibraryPermission(): Promise<boolean> {
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status === 'granted';
}

/**
 * Request permission to save to media library
 * Returns true if granted, false otherwise
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Ensure we have permission, requesting if needed
 */
export async function ensureMediaLibraryPermission(): Promise<boolean> {
  let hasPermission = await hasMediaLibraryPermission();
  
  if (!hasPermission) {
    hasPermission = await requestMediaLibraryPermission();
  }
  
  return hasPermission;
}

// ============================================
// Download Functions
// ============================================

export interface DownloadResult {
  success: boolean;
  localUri?: string;
  assetUri?: string;
  albumName?: string;
  error?: string;
}

/**
 * Save a local file to the device's photo gallery
 * 
 * @param localPath - Path to local file (file:// URI)
 * @param albumName - Optional album name (default: 'Beauty Creator')
 * @returns DownloadResult with asset URI if successful
 */
export async function saveToGallery(
  localPath: string,
  albumName: string = ALBUM_NAME
): Promise<DownloadResult> {
  try {
    // Ensure permission
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access media library was denied',
      };
    }
    
    // Verify file exists
    const file = new File(localPath);
    if (!file.exists) {
      return {
        success: false,
        error: 'File not found at the specified path',
      };
    }
    
    // Save to media library
    const asset = await MediaLibrary.createAssetAsync(localPath);
    
    // Try to add to album
    try {
      let album = await MediaLibrary.getAlbumAsync(albumName);
      
      if (!album) {
        // Create album with this asset
        album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        // Add to existing album
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
    } catch (albumError) {
      // Album creation/access might fail on some devices, but save succeeded
      console.warn('Could not add to album:', albumError);
    }
    
    return {
      success: true,
      localUri: localPath,
      assetUri: asset.uri,
      albumName,
    };
    
  } catch (error) {
    console.error('Failed to save to gallery:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save to gallery',
    };
  }
}

/**
 * Download a remote image and save to gallery
 * 
 * @param remoteUrl - URL of the image to download
 * @param filename - Optional filename (without extension)
 * @param albumName - Optional album name
 * @returns DownloadResult
 */
export async function downloadAndSaveToGallery(
  remoteUrl: string,
  filename?: string,
  albumName: string = ALBUM_NAME
): Promise<DownloadResult> {
  try {
    // Ensure permission first
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access media library was denied',
      };
    }
    
    // Generate local path for download
    const extension = getFileExtension(remoteUrl);
    const name = filename || `beauty_${Date.now()}`;
    const destination = new Directory(Paths.cache);
    
    // Ensure cache directory exists
    if (!destination.exists) {
      destination.create({ intermediates: true });
    }
    
    // Download the file
    const downloadedFile = await File.downloadFileAsync(remoteUrl, destination);
    
    if (!downloadedFile.exists) {
      return {
        success: false,
        error: 'Download failed',
      };
    }
    
    // Rename to our desired filename
    const finalFile = new File(Paths.cache, `${name}.${extension}`);
    downloadedFile.move(finalFile);
    
    // Save to gallery
    return saveToGallery(finalFile.uri, albumName);
    
  } catch (error) {
    console.error('Failed to download and save:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

/**
 * Copy a local file to a new location with a specific filename
 * Useful for preparing files with nice names before sharing
 */
export async function copyWithFilename(
  sourcePath: string,
  filename: string,
  extension: string = 'jpg'
): Promise<string> {
  const sourceFile = new File(sourcePath);
  const destFile = new File(Paths.cache, `${filename}.${extension}`);
  sourceFile.copy(destFile);
  return destFile.uri;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Extract file extension from URL
 */
function getFileExtension(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
      return ext;
    }
  } catch {
    // Invalid URL, fall through
  }
  
  return 'jpg'; // Default extension
}

/**
 * Generate a unique filename for downloads
 */
export function generateDownloadFilename(prefix: string = 'beauty'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Get the path where downloaded files will be saved
 */
export function getDownloadDirectory(): string {
  return Paths.cache.uri;
}

/**
 * Check if a file exists at the given path
 */
export async function fileExists(path: string): Promise<boolean> {
  const file = new File(path);
  return file.exists;
}

/**
 * Get the size of a file in bytes
 */
export async function getFileSize(path: string): Promise<number | null> {
  const file = new File(path);
  if (file.exists) {
    return file.size ?? null;
  }
  return null;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get the album where images will be saved
 */
export async function getOrCreateAlbum(
  albumName: string = ALBUM_NAME
): Promise<MediaLibrary.Album | null> {
  try {
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) return null;
    
    const album = await MediaLibrary.getAlbumAsync(albumName);
    
    // Album will be created when first image is saved
    return album;
  } catch {
    return null;
  }
}

/**
 * Get all assets in the Beauty Creator album
 */
export async function getAlbumAssets(
  limit: number = 50
): Promise<MediaLibrary.Asset[]> {
  try {
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) return [];
    
    const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
    if (!album) return [];
    
    const { assets } = await MediaLibrary.getAssetsAsync({
      album: album,
      first: limit,
      sortBy: [MediaLibrary.SortBy.creationTime],
      mediaType: [MediaLibrary.MediaType.photo],
    });
    
    return assets;
  } catch {
    return [];
  }
}
