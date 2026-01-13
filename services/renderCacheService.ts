import * as FileSystem from 'expo-file-system/legacy';
import {
  generateRenderCacheKey,
  getCachedRenderPath,
  getGlobalCachePath,
  draftRenderExists,
  saveDraftRender,
  invalidateDraftRenderCache,
  fileExists,
  deleteFile,
  ensureDirectoryExists,
  STORAGE_PATHS,
} from './localStorageService';

/**
 * @deprecated Since Jan 2026 - This entire service is deprecated.
 * 
 * Render Cache Service (DEPRECATED)
 * 
 * Previously managed caching of Templated.io rendered images to minimize API calls.
 * 
 * WHY DEPRECATED:
 * The new architecture uses the Templated.io preview URL directly for download/share.
 * The preview URL serves as the "cache" - no local file system caching needed.
 * 
 * The draft's `cachedPreviewUrl` field now stores the Templated.io URL, which is
 * reused when reopening drafts without requiring a new API call.
 * 
 * All functions in this file are no longer used by the main app flow.
 */

export interface RenderCacheEntry {
  cacheKey: string;
  localPath: string;
  templateId: string;
  themeId: string;
  createdAt: string;
  sizeBytes?: number;
}

export interface CacheLookupResult {
  hit: boolean;
  localPath?: string;
  cacheKey: string;
}

// ============================================
// Cache Lookup
// ============================================

/**
 * Look up a cached render for a draft
 * Returns the local path if cached, null otherwise
 */
export async function lookupDraftCache(
  draftId: string,
  themeId: string = 'default'
): Promise<CacheLookupResult> {
  const cacheKey = `draft_${draftId}_${themeId}`;
  const exists = await draftRenderExists(draftId, themeId);
  
  if (exists) {
    const localPath = getCachedRenderPath(draftId, themeId);
    return {
      hit: true,
      localPath,
      cacheKey,
    };
  }
  
  return {
    hit: false,
    cacheKey,
  };
}

/**
 * Look up a cached render by template, images, and theme
 * Used for non-draft renders (e.g., preview without saving)
 */
export async function lookupGlobalCache(
  templateId: string,
  slotImageUris: Record<string, string>,
  themeId: string = 'default'
): Promise<CacheLookupResult> {
  const cacheKey = await generateRenderCacheKey(templateId, slotImageUris, themeId);
  const cachePath = getGlobalCachePath(cacheKey);
  const exists = await fileExists(cachePath);
  
  if (exists) {
    return {
      hit: true,
      localPath: cachePath,
      cacheKey,
    };
  }
  
  return {
    hit: false,
    cacheKey,
  };
}

// ============================================
// Cache Storage
// ============================================

/**
 * Save a rendered image to the draft's cache
 */
export async function cacheDraftRender(
  draftId: string,
  sourceUri: string,
  themeId: string = 'default'
): Promise<string> {
  return saveDraftRender(draftId, sourceUri, themeId);
}

/**
 * Save a rendered image to the global cache
 */
export async function cacheGlobalRender(
  cacheKey: string,
  sourceUri: string
): Promise<string> {
  const cachePath = getGlobalCachePath(cacheKey);
  const cacheDir = STORAGE_PATHS.RENDER_CACHE;
  await ensureDirectoryExists(cacheDir);
  
  await FileSystem.copyAsync({
    from: sourceUri,
    to: cachePath,
  });
  
  return cachePath;
}

/**
 * Download a rendered image from URL and save to cache
 */
