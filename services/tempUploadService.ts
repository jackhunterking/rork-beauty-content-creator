import { supabase } from '@/lib/supabase';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

/**
 * Temporary Upload Service
 * 
 * Handles uploading images to Supabase Storage for Templated.io to access.
 * These are temporary files that should be cleaned up after rendering.
 * 
 * Flow:
 * 1. Upload local image to Supabase temp_uploads bucket
 * 2. Get public URL for Templated.io to fetch
 * 3. After successful render, cleanup temp files
 */

const TEMP_BUCKET_NAME = 'temp-uploads';

// Session ID for grouping related uploads (for cleanup)
let currentSessionId: string | null = null;

// Track uploaded URLs for cleanup when project is discarded without saving
// Maps session ID to array of public URLs uploaded in that session
const sessionUploadedUrls: Map<string, string[]> = new Map();

/**
 * Generate a unique session ID for grouping uploads
 */
export function generateSessionId(): string {
  currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  // Initialize tracking for this session
  sessionUploadedUrls.set(currentSessionId, []);
  console.log('[TempUpload] Generated new session:', currentSessionId);
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
 * Returns null if no session exists
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
 * Track an uploaded URL for potential cleanup
 */
function trackUploadedUrl(sessionId: string, publicUrl: string): void {
  const urls = sessionUploadedUrls.get(sessionId) || [];
  urls.push(publicUrl);
  sessionUploadedUrls.set(sessionId, urls);
}

/**
 * Get all URLs uploaded in a session (for cleanup)
 */
export function getSessionUploadedUrls(sessionId?: string): string[] {
  const session = sessionId || currentSessionId;
  if (!session) return [];
  return sessionUploadedUrls.get(session) || [];
}

/**
 * Upload an image to Supabase temp storage for Templated.io to access
 * 
 * If the URI is already a remote URL (http/https), it's returned directly
 * since Templated.io can access public URLs without re-uploading.
 * This handles the case when loading drafts with Supabase Storage URLs.
 * 
 * @param localUri - Local file URI (file://) or remote URL (http/https)
 * @param slotId - Slot identifier for the filename
 * @param sessionId - Optional session ID for grouping (uses current if not provided)
 * @returns Public URL of the image (uploaded or pass-through)
 */
export async function uploadTempImage(
  localUri: string,
  slotId: string,
  sessionId?: string
): Promise<string> {
  // Validate URI before processing
  if (!localUri || typeof localUri !== 'string') {
    throw new Error(`Invalid URI for slot ${slotId}: URI is ${typeof localUri}`);
  }
  
  // If URI is already a remote URL (e.g., Supabase Storage), return it directly
  // Templated.io can access public URLs without re-uploading
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    console.log(`[TempUpload] Using existing remote URL for ${slotId}`);
    return localUri;
  }
  
  // Normalize URI - ensure it has file:// prefix for expo-file-system
  const normalizedUri = localUri.startsWith('file://') 
    ? localUri 
    : `file://${localUri}`;
  
  const session = sessionId || getSessionId();
  
  let base64Data: string;
  
  // Try new File API first
  try {
    const file = new ExpoFile(normalizedUri);
    base64Data = await file.base64();
  } catch (newApiError) {
    console.log('[TempUpload] New File API failed, trying legacy:', newApiError);
    
    // Fallback to legacy API
    base64Data = await FileSystemLegacy.readAsStringAsync(normalizedUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
  }

  // Generate unique filename within session folder
  const timestamp = Date.now();
  const filename = `${session}/${slotId}_${timestamp}.jpg`;
  
  // Convert base64 to ArrayBuffer
  const arrayBuffer = decode(base64Data);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET_NAME)
    .upload(filename, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('Temp upload error:', error);
    throw new Error(`Failed to upload temp image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(TEMP_BUCKET_NAME)
    .getPublicUrl(data.path);

  // Track the uploaded URL for cleanup
  trackUploadedUrl(session, urlData.publicUrl);

  return urlData.publicUrl;
}

/**
 * Upload a captured image to Supabase temp storage immediately after capture
 * 
 * This is the cloud-first approach: upload immediately after camera capture
 * to get a durable Supabase URL. This eliminates "file not found" errors
 * caused by iOS deleting temporary camera files.
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
  // Validate URI before processing
  if (!localUri || typeof localUri !== 'string') {
    throw new Error(`Invalid URI for slot ${slotId}: URI is ${typeof localUri}`);
  }
  
  // If URI is already a Supabase/remote URL, return it directly
  // This handles re-captures where we might already have a cloud URL
  if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
    console.log(`[TempUpload] Image already uploaded for ${slotId}, using existing URL`);
    return localUri;
  }
  
  const startTime = Date.now();
  console.log(`[TempUpload] Uploading captured image for slot ${slotId}...`);
  
  // Ensure we have a session for this capture
  const session = getSessionId();
  
  // Normalize URI - ensure it has file:// prefix for expo-file-system
  const normalizedUri = localUri.startsWith('file://') 
    ? localUri 
    : `file://${localUri}`;
  
  let base64Data: string;
  
  // Try new File API first, fall back to legacy if needed
  try {
    const file = new ExpoFile(normalizedUri);
    base64Data = await file.base64();
  } catch (newApiError) {
    console.log('[TempUpload] New File API failed, trying legacy:', newApiError);
    
    // Fallback to legacy API
    base64Data = await FileSystemLegacy.readAsStringAsync(normalizedUri, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
  }

  // Generate unique filename: session/capture_slotId_timestamp.jpg
  const timestamp = Date.now();
  const filename = `${session}/capture_${slotId}_${timestamp}.jpg`;
  
  // Convert base64 to ArrayBuffer
  const arrayBuffer = decode(base64Data);

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(TEMP_BUCKET_NAME)
    .upload(filename, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('[TempUpload] Upload error:', error);
    throw new Error(`Failed to upload captured image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(TEMP_BUCKET_NAME)
    .getPublicUrl(data.path);

  const uploadTime = Date.now() - startTime;
  console.log(`[TempUpload] Upload complete for ${slotId} in ${uploadTime}ms:`, urlData.publicUrl.substring(0, 80) + '...');
  
  // Track the uploaded URL for cleanup if project is discarded
  trackUploadedUrl(session, urlData.publicUrl);

  return urlData.publicUrl;
}

/**
 * Upload multiple slot images to temp storage
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
 * Clean up all temp files for a session
 * Call this after successful render or when discarding a project
 * 
 * @param sessionId - Session ID to clean up (uses current if not provided)
 */
export async function cleanupSession(sessionId?: string): Promise<void> {
  const session = sessionId || currentSessionId;
  if (!session) {
    console.log('[TempUpload] No session to clean up');
    return;
  }

  console.log(`[TempUpload] Cleaning up session: ${session}`);

  try {
    // List all files in the session folder
    const { data: files, error: listError } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list(session);

    if (listError) {
      console.error('[TempUpload] Error listing session files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log('[TempUpload] No files to clean up in session');
      // Still clean up the session tracking
      sessionUploadedUrls.delete(session);
      if (session === currentSessionId) {
        currentSessionId = null;
      }
      return;
    }

    // Delete all files in the session
    const filePaths = files.map(f => `${session}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('[TempUpload] Error deleting session files:', deleteError);
    } else {
      console.log(`[TempUpload] Deleted ${filePaths.length} files from session`);
    }

    // Clean up session tracking
    sessionUploadedUrls.delete(session);
    
    // Reset current session if it matches
    if (session === currentSessionId) {
      currentSessionId = null;
    }
  } catch (error) {
    console.error('[TempUpload] Cleanup error:', error);
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
    console.log('[TempUpload] No captured images to clean up (no session)');
    return;
  }

  const urls = sessionUploadedUrls.get(session);
  if (!urls || urls.length === 0) {
    console.log('[TempUpload] No captured images tracked for cleanup');
    resetSession();
    return;
  }

  console.log(`[TempUpload] Cleaning up ${urls.length} captured images from discarded project`);
  
  // Clean up the entire session (more efficient than individual file deletion)
  await cleanupSession(session);
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
      console.warn('Invalid temp file URL:', publicUrl);
      return;
    }
    
    const filePath = pathParts.slice(bucketIndex + 1).join('/');
    
    const { error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting temp file:', error);
    }
  } catch (error) {
    console.error('Cleanup temp file error:', error);
  }
}

/**
 * Clean up multiple temp files by URL
 * 
 * @param publicUrls - Array of public URLs to clean up
 */
export async function cleanupTempFiles(publicUrls: string[]): Promise<void> {
  await Promise.all(publicUrls.map(url => cleanupTempFile(url)));
}

/**
 * Check if the temp uploads bucket exists and is accessible
 */
export async function checkTempBucketAccess(): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list('', { limit: 1 });
    
    return !error;
  } catch {
    return false;
  }
}

