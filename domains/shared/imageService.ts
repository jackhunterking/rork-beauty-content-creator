/**
 * Image Service
 * 
 * Consolidated service for ALL image operations:
 * - Upload (temp and permanent)
 * - Cache management
 * - Cleanup of temporary files
 * - URL utilities
 * 
 * This replaces:
 * - imageCacheService.ts (cache clearing)
 * - imageUploadService.ts (unused)
 * - imageUtils.ts (utilities)
 * - tempUploadService.ts (temp uploads)
 * - tempCleanupService.ts (cleanup)
 */

import { supabase } from '@/lib/supabase';
import { Image as ExpoImage } from 'expo-image';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// ============================================
// Constants
// ============================================

const TEMP_BUCKET_NAME = 'temp-uploads';
const DRAFTS_BUCKET_NAME = 'drafts';

// ============================================
// State (for temp file tracking)
// ============================================

interface TrackedFile {
  uri: string;
  timestamp: number;
}

const trackedFiles: Map<string, TrackedFile> = new Map();
let isCleaningUp = false;

// Session management
let currentSessionId: string | null = null;
const sessionUploadedUrls: Map<string, string[]> = new Map();

// ============================================
// URL Utilities
// ============================================

/**
 * Check if a URI is already in cloud storage (doesn't need upload)
 */
export function isCloudStorageUrl(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}

/**
 * Check if a URI is a local file
 */
export function isLocalFile(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith(FileSystemLegacy.cacheDirectory || '');
}

/**
 * Add cache bust parameter to a URL
 */
