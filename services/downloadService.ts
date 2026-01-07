import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

const ALBUM_NAME = 'Beauty Creator';

export async function hasMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await MediaLibrary.getPermissionsAsync();
  return status === 'granted';
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await MediaLibrary.requestPermissionsAsync();
  return status === 'granted';
}

export async function ensureMediaLibraryPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  let hasPermission = await hasMediaLibraryPermission();
  
  if (!hasPermission) {
    hasPermission = await requestMediaLibraryPermission();
  }
  
  return hasPermission;
}

export interface DownloadResult {
  success: boolean;
  localUri?: string;
  assetUri?: string;
  albumName?: string;
  error?: string;
}

export async function saveToGallery(
  localPath: string,
  albumName: string = ALBUM_NAME
): Promise<DownloadResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Not supported on web' };
  }
  
  try {
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access media library was denied',
      };
    }
    
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (!fileInfo.exists) {
      return {
        success: false,
        error: 'File not found at the specified path',
      };
    }
    
    const asset = await MediaLibrary.createAssetAsync(localPath);
    
    try {
      let album = await MediaLibrary.getAlbumAsync(albumName);
      
      if (!album) {
        album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }
    } catch (albumError) {
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

export async function downloadAndSaveToGallery(
  remoteUrl: string,
  filename?: string,
  albumName: string = ALBUM_NAME
): Promise<DownloadResult> {
  if (Platform.OS === 'web') {
    return { success: false, error: 'Not supported on web' };
  }
  
  try {
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) {
      return {
        success: false,
        error: 'Permission to access media library was denied',
      };
    }
    
    const extension = getFileExtension(remoteUrl);
    const name = filename || `beauty_${Date.now()}`;
    const localPath = `${FileSystem.cacheDirectory}${name}.${extension}`;
    
    const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);
    
    if (downloadResult.status !== 200) {
      return {
        success: false,
        error: 'Download failed',
      };
    }
    
    return saveToGallery(downloadResult.uri, albumName);
    
  } catch (error) {
    console.error('Failed to download and save:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Download failed',
    };
  }
}

export async function copyWithFilename(
  sourcePath: string,
  filename: string,
  extension: string = 'jpg'
): Promise<string> {
  if (Platform.OS === 'web') {
    return sourcePath;
  }
  const destPath = `${FileSystem.cacheDirectory}${filename}.${extension}`;
  await FileSystem.copyAsync({ from: sourcePath, to: destPath });
  return destPath;
}

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
  
  return 'jpg';
}

export function generateDownloadFilename(prefix: string = 'beauty'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

export function getDownloadDirectory(): string {
  return FileSystem.cacheDirectory || '';
}

export async function fileExists(path: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const info = await FileSystem.getInfoAsync(path);
  return info.exists;
}

export async function getFileSize(path: string): Promise<number | null> {
  if (Platform.OS === 'web') return null;
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists && !info.isDirectory) {
    return info.size ?? null;
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export async function getOrCreateAlbum(
  albumName: string = ALBUM_NAME
): Promise<MediaLibrary.Album | null> {
  if (Platform.OS === 'web') return null;
  try {
    const hasPermission = await ensureMediaLibraryPermission();
    if (!hasPermission) return null;
    
    const album = await MediaLibrary.getAlbumAsync(albumName);
    return album;
  } catch {
    return null;
  }
}

export async function getAlbumAssets(
  limit: number = 50
): Promise<MediaLibrary.Asset[]> {
  if (Platform.OS === 'web') return [];
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
