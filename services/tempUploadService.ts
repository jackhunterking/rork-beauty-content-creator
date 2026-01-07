import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
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

/**
 * Generate a unique session ID for grouping uploads
 */
export function generateSessionId(): string {
  currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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
 * Reset session ID (call after cleanup)
 */
export function resetSession(): void {
  currentSessionId = null;
}

/**
 * Upload a local image to Supabase temp storage
 * Returns the public URL that Templated.io can access
 * 
 * @param localUri - Local file URI (file:// or content://)
 * @param slotId - Slot identifier for the filename
 * @param sessionId - Optional session ID for grouping (uses current if not provided)
 * @returns Public URL of the uploaded image
 */
export async function uploadTempImage(
  localUri: string,
  slotId: string,
  sessionId?: string
): Promise<string> {
  const session = sessionId || getSessionId();
  
  // Read file as base64
  const base64Data = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

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
 * Call this after successful render
 * 
 * @param sessionId - Session ID to clean up (uses current if not provided)
 */
export async function cleanupSession(sessionId?: string): Promise<void> {
  const session = sessionId || currentSessionId;
  if (!session) {
    console.log('No session to clean up');
    return;
  }

  try {
    // List all files in the session folder
    const { data: files, error: listError } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .list(session);

    if (listError) {
      console.error('Error listing session files:', listError);
      return;
    }

    if (!files || files.length === 0) {
      return;
    }

    // Delete all files in the session
    const filePaths = files.map(f => `${session}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from(TEMP_BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('Error deleting session files:', deleteError);
    }

    // Reset current session if it matches
    if (session === currentSessionId) {
      resetSession();
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
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