export function withCacheBust(uri: string, version: string): string {
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}v=${version}`;
}

// ============================================
// Session Management
// ============================================

/**
 * Generate a unique session ID for grouping uploads
 */
export function generateSessionId(): string {
  currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  sessionUploadedUrls.set(currentSessionId, []);
  console.log('[ImageService] Generated new session:', currentSessionId);
  return currentSessionId;
}

/**
 * Get current session ID or generate one
 */
export function getSessionId(): string {
  if (!currentSessionId) {
    return generateSessionId();
  }
  return currentSessionId;
}

/**
 * Get the current session ID without generating a new one
 */
export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

/**
 * Reset session ID (call after cleanup)
 */
export function resetSession(): void {
  if (currentSessionId) {
    sessionUploadedUrls.delete(currentSessionId);
  }
  currentSessionId = null;
}

/**
 * Get all URLs uploaded in a session (for cleanup)
 */
export function getSessionUploadedUrls(sessionId?: string): string[] {
  const session = sessionId || currentSessionId;
  if (!session) return [];
  return sessionUploadedUrls.get(session) || [];
}

// ============================================
// Upload Functions
// ============================================

/**
 * Upload an image to Supabase temp storage
 * 
 * If the URI is already a remote URL, it's returned directly.
 * 
 * @param localUri - Local file URI (file://) or remote URL (http/https)
 * @param slotId - Slot identifier for the filename
 * @param sessionId - Optional session ID for grouping
 * @returns Public URL of the image
 */
export async function uploadTempImage(
  localUri: string,
  slotId: string,
  sessionId?: string
): Promise<string> {
  // If already a remote URL, return it directly
  if (isCloudStorageUrl(localUri)) {
    console.log('[ImageService] Already cloud URL, skipping upload:', localUri.substring(0, 60));
    return localUri;
  }

  const session = sessionId || getSessionId();
  console.log('[ImageService] Uploading temp image for slot:', slotId);

  // Read file as base64
  const base64 = await FileSystemLegacy.readAsStringAsync(localUri, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });

  // Determine content type from extension
  const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' 
    : extension === 'webp' ? 'image/webp' 
    : 'image/jpeg';

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `${session}/capture_${slotId}_${timestamp}.${extension === 'webp' ? 'webp' : extension === 'png' ? 'png' : 'jpg'}`;

  // Upload to Supabase
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET_NAME)
    .upload(filename, decode(base64), {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[ImageService] Upload failed:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(TEMP_BUCKET_NAME)
    .getPublicUrl(data.path);

  const publicUrl = urlData.publicUrl;
  console.log('[ImageService] Uploaded successfully:', publicUrl.substring(0, 60));

  // Track for cleanup
  const urls = sessionUploadedUrls.get(session) || [];
  urls.push(publicUrl);
  sessionUploadedUrls.set(session, urls);

  return publicUrl;
}

/**
 * Upload an image to permanent drafts storage
 * 
 * @param draftId - The draft ID
 * @param localUri - Local file URI
 * @param slotId - Slot identifier
 * @returns Public URL of the uploaded image
 */
export async function uploadDraftImage(
  draftId: string,
  localUri: string,
  slotId: string
): Promise<string> {
  // If already a cloud URL, return it
  if (isCloudStorageUrl(localUri)) {
    return localUri;
  }

  console.log('[ImageService] Uploading draft image:', { draftId, slotId });

  // Read file as base64
  const base64 = await FileSystemLegacy.readAsStringAsync(localUri, {
    encoding: FileSystemLegacy.EncodingType.Base64,
  });

  // Determine content type
  const extension = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' 
    : extension === 'webp' ? 'image/webp' 
    : 'image/jpeg';

  // Generate filename
  const timestamp = Date.now();
  const filename = `${draftId}/${slotId}_${timestamp}.${extension === 'webp' ? 'webp' : extension === 'png' ? 'png' : 'jpg'}`;

  // Upload to drafts bucket
  const { data, error } = await supabase.storage
    .from(DRAFTS_BUCKET_NAME)
    .upload(filename, decode(base64), {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[ImageService] Draft upload failed:', error);
    throw error;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(DRAFTS_BUCKET_NAME)
    .getPublicUrl(data.path);

  console.log('[ImageService] Draft image uploaded:', urlData.publicUrl.substring(0, 60));
  return urlData.publicUrl;
}

// ============================================
// Cache Management
// ============================================

/**
 * Clear all cached images from both disk and memory
 */
export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all([
      ExpoImage.clearDiskCache(),
      ExpoImage.clearMemoryCache(),
    ]);
    console.log('[ImageService] All caches cleared');
  } catch (error) {
    console.warn('[ImageService] Failed to clear cache:', error);
  }
}

/**
 * Clear memory cache only (faster, less aggressive)
 */
export async function clearMemoryCache(): Promise<void> {
  try {
    await ExpoImage.clearMemoryCache();
    console.log('[ImageService] Memory cache cleared');
  } catch (error) {
    console.warn('[ImageService] Failed to clear memory cache:', error);
  }
}

// ============================================
// Temp File Tracking & Cleanup
// ============================================

/**
 * Track a temporary file for later cleanup
 */
export function trackTempFile(uri: string): void {
  if (!uri || !isLocalFile(uri)) return;

  trackedFiles.set(uri, {
    uri,
    timestamp: Date.now(),
  });

  if (__DEV__) {
    console.log(`[ImageService] Tracking file (total: ${trackedFiles.size})`);
  }
}

/**
 * Untrack a file (call when file is moved to permanent storage)
 */
export function untrackTempFile(uri: string): void {
  if (!uri) return;
  trackedFiles.delete(uri);
}

/**
 * Clean up all tracked temporary files
 * 
 * Call when:
 * - App goes to background
 * - User navigates away from editor
 * - After completing a save operation
 */
export async function cleanupTempFiles(): Promise<number> {
  if (isCleaningUp || trackedFiles.size === 0) {
    return 0;
  }

  isCleaningUp = true;
  let deletedCount = 0;

  console.log(`[ImageService] Cleaning up ${trackedFiles.size} tracked files`);

  const filesToDelete = Array.from(trackedFiles.values());

  for (const file of filesToDelete) {
    try {
      const fileInfo = await FileSystemLegacy.getInfoAsync(file.uri);
      if (fileInfo.exists) {
        await FileSystemLegacy.deleteAsync(file.uri, { idempotent: true });
        deletedCount++;
      }
      trackedFiles.delete(file.uri);
    } catch {
      trackedFiles.delete(file.uri);
    }
  }

  isCleaningUp = false;
  console.log(`[ImageService] Cleanup complete: ${deletedCount} files deleted`);

  return deletedCount;
}

/**
 * Clean up temporary files older than specified age
 */
export async function cleanupOldTempFiles(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
  if (isCleaningUp) return 0;

  const now = Date.now();
  const oldFiles = Array.from(trackedFiles.values()).filter(
    (file) => now - file.timestamp > maxAgeMs
  );

  if (oldFiles.length === 0) return 0;

  isCleaningUp = true;
  let deletedCount = 0;

  console.log(`[ImageService] Cleaning up ${oldFiles.length} old files`);

  for (const file of oldFiles) {
    try {
      const fileInfo = await FileSystemLegacy.getInfoAsync(file.uri);
      if (fileInfo.exists) {
        await FileSystemLegacy.deleteAsync(file.uri, { idempotent: true });
        deletedCount++;
      }
      trackedFiles.delete(file.uri);
    } catch {
      trackedFiles.delete(file.uri);
    }
  }

  isCleaningUp = false;
  console.log(`[ImageService] Old file cleanup complete: ${deletedCount} files deleted`);

  return deletedCount;
}

/**
 * Clean up temp uploads session from Supabase storage
 */
export async function cleanupSession(sessionId?: string): Promise<void> {
  const session = sessionId || currentSessionId;
  if (!session) return;

  try {
    const { data, error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list(session);

    if (error) {
      console.warn('[ImageService] Failed to list session files:', error);
      return;
    }

    if (data && data.length > 0) {
      const filePaths = data.map((file) => `${session}/${file.name}`);
      await supabase.storage.from(TEMP_BUCKET_NAME).remove(filePaths);
      console.log(`[ImageService] Cleaned up ${filePaths.length} session files`);
    }
  } catch (error) {
    console.warn('[ImageService] Session cleanup failed:', error);
  }

  sessionUploadedUrls.delete(session);
}

/**
 * Get the count of currently tracked files
 */
export function getTrackedFilesCount(): number {
  return trackedFiles.size;
}

/**
 * Clear all tracking without deleting files
 */
export function clearTracking(): void {
  trackedFiles.clear();
  console.log('[ImageService] Tracking cleared');
}

// ============================================
// Default Export
// ============================================

export const imageService = {
  // URL utilities
  isCloudStorageUrl,
  isLocalFile,
  withCacheBust,

  // Session management
  generateSessionId,
  getSessionId,
  getCurrentSessionId,
  resetSession,
  getSessionUploadedUrls,

  // Upload
  uploadTempImage,
  uploadDraftImage,

  // Cache
  clearAllCache,
  clearMemoryCache,

  // Cleanup
  trackTempFile,
  untrackTempFile,
  cleanupTempFiles,
  cleanupOldTempFiles,
  cleanupSession,
  getTrackedFilesCount,
  clearTracking,
};

export default imageService;