/**
 * Get all sessions with temp files (for admin/cleanup purposes)
 */
export async function listTempSessions(): Promise<string[]> {
  try {
    const { data, error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list('', { limit: 1000 });

    if (error || !data) {
      return [];
    }

    // Filter to directories (sessions)
    return data
      .filter(item => item.id === null) // Folders have null id
      .map(item => item.name);
  } catch {
    return [];
  }
}

/**
 * Clean up all temp files older than specified hours
 * Note: This requires server-side implementation or Edge Function
 * This is a client-side approximation that works if filenames have timestamps
 * 
 * @param maxAgeHours - Maximum age in hours
 */
export async function cleanupOldTempFiles(maxAgeHours: number = 1): Promise<number> {
  try {
    const { data: items, error } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list('', { limit: 1000 });

    if (error || !items) {
      return 0;
    }

    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let deletedCount = 0;

    // Process each session folder
    for (const item of items) {
      if (item.name.startsWith('session_')) {
        // Extract timestamp from session name: session_TIMESTAMP_xxx
        const match = item.name.match(/session_(\d+)_/);
        if (match) {
          const sessionTime = parseInt(match[1], 10);
          if (now - sessionTime > maxAgeMs) {
            await cleanupSession(item.name);
            deletedCount++;
          }
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old temp files:', error);
    return 0;
  }
}

// Export bucket name for external use
export const TEMP_UPLOADS_BUCKET = TEMP_BUCKET_NAME;
