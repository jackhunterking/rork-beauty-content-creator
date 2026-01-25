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
import type { Draft, PortfolioItem } from '@/types';

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
 * Add cache-busting parameter to a local file URI
 * 
 * Only applies to local file:// URIs. Remote URLs are returned unchanged
 * as they have proper HTTP cache headers.
 * 
 * @param uri - The file URI (can be local file:// or remote http(s)://)
 * @param version - Version identifier (timestamp string, number, or Date)
 * @returns URI with cache-busting parameter for local files, unchanged for remote
 */
export function withCacheBust(
  uri: string | null | undefined, 
  version: string | number | Date
): string | null {
  if (!uri) return null;
  
  // Only add cache busting to local files
  // Remote URLs have HTTP cache headers and don't need this
  if (!uri.startsWith('file://')) {
    return uri;
  }
  
  // Convert version to timestamp number
  let versionTimestamp: number;
  if (typeof version === 'string') {
    versionTimestamp = new Date(version).getTime();
  } else if (version instanceof Date) {
    versionTimestamp = version.getTime();
  } else {
    versionTimestamp = version;
  }
  
  // Handle invalid dates - fallback to current time
  if (isNaN(versionTimestamp)) {
    versionTimestamp = Date.now();
  }
  
  return `${uri}?v=${versionTimestamp}`;
}

/**
 * Get the best available preview URI for a draft with cache busting applied
 * 
 * Priority order:
 * 1. localPreviewPath (local file with overlays)
 * 2. renderedPreviewUrl (Templated.io URL)
 * 3. beforeImageUrl (legacy)
 * 4. afterImageUrl (legacy)
 * 5. First image from capturedImageUrls
 * 
 * Cache busting is automatically applied to local files using the draft's updatedAt.
 * 
 * @param draft - The draft object
 * @returns Cache-busted URI or null if no preview available
 */
export function getDraftPreviewUri(draft: Draft): string | null {
  let uri: string | null = null;
  
  // Priority: localPreviewPath > renderedPreviewUrl > captured images
  if (draft.localPreviewPath) {
    uri = draft.localPreviewPath;
  } else if (draft.renderedPreviewUrl) {
    uri = draft.renderedPreviewUrl;
  } else if (draft.beforeImageUrl) {
    uri = draft.beforeImageUrl;
  } else if (draft.afterImageUrl) {
    uri = draft.afterImageUrl;
  } else if (draft.capturedImageUrls) {
    const firstImage = Object.values(draft.capturedImageUrls)[0];
    if (firstImage) {
      uri = firstImage;
    }
  }
  
  // Apply cache busting using the draft's updatedAt timestamp
  return withCacheBust(uri, draft.updatedAt);
}

/**
 * Get cache-busted URI for a portfolio item preview
 * 
 * @param item - Portfolio item with imageUrl and createdAt
 * @returns Cache-busted URI
 */
export function getPortfolioPreviewUri(item: PortfolioItem): string {
  // Prefer local path if available, otherwise use remote URL
  const uri = item.localPath || item.imageUrl;
  return withCacheBust(uri, item.createdAt) || item.imageUrl;
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
 * Upload a captured image to Supabase temp storage immediately after capture
 * 
 * This is the cloud-first approach: upload immediately after camera capture
 * to get a durable Supabase URL. This eliminates "file not found" errors
 * caused by iOS deleting temporary camera files.
 * 
 * This is functionally identical to uploadTempImage but with a more
 * descriptive name for the capture flow.
 * 
 * @param localUri - Local file URI from camera/image picker (file://)
 * @param slotId - Slot identifier for organizing the upload
 * @returns Public Supabase URL of the uploaded image
 * @throws Error if upload fails
 */
export async function uploadCapturedImage(
  localUri: string,
  slotId: string
): Promise<string> {
  return uploadTempImage(localUri, slotId);
}

/**
 * Upload multiple slot images to temp storage in parallel
 * Returns a map of slot IDs to public URLs
 * 
 * @param slotImages - Map of slot ID to local URI
 * @param sessionId - Optional session ID for grouping
 * @returns Map of slot ID to public URL
 */
export async function uploadMultipleTempImages(
  slotImages: Record<string, string>,
  sessionId?: string
): Promise<Record<string, string>> {
  const session = sessionId || getSessionId();
  const results: Record<string, string> = {};

  // Upload all images in parallel
  const uploadPromises = Object.entries(slotImages).map(async ([slotId, localUri]) => {
    const publicUrl = await uploadTempImage(localUri, slotId, session);
    return { slotId, publicUrl };
  });

  const uploadResults = await Promise.all(uploadPromises);

  for (const { slotId, publicUrl } of uploadResults) {
    results[slotId] = publicUrl;
  }

  return results;
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
 * Alias for clearAllCache - for backward compatibility
 * Call this when templates are updated to ensure fresh images are loaded.
 */
export async function clearAllImageCache(): Promise<void> {
  return clearAllCache();
}

/**
 * Clear cache for a specific template.
 * 
 * Note: expo-image doesn't support selective cache clearing by key,
 * so this clears all cached images. Use sparingly.
 * 
 * @param templateId - The template ID that was updated
 */
export async function clearCacheForTemplate(templateId: string): Promise<void> {
  console.log(`[ImageService] Clearing cache for template: ${templateId}`);
  await clearAllCache();
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
 * Clean up a specific temp file by URL
 * 
 * @param publicUrl - The public URL of the temp image
 */
export async function cleanupTempFile(publicUrl: string): Promise<void> {
  try {
    // Extract file path from public URL
    const url = new URL(publicUrl);
    const pathParts = url.pathname.split('/');
    // Path format: /storage/v1/object/public/temp-uploads/session_xxx/slotId_xxx.jpg
    const bucketIndex = pathParts.indexOf(TEMP_BUCKET_NAME);
    if (bucketIndex === -1) {
      console.warn('[ImageService] Invalid temp file URL:', publicUrl);
      return;
    }
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    const { error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('[ImageService] Error deleting temp file:', error);
    }
  } catch (error) {
    console.error('[ImageService] Cleanup temp file error:', error);
  }
}

/**
 * Clean up captured images when a project is discarded without saving
 * This should be called when resetProject() is invoked in AppContext
 * 
 * @param sessionId - Optional session ID to clean up (uses current if not provided)
 */
export async function cleanupCapturedImages(sessionId?: string): Promise<void> {
  const session = sessionId || currentSessionId;
  if (!session) {
    console.log('[ImageService] No captured images to clean up (no session)');
    return;
  }

  const urls = sessionUploadedUrls.get(session);
  if (!urls || urls.length === 0) {
    console.log('[ImageService] No captured images tracked for cleanup');
    resetSession();
    return;
  }

  console.log(`[ImageService] Cleaning up ${urls.length} captured images from discarded project`);
  
  // Clean up the entire session (more efficient than individual file deletion)
  await cleanupSession(session);
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
// Constants Export
// ============================================

/** Bucket name for temp uploads - exported for external use */
export const TEMP_UPLOADS_BUCKET = TEMP_BUCKET_NAME;

// ============================================
// Default Export
// ============================================

export const imageService = {
  // URL utilities
  isCloudStorageUrl,
  isLocalFile,
  withCacheBust,
  getDraftPreviewUri,
  getPortfolioPreviewUri,

  // Session management
  generateSessionId,
  getSessionId,
  getCurrentSessionId,
  resetSession,
  getSessionUploadedUrls,

  // Upload
  uploadTempImage,
  uploadCapturedImage,
  uploadMultipleTempImages,
  uploadDraftImage,

  // Cache
  clearAllCache,
  clearAllImageCache,
  clearCacheForTemplate,
  clearMemoryCache,

  // Cleanup
  trackTempFile,
  untrackTempFile,
  cleanupTempFiles,
  cleanupOldTempFiles,
  cleanupTempFile,
  cleanupCapturedImages,
  cleanupSession,
  getTrackedFilesCount,
  clearTracking,
};

export default imageService;