export async function downloadAndCacheDraftRender(
  draftId: string,
  renderUrl: string,
  themeId: string = 'default'
): Promise<string> {
  const cachePath = getCachedRenderPath(draftId, themeId);
  
  // Ensure the renders directory exists
  const rendersDir = cachePath.substring(0, cachePath.lastIndexOf('/') + 1);
  await ensureDirectoryExists(rendersDir);
  
  // Download the rendered image
  const downloadResult = await FileSystem.downloadAsync(renderUrl, cachePath);
  
  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download render: ${downloadResult.status}`);
  }
  
  return cachePath;
}

/**
 * Download a rendered image from URL and save to global cache
 */
export async function downloadAndCacheGlobalRender(
  cacheKey: string,
  renderUrl: string
): Promise<string> {
  const cachePath = getGlobalCachePath(cacheKey);
  const cacheDir = STORAGE_PATHS.RENDER_CACHE;
  await ensureDirectoryExists(cacheDir);
  
  const downloadResult = await FileSystem.downloadAsync(renderUrl, cachePath);
  
  if (downloadResult.status !== 200) {
    throw new Error(`Failed to download render: ${downloadResult.status}`);
  }
  
  return cachePath;
}

// ============================================
// Cache Invalidation
// ============================================

/**
 * Invalidate all cached renders for a draft
 * Call this when any slot image changes
 */
export async function invalidateDraftCache(draftId: string): Promise<void> {
  await invalidateDraftRenderCache(draftId);
}

/**
 * Invalidate a specific global cache entry
 */
export async function invalidateGlobalCacheEntry(cacheKey: string): Promise<void> {
  const cachePath = getGlobalCachePath(cacheKey);
  await deleteFile(cachePath);
}

/**
 * Invalidate global cache entries matching a template
 * Useful when template definition changes
 */
export async function invalidateTemplateCache(templateId: string): Promise<number> {
  const cacheDir = STORAGE_PATHS.RENDER_CACHE;
  const files = await FileSystem.readDirectoryAsync(cacheDir);
  
  let deletedCount = 0;
  
  for (const file of files) {
    if (file.startsWith(templateId)) {
      await deleteFile(`${cacheDir}${file}`);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

// ============================================
// Cache Statistics
// ============================================

/**
 * Get cache statistics for a draft
 */
export async function getDraftCacheStats(draftId: string): Promise<{
  cachedThemes: string[];
  totalSize: number;
}> {
  const rendersDir = getCachedRenderPath(draftId, '').replace('default.jpg', '');
  
  try {
    const files = await FileSystem.readDirectoryAsync(rendersDir);
    let totalSize = 0;
    const cachedThemes: string[] = [];
    
    for (const file of files) {
      if (file.endsWith('.jpg')) {
        const themeId = file.replace('.jpg', '');
        cachedThemes.push(themeId);
        
        const filePath = `${rendersDir}${file}`;
        const info = await FileSystem.getInfoAsync(filePath);
        if (info.exists && 'size' in info) {
          totalSize += info.size || 0;
        }
      }
    }
    
    return { cachedThemes, totalSize };
  } catch {
    return { cachedThemes: [], totalSize: 0 };
  }
}

/**
 * Get total number of cached renders globally
 */
export async function getGlobalCacheCount(): Promise<number> {
  try {
    const files = await FileSystem.readDirectoryAsync(STORAGE_PATHS.RENDER_CACHE);
    return files.filter(f => f.endsWith('.jpg')).length;
  } catch {
    return 0;
  }
}

// ============================================
// Cache Preloading
// ============================================

/**
 * Preload a cached render into memory for faster display
 * Uses expo-image's prefetch if available
 */
export async function preloadCachedRender(localPath: string): Promise<void> {
  // Verify the file exists before trying to preload
  const exists = await fileExists(localPath);
  if (!exists) {
    console.warn('Cannot preload non-existent cache file:', localPath);
    return;
  }
  
  // The actual preloading will be handled by expo-image
  // This function just validates the path
}

/**
 * Preload all theme variants for a draft
 */
export async function preloadAllDraftRenders(draftId: string): Promise<void> {
  const { cachedThemes } = await getDraftCacheStats(draftId);
  
  for (const themeId of cachedThemes) {
    const localPath = getCachedRenderPath(draftId, themeId);
    await preloadCachedRender(localPath);
  }
}

// ============================================
// Render-or-Cache Flow
// ============================================

export interface RenderOrCacheResult {
  localPath: string;
  fromCache: boolean;
  cacheKey: string;
}

/**
 * Check cache, return if hit, otherwise signal need for render
 * Does NOT perform the actual render - that's done by renderService
 */
export async function checkCacheOrPrepareRender(
  draftId: string,
  themeId: string = 'default'
): Promise<{ needsRender: boolean; localPath?: string; cacheKey: string }> {
  const cacheResult = await lookupDraftCache(draftId, themeId);
  
  if (cacheResult.hit && cacheResult.localPath) {
    return {
      needsRender: false,
      localPath: cacheResult.localPath,
      cacheKey: cacheResult.cacheKey,
    };
  }
  
  return {
    needsRender: true,
    cacheKey: cacheResult.cacheKey,
  };
}

