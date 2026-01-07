import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

// Base directories for local storage
const DOCUMENTS_DIR = FileSystem.documentDirectory;
const DRAFTS_DIR = `${DOCUMENTS_DIR}drafts/`;
const RENDER_CACHE_DIR = `${DOCUMENTS_DIR}render-cache/`;

/**
 * Local Storage Service
 * 
 * Manages all local file system operations for:
 * - Draft storage (user's captured images)
 * - Render cache (Templated.io rendered outputs)
 * - Directory structure management
 */

// ============================================
// Directory Management
// ============================================

/**
 * Initialize the local storage directories
 * Should be called when app starts
 */
export async function initializeLocalStorage(): Promise<void> {
  await ensureDirectoryExists(DRAFTS_DIR);
  await ensureDirectoryExists(RENDER_CACHE_DIR);
}

/**
 * Ensure a directory exists, create if it doesn't
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
}

/**
 * Get the draft directory path for a specific draft
 */
export function getDraftDirectory(draftId: string): string {
  return `${DRAFTS_DIR}${draftId}/`;
}

/**
 * Get the slots directory within a draft
 */
export function getDraftSlotsDirectory(draftId: string): string {
  return `${getDraftDirectory(draftId)}slots/`;
}

/**
 * Get the renders directory within a draft (for cached renders)
 */
export function getDraftRendersDirectory(draftId: string): string {
  return `${getDraftDirectory(draftId)}renders/`;
}

/**
 * Create the full directory structure for a new draft
 */
export async function createDraftDirectories(draftId: string): Promise<void> {
  await ensureDirectoryExists(getDraftDirectory(draftId));
  await ensureDirectoryExists(getDraftSlotsDirectory(draftId));
  await ensureDirectoryExists(getDraftRendersDirectory(draftId));
}

// ============================================
// File Operations
// ============================================

/**
 * Copy a file to a destination path
 */
export async function copyFile(sourceUri: string, destPath: string): Promise<string> {
  // Ensure destination directory exists
  const destDir = destPath.substring(0, destPath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(destDir);
  
  await FileSystem.copyAsync({
    from: sourceUri,
    to: destPath,
  });
  
  return destPath;
}

/**
 * Move a file to a destination path
 */
export async function moveFile(sourceUri: string, destPath: string): Promise<string> {
  const destDir = destPath.substring(0, destPath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(destDir);
  
  await FileSystem.moveAsync({
    from: sourceUri,
    to: destPath,
  });
  
  return destPath;
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(filePath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(filePath);
  if (info.exists) {
    await FileSystem.deleteAsync(filePath, { idempotent: true });
  }
}

/**
 * Delete a directory and all its contents
 */
export async function deleteDirectory(dirPath: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dirPath);
  if (info.exists) {
    await FileSystem.deleteAsync(dirPath, { idempotent: true });
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(filePath);
  return info.exists;
}

/**
 * Read a JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) {
      return null;
    }
    const content = await FileSystem.readAsStringAsync(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('Error reading JSON file:', error);
    return null;
  }
}

/**
 * Write a JSON file
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dirPath = filePath.substring(0, filePath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(dirPath);
  await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data, null, 2));
}

/**
 * List files in a directory
 */
export async function listDirectory(dirPath: string): Promise<string[]> {
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) {
    return [];
  }
  return FileSystem.readDirectoryAsync(dirPath);
}

// ============================================
// Cache Key Generation
// ============================================

/**
 * Generate a hash from a string (for cache keys)
 */
export async function generateHash(input: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.MD5,
    input
  );
  return digest.substring(0, 12); // Use first 12 chars for brevity
}

/**
 * Generate a cache key for a rendered image
 * Based on template ID, slot images, and theme
 */
export async function generateRenderCacheKey(
  templateId: string,
  slotImageUris: Record<string, string>,
  themeId: string = 'default'
): Promise<string> {
  // Sort slot entries for consistent hashing
  const sortedSlots = Object.entries(slotImageUris)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slotId, uri]) => `${slotId}:${uri}`)
    .join('|');
  
  const hashInput = `${templateId}_${sortedSlots}_${themeId}`;
  const hash = await generateHash(hashInput);
  
  return `${templateId}_${hash}_${themeId}`;
}

// ============================================
// Draft Slot Image Management
// ============================================

