/**
 * Temporary File Cleanup Service
 * 
 * Tracks and manages temporary files created during image processing,
 * canvas captures, and other operations. Provides cleanup methods to
 * prevent memory accumulation and storage bloat.
 * 
 * Usage:
 * - Call trackTempFile(uri) after creating temp files
 * - Call cleanupTempFiles() when backgrounding app or leaving screens
 * - Call cleanupOldTempFiles() periodically for stale file cleanup
 */

import * as FileSystem from 'expo-file-system/legacy';

// ============================================
// Types
// ============================================

interface TrackedFile {
  uri: string;
  timestamp: number;
}

// ============================================
// State
// ============================================

// In-memory tracking of temp files
const trackedFiles: Map<string, TrackedFile> = new Map();

// Flag to prevent concurrent cleanup operations
let isCleaningUp = false;

// ============================================
// Core Functions
// ============================================

/**
 * Track a temporary file for later cleanup
 * 
 * @param uri - The file URI to track (typically from ImageManipulator or ViewShot)
 */
export function trackTempFile(uri: string): void {
  if (!uri) return;
  
  // Only track local files (file:// protocol)
  if (!uri.startsWith('file://') && !uri.startsWith(FileSystem.cacheDirectory || '')) {
    return;
  }
  
  trackedFiles.set(uri, {
    uri,
    timestamp: Date.now(),
  });
  
  if (__DEV__) {
    console.log(`[TempCleanup] Tracking file: ${uri.substring(0, 60)}... (total: ${trackedFiles.size})`);
  }
}

/**
 * Untrack a file (call when file is moved to permanent storage)
 * 
 * @param uri - The file URI to stop tracking
 */
export function untrackTempFile(uri: string): void {
  if (!uri) return;
  
  if (trackedFiles.has(uri)) {
    trackedFiles.delete(uri);
    if (__DEV__) {
      console.log(`[TempCleanup] Untracked file: ${uri.substring(0, 60)}...`);
    }
  }
}

/**
 * Clean up all tracked temporary files
 * 
 * Call this when:
 * - App goes to background
 * - User navigates away from editor
 * - After completing a save operation
 * 
 * @returns Number of files deleted
 */
export async function cleanupTempFiles(): Promise<number> {
  if (isCleaningUp) {
    console.log('[TempCleanup] Cleanup already in progress, skipping');
    return 0;
  }
  
  if (trackedFiles.size === 0) {
    return 0;
  }
  
  isCleaningUp = true;
  let deletedCount = 0;
  const errors: string[] = [];
  
  console.log(`[TempCleanup] Starting cleanup of ${trackedFiles.size} tracked files`);
  
  const filesToDelete = Array.from(trackedFiles.values());
  
  for (const file of filesToDelete) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
        deletedCount++;
      }
      
      // Remove from tracking regardless of whether file existed
      trackedFiles.delete(file.uri);
    } catch (error) {
      // File may already be deleted or inaccessible
      errors.push(file.uri);
      trackedFiles.delete(file.uri);
    }
  }
  
  isCleaningUp = false;
  
  if (errors.length > 0 && __DEV__) {
    console.log(`[TempCleanup] Could not delete ${errors.length} files (may already be removed)`);
  }
  
  console.log(`[TempCleanup] Cleanup complete: ${deletedCount} files deleted`);
  
  return deletedCount;
}

/**
 * Clean up temporary files older than specified age
 * 
 * Use this for periodic cleanup without removing recently created files
 * 
 * @param maxAgeMs - Maximum age in milliseconds (default: 30 minutes)
 * @returns Number of files deleted
 */
export async function cleanupOldTempFiles(maxAgeMs: number = 30 * 60 * 1000): Promise<number> {
  if (isCleaningUp) {
    return 0;
  }
  
  const now = Date.now();
  const oldFiles = Array.from(trackedFiles.values()).filter(
    file => (now - file.timestamp) > maxAgeMs
  );
  
  if (oldFiles.length === 0) {
    return 0;
  }
  
  isCleaningUp = true;
  let deletedCount = 0;
  
  console.log(`[TempCleanup] Cleaning up ${oldFiles.length} files older than ${maxAgeMs / 1000}s`);
  
  for (const file of oldFiles) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(file.uri, { idempotent: true });
        deletedCount++;
      }
      
      trackedFiles.delete(file.uri);
    } catch {
      trackedFiles.delete(file.uri);
    }
  }
  
  isCleaningUp = false;
  
  console.log(`[TempCleanup] Old file cleanup complete: ${deletedCount} files deleted`);
  
  return deletedCount;
}

/**
 * Clean up the cache directory
 * 
 * More aggressive cleanup that removes all files in the cache directory
 * that match certain patterns (e.g., ImageManipulator output)
 * 
 * Use sparingly - this is a heavier operation
 */
export async function cleanupCacheDirectory(): Promise<number> {
  if (isCleaningUp || !FileSystem.cacheDirectory) {
    return 0;
  }
  
  isCleaningUp = true;
  let deletedCount = 0;
  
  try {
    const cacheDir = FileSystem.cacheDirectory;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    
    // Only delete files that look like temp image files
    const tempFilePatterns = [
      /^ImageManipulator/,
      /^canvas_overlay_/,
      /^ViewShot/,
      /\.tmp$/,
    ];
    
    for (const filename of files) {
      const isTemp = tempFilePatterns.some(pattern => pattern.test(filename));
      
      if (isTemp) {
        try {
          await FileSystem.deleteAsync(`${cacheDir}${filename}`, { idempotent: true });
          deletedCount++;
        } catch {
          // Ignore individual file errors
        }
      }
    }
    
    console.log(`[TempCleanup] Cache directory cleanup: ${deletedCount} temp files deleted`);
  } catch (error) {
    console.warn('[TempCleanup] Cache directory cleanup failed:', error);
  }
  
  isCleaningUp = false;
  
  // Clear tracking since we've done a broad cleanup
  trackedFiles.clear();
  
  return deletedCount;
}

/**
 * Get the count of currently tracked files
 * Useful for debugging and monitoring
 */
export function getTrackedFilesCount(): number {
  return trackedFiles.size;
}

/**
 * Get all tracked file URIs (for debugging)
 */
export function getTrackedFiles(): string[] {
  return Array.from(trackedFiles.keys());
}

/**
 * Clear all tracking without deleting files
 * Use when you know files have been handled elsewhere
 */
export function clearTracking(): void {
  trackedFiles.clear();
  console.log('[TempCleanup] Tracking cleared');
}

// ============================================
// Export Default
// ============================================

export default {
  trackTempFile,
  untrackTempFile,
  cleanupTempFiles,
  cleanupOldTempFiles,
  cleanupCacheDirectory,
  getTrackedFilesCount,
  getTrackedFiles,
  clearTracking,
};
