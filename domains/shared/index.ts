/**
 * Shared Domain
 * 
 * Exports shared services used across the application.
 */

// Image Service
export { imageService, default as defaultImageService } from './imageService';
export {
  isCloudStorageUrl,
  isLocalFile,
  withCacheBust,
  generateSessionId,
  getSessionId,
  getCurrentSessionId,
  resetSession,
  getSessionUploadedUrls,
  uploadTempImage,
  uploadDraftImage,
  clearAllCache,
  clearMemoryCache,
  trackTempFile,
  untrackTempFile,
  cleanupTempFiles,
  cleanupOldTempFiles,
  cleanupSession,
  getTrackedFilesCount,
  clearTracking,
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