/**
 * Save a slot image to the draft's slots directory
 * Returns the local file path
 */
export async function saveDraftSlotImage(
  draftId: string,
  slotId: string,
  sourceUri: string
): Promise<string> {
  const slotsDir = getDraftSlotsDirectory(draftId);
  await ensureDirectoryExists(slotsDir);
  
  const destPath = `${slotsDir}${slotId}.jpg`;
  await copyFile(sourceUri, destPath);
  
  return destPath;
}

/**
 * Get the path to a slot image in a draft
 */
export function getDraftSlotImagePath(draftId: string, slotId: string): string {
  return `${getDraftSlotsDirectory(draftId)}${slotId}.jpg`;
}

/**
 * Check if a slot image exists in a draft
 */
export async function draftSlotImageExists(
  draftId: string,
  slotId: string
): Promise<boolean> {
  const path = getDraftSlotImagePath(draftId, slotId);
  return fileExists(path);
}

// ============================================
// Render Cache Management
// ============================================

/**
 * Get the path for a cached render
 */
export function getCachedRenderPath(draftId: string, themeId: string = 'default'): string {
  return `${getDraftRendersDirectory(draftId)}${themeId}.jpg`;
}

/**
 * Get the global render cache path (for non-draft renders)
 */
export function getGlobalCachePath(cacheKey: string): string {
  return `${RENDER_CACHE_DIR}${cacheKey}.jpg`;
}

/**
 * Save a rendered image to the draft's render cache
 */
export async function saveDraftRender(
  draftId: string,
  sourceUri: string,
  themeId: string = 'default'
): Promise<string> {
  const rendersDir = getDraftRendersDirectory(draftId);
  await ensureDirectoryExists(rendersDir);
  
  const destPath = getCachedRenderPath(draftId, themeId);
  await copyFile(sourceUri, destPath);
  
  return destPath;
}

/**
 * Check if a cached render exists for a draft and theme
 */
export async function draftRenderExists(
  draftId: string,
  themeId: string = 'default'
): Promise<boolean> {
  const path = getCachedRenderPath(draftId, themeId);
  return fileExists(path);
}

/**
 * Delete all cached renders for a draft
 * Call this when slot images change
 */
export async function invalidateDraftRenderCache(draftId: string): Promise<void> {
  const rendersDir = getDraftRendersDirectory(draftId);
  await deleteDirectory(rendersDir);
  await ensureDirectoryExists(rendersDir);
}

// ============================================
// Storage Cleanup
// ============================================

/**
 * Get total storage used by drafts (in bytes)
 */
export async function getDraftsStorageSize(): Promise<number> {
  return getDirectorySize(DRAFTS_DIR);
}

/**
 * Get total storage used by render cache (in bytes)
 */
export async function getRenderCacheSize(): Promise<number> {
  return getDirectorySize(RENDER_CACHE_DIR);
}

/**
 * Calculate the size of a directory recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  
  const info = await FileSystem.getInfoAsync(dirPath);
  if (!info.exists) {
    return 0;
  }
  
  const files = await FileSystem.readDirectoryAsync(dirPath);
  
  for (const file of files) {
    const filePath = `${dirPath}${file}`;
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    
    if (fileInfo.exists) {
      if (fileInfo.isDirectory) {
        totalSize += await getDirectorySize(`${filePath}/`);
      } else if ('size' in fileInfo) {
        totalSize += fileInfo.size || 0;
      }
    }
  }
  
  return totalSize;
}

/**
 * Clear all render cache (keeps drafts)
 */
export async function clearRenderCache(): Promise<void> {
  await deleteDirectory(RENDER_CACHE_DIR);
  await ensureDirectoryExists(RENDER_CACHE_DIR);
}

/**
 * Clear all local storage (drafts and cache)
 * Use with caution!
 */
export async function clearAllLocalStorage(): Promise<void> {
  await deleteDirectory(DRAFTS_DIR);
  await deleteDirectory(RENDER_CACHE_DIR);
  await initializeLocalStorage();
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Export directory constants for external use
export const STORAGE_PATHS = {
  DOCUMENTS: DOCUMENTS_DIR,
  DRAFTS: DRAFTS_DIR,
  RENDER_CACHE: RENDER_CACHE_DIR,
};

