/**
 * Image Utilities Service
 * 
 * Provides utilities for handling image URIs, including cache busting
 * for local files that may be updated without changing their path.
 * 
 * WHY CACHE BUSTING IS NEEDED:
 * expo-image caches images by their URI. When a local file's content
 * changes but its path stays the same (e.g., renders/default.jpg),
 * expo-image continues showing the cached (old) version.
 * 
 * SOLUTION:
 * Append a version parameter to local file URIs based on the content's
 * last modification time. This makes expo-image treat updated files
 * as new resources, while still allowing caching for unchanged files.
 */

import { Draft, PortfolioItem } from '@/types';

/**
 * Add cache-busting parameter to a local file URI
 * 
 * Only applies to local file:// URIs. Remote URLs are returned unchanged
 * as they have proper HTTP cache headers.
 * 
 * @param uri - The file URI (can be local file:// or remote http(s)://)
 * @param version - Version identifier (timestamp string or number)
 * @returns URI with cache-busting parameter for local files, unchanged for remote
 * 
 * @example
 * // Local file - adds cache buster
 * withCacheBust('file:///path/to/image.jpg', '2026-01-12T10:30:00Z')
 * // => 'file:///path/to/image.jpg?v=1736677800000'
 * 
 * @example
 * // Remote URL - unchanged
 * withCacheBust('https://example.com/image.jpg', '2026-01-12T10:30:00Z')
 * // => 'https://example.com/image.jpg'
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
  let source: string = 'none';
  
  // Priority: localPreviewPath > renderedPreviewUrl > captured images
  if (draft.localPreviewPath) {
    uri = draft.localPreviewPath;
    source = 'localPreviewPath';
  } else if (draft.renderedPreviewUrl) {
    uri = draft.renderedPreviewUrl;
    source = 'renderedPreviewUrl';
  } else if (draft.beforeImageUrl) {
    uri = draft.beforeImageUrl;
    source = 'beforeImageUrl';
  } else if (draft.afterImageUrl) {
    uri = draft.afterImageUrl;
    source = 'afterImageUrl';
  } else if (draft.capturedImageUrls) {
    const firstImage = Object.values(draft.capturedImageUrls)[0];
    if (firstImage) {
      uri = firstImage;
      source = 'capturedImageUrls';
    }
  }
  
  // Apply cache busting using the draft's updatedAt timestamp
  // Note: For local files, the drafts screen also uses cachePolicy="memory" 
  // to prevent aggressive disk caching of files that change content
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
