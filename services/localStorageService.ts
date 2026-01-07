import { File, Directory, Paths } from 'expo-file-system';

// Base directories for local storage
const DOCUMENTS_DIR = Paths.document;
const DRAFTS_DIR = new Directory(DOCUMENTS_DIR, 'drafts');
const RENDER_CACHE_DIR = new Directory(DOCUMENTS_DIR, 'render-cache');

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
export async function ensureDirectoryExists(dir: Directory | string): Promise<void> {
  const directory = typeof dir === 'string' ? new Directory(dir) : dir;
  if (!directory.exists) {
    directory.create({ intermediates: true });
  }
}

/**
 * Get the draft directory path for a specific draft
 */
export function getDraftDirectory(draftId: string): Directory {
  return new Directory(DRAFTS_DIR, draftId);
}

/**
 * Get the slots directory within a draft
 */
export function getDraftSlotsDirectory(draftId: string): Directory {
  return new Directory(getDraftDirectory(draftId), 'slots');
}

/**
 * Get the renders directory within a draft (for cached renders)
 */
export function getDraftRendersDirectory(draftId: string): Directory {
  return new Directory(getDraftDirectory(draftId), 'renders');
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
  
  const sourceFile = new File(sourceUri);
  const destFile = new File(destPath);
  sourceFile.copy(destFile);
  
  return destPath;
}

/**
 * Move a file to a destination path
 */
export async function moveFile(sourceUri: string, destPath: string): Promise<string> {
  const destDir = destPath.substring(0, destPath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(destDir);
  
  const sourceFile = new File(sourceUri);
  const destFile = new File(destPath);
  sourceFile.move(destFile);
  
  return destPath;
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(filePath: string): Promise<void> {
  const file = new File(filePath);
  if (file.exists) {
    file.delete();
  }
}

/**
 * Delete a directory and all its contents
 */
export async function deleteDirectory(dir: Directory | string): Promise<void> {
  const directory = typeof dir === 'string' ? new Directory(dir) : dir;
  if (directory.exists) {
    directory.delete();
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const file = new File(filePath);
  return file.exists;
}

/**
 * Read a JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const file = new File(filePath);
    if (!file.exists) {
      return null;
    }
    const content = await file.text();
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
  const file = new File(filePath);
  file.write(JSON.stringify(data, null, 2));
}

/**
 * List files in a directory
 */
export async function listDirectory(dir: Directory | string): Promise<string[]> {
  const directory = typeof dir === 'string' ? new Directory(dir) : dir;
  if (!directory.exists) {
    return [];
  }
  return directory.list().map(item => item.name);
}

// ============================================
// Cache Key Generation
// ============================================

/**
 * Simple hash function (no external dependencies)
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generate a hash from a string (for cache keys)
 */
export async function generateHash(input: string): Promise<string> {
  return simpleHash(input).substring(0, 12);
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
  
  const destFile = new File(slotsDir, `${slotId}.jpg`);
  await copyFile(sourceUri, destFile.uri);
  
  return destFile.uri;
}

/**
 * Get the path to a slot image in a draft
 */
export function getDraftSlotImagePath(draftId: string, slotId: string): string {
  const slotsDir = getDraftSlotsDirectory(draftId);
  return new File(slotsDir, `${slotId}.jpg`).uri;
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
  const rendersDir = getDraftRendersDirectory(draftId);
  return new File(rendersDir, `${themeId}.jpg`).uri;
}

/**
 * Get the global render cache path (for non-draft renders)
 */
export function getGlobalCachePath(cacheKey: string): string {
  return new File(RENDER_CACHE_DIR, `${cacheKey}.jpg`).uri;
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
async function getDirectorySize(dir: Directory): Promise<number> {
  let totalSize = 0;
  
  if (!dir.exists) {
    return 0;
  }
  
  const items = dir.list();
  
  for (const item of items) {
    if (item instanceof Directory) {
      totalSize += await getDirectorySize(item);
    } else if (item instanceof File) {
      totalSize += item.size ?? 0;
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
  DOCUMENTS: DOCUMENTS_DIR.uri,
  DRAFTS: DRAFTS_DIR.uri,
  RENDER_CACHE: RENDER_CACHE_DIR.uri,
};
