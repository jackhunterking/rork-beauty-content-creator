import { Image } from 'expo-image';

/**
 * Image Cache Service
 * 
 * Manages expo-image cache for template previews.
 * Used to force refresh when templates are updated from backend.
 */

/**
 * Clear all cached images from both disk and memory.
 * Call this when templates are updated to ensure fresh images are loaded.
 */
export async function clearAllImageCache(): Promise<void> {
  try {
    await Promise.all([
      Image.clearDiskCache(),
      Image.clearMemoryCache()
    ]);
    console.log('[ImageCache] All caches cleared successfully');
  } catch (error) {
    console.warn('[ImageCache] Failed to clear cache:', error);
  }
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
  console.log(`[ImageCache] Clearing cache for template: ${templateId}`);
  await clearAllImageCache();
}

/**
 * Clear memory cache only (faster, less aggressive).
 * Use when you want to refresh in-view images without clearing disk cache.
 */
export async function clearMemoryCacheOnly(): Promise<void> {
  try {
    await Image.clearMemoryCache();
    console.log('[ImageCache] Memory cache cleared');
  } catch (error) {
    console.warn('[ImageCache] Failed to clear memory cache:', error);
  }
}
