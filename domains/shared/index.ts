/**
 * Shared Domain
 * 
 * Exports shared services used across the application.
 */

// Image Service
export { imageService, default as defaultImageService } from './imageService';
export {
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
  // Constants
  TEMP_UPLOADS_BUCKET,
} from './imageService';

// Analytics Service
export { analytics, default as defaultAnalytics } from './analyticsService';
export {
  track,
  screen,
  identify,
  reset,
  EVENTS,
  trackTemplateSelected,
  trackImageCaptured,
  trackContentSaved,
  trackContentExported,
  trackAIEnhancement,
  trackPaywall,
} from './analyticsService';
