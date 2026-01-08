import Constants from 'expo-constants';
import { 
  uploadMultipleTempImages, 
  cleanupSession, 
  generateSessionId,
} from './tempUploadService';
import {
  lookupDraftCache,
  downloadAndCacheDraftRender,
  invalidateDraftCache,
} from './renderCacheService';
import { getDraftSlotImagePath, fileExists } from './localStorageService';

/**
 * Render Service (Refactored for Templated.io-First Architecture)
 * 
 * Key changes:
 * - Preview renders: Quick renders for editor preview after photo capture
 * - Final renders: Full quality for download/share
 * - Watermark control: Visible for free users, hidden for premium
 * 
 * Flow:
 * 1. User adds photo → Upload to temp storage → Render preview
 * 2. User taps Download → Render final (or use cached) → Save
 * 3. User taps Share → Use same rendered image → Share sheet
 */

// Templated.io API configuration
// Note: v1 API uses /v1/render (singular), v2 uses /v2/renders (plural) but requires different auth
const TEMPLATED_API_URL = 'https://api.templated.io/v1/render';

// Get API key from environment with detailed debugging
const getTemplatedApiKey = (): string => {
  // ============================================
  // DEBUG: Log all possible sources of the API key
  // ============================================
  console.log('\n========== Templated API Key Debug ==========');
  
  // Source 1: Constants.expoConfig.extra (from app.config.js)
  const fromExpoConfig = Constants.expoConfig?.extra?.templatedApiKey;
  console.log('[renderService] Constants.expoConfig?.extra?.templatedApiKey:', 
    fromExpoConfig ? `SET (length: ${fromExpoConfig.length}, starts with: ${fromExpoConfig.substring(0, 8)}...)` : 'NOT SET'
  );
  
  // Source 2: Direct process.env (runtime)
  const fromEnvPublic = process.env.EXPO_PUBLIC_TEMPLATED_API_KEY;
  console.log('[renderService] process.env.EXPO_PUBLIC_TEMPLATED_API_KEY:', 
    fromEnvPublic ? `SET (length: ${fromEnvPublic.length})` : 'NOT SET'
  );
  
  // Debug: Show what's in Constants.expoConfig.extra
  console.log('[renderService] Constants.expoConfig?.extra keys:', 
    Constants.expoConfig?.extra ? Object.keys(Constants.expoConfig.extra) : 'extra is undefined'
  );
  
  // Debug: Show configLoadedAt to verify config was loaded
  console.log('[renderService] Config loaded at:', 
    Constants.expoConfig?.extra?.configLoadedAt || 'NOT SET'
  );
  
  console.log('==============================================\n');
  
  // Resolve API key - prioritize expoConfig.extra (from app.config.js)
  const apiKey = fromExpoConfig || fromEnvPublic || '';
  
  if (!apiKey) {
    console.error('[renderService] ERROR: Templated.io API key not configured!');
    console.error('[renderService] Please ensure EXPO_PUBLIC_TEMPLATED_API_KEY is set in your .env file');
    console.error('[renderService] Then restart with: npx expo start --clear');
  } else {
    console.log('[renderService] API key resolved successfully from:', 
      fromExpoConfig ? 'Constants.expoConfig.extra' : 'process.env'
    );
  }
  
  return apiKey;
};

// ============================================
// Types
// ============================================

export interface RenderResult {
  success: boolean;
  localPath?: string;      // Local cached file path
  renderUrl?: string;      // Original Templated.io URL (for reference)
  fromCache: boolean;      // Whether result came from cache
  error?: string;
}

export interface PreviewRenderResult {
  success: boolean;
  renderUrl?: string;      // Templated.io URL for preview display
  error?: string;
}

export interface RenderOptions {
  draftId: string;
  templateId: string;       // Templated.io template ID
  slotImages: Record<string, string>;  // slotId -> local URI
  themeId?: string;
  themeOverrides?: Record<string, { color?: string; text?: string }>;
  /** Whether to hide watermark (premium users only) */
  hideWatermark?: boolean;
}

export interface PreviewRenderOptions {
  templateId: string;       // Templated.io template ID
  /** Map of slotId -> local URI for photos to include */
  slotImages: Record<string, string>;
  /** Whether to hide watermark (premium users only) */
  hideWatermark?: boolean;
}

export interface RenderProgress {
  stage: 'checking_cache' | 'uploading' | 'rendering' | 'downloading' | 'caching' | 'complete' | 'error';
  progress?: number;  // 0-100
  message?: string;
}

export type RenderProgressCallback = (progress: RenderProgress) => void;

// ============================================
// Preview Render Function (NEW)
// ============================================

/**
 * Render a quick preview for the editor
 * 
 * This is called after each photo is added to show the user
 * an accurate preview with correct layer ordering.
 * 
 * Does NOT cache - returns URL directly for display
 * Optimized for speed over quality
 * 
 * @param options - Preview configuration
 * @returns PreviewRenderResult with Templated.io URL
 */
export async function renderPreview(
  options: PreviewRenderOptions
): Promise<PreviewRenderResult> {
  const { templateId, slotImages, hideWatermark = false } = options;
  
  try {
    // Validate API key
    const apiKey = getTemplatedApiKey();
    if (!apiKey) {
      throw new Error('Templated.io API key not configured');
    }
    
    // Check if we have any images to render
    if (Object.keys(slotImages).length === 0) {
      throw new Error('No slot images provided for preview');
    }
    
    // Upload images to temp storage
    const sessionId = generateSessionId();
    const publicUrls = await uploadMultipleTempImages(slotImages, sessionId);
    
    // Build layer payload
    const layerPayload: Record<string, Record<string, unknown>> = {};
    
    // Add slot images
    for (const [slotId, publicUrl] of Object.entries(publicUrls)) {
      layerPayload[slotId] = { image_url: publicUrl };
    }
    
    // Handle watermark visibility
    // Watermark layer should be named 'watermark' or contain 'watermark' in template
    if (hideWatermark) {
      layerPayload['watermark'] = { hide: true };
    }
    
    // DEBUG: Log request details (mask most of API key for security)
    const maskedKey = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'EMPTY';
    console.log('[renderService] Making API request to:', TEMPLATED_API_URL);
    console.log('[renderService] Authorization header:', `Bearer ${maskedKey}`);
    console.log('[renderService] API key length:', apiKey.length);
    console.log('[renderService] API key has whitespace:', apiKey !== apiKey.trim());
    console.log('[renderService] Template ID:', templateId);
    console.log('[renderService] Layer payload keys:', Object.keys(layerPayload));
    
    // Call Templated.io API
    const response = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,  // Trim any whitespace
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: templateId,
        format: 'jpeg',  // JPEG for faster rendering
        layers: layerPayload,
      }),
    });
    
    console.log('[renderService] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[renderService] API Error Response:', errorText);
      console.error('[renderService] Full API key for verification (REMOVE IN PRODUCTION):', apiKey);
      throw new Error(`Preview render failed: ${response.status}`);
    }
    
    const result = await response.json();
    const renderUrl = result.render_url;
    
    if (!renderUrl) {
      throw new Error('No render URL returned');
    }
    
    // Cleanup temp files (fire and forget)
    cleanupSession(sessionId).catch(console.warn);
    
    return {
      success: true,
      renderUrl,
    };
    
  } catch (error) {
    console.error('Preview render failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Preview render failed',
    };
  }
}

/**
 * Render preview with a single new photo added
 * 
 * Convenience function for when user just captured one photo.
 * Uploads just the new photo and renders.
 * 
 * @param templateId - Templated.io template ID
 * @param slotId - The slot ID for the new photo
 * @param photoUri - Local URI of the captured photo
 * @param existingPhotos - Map of other slots that already have photos
 * @param hideWatermark - Whether to hide watermark (premium)
 */
export async function renderPreviewWithNewPhoto(
  templateId: string,
  slotId: string,
  photoUri: string,
  existingPhotos: Record<string, string> = {},
  hideWatermark: boolean = false
): Promise<PreviewRenderResult> {
  // Combine new photo with existing
  const allPhotos = {
    ...existingPhotos,
    [slotId]: photoUri,
  };
  
  return renderPreview({
    templateId,
    slotImages: allPhotos,
    hideWatermark,
  });
}

// ============================================
// Main Render Function (for Download/Share)
// ============================================

/**
 * Render a template with slot images
 * Uses cache if available, otherwise renders via Templated.io
 * 
 * @param options - Render configuration
 * @param onProgress - Optional progress callback for UI updates
 * @returns RenderResult with local file path
 */
export async function renderTemplate(
  options: RenderOptions,
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  const { 
    draftId, 
    templateId, 
    slotImages, 
    themeId = 'default', 
    themeOverrides,
    hideWatermark = false,
  } = options;
  
  try {
    // Stage 1: Check cache
    onProgress?.({ stage: 'checking_cache', progress: 5, message: 'Checking cache...' });
    
    const cacheResult = await lookupDraftCache(draftId, themeId);
    
    if (cacheResult.hit && cacheResult.localPath) {
      onProgress?.({ stage: 'complete', progress: 100, message: 'Loaded from cache' });
      return {
        success: true,
        localPath: cacheResult.localPath,
        fromCache: true,
      };
    }
    
    // Stage 2: Validate API key
    const apiKey = getTemplatedApiKey();
    if (!apiKey) {
      throw new Error('Templated.io API key not configured. Please add EXPO_PUBLIC_TEMPLATED_API_KEY to your environment.');
    }
    
    // Stage 3: Upload images to temp storage
    onProgress?.({ stage: 'uploading', progress: 15, message: 'Uploading images...' });
    
    const sessionId = generateSessionId();
    const publicUrls = await uploadMultipleTempImages(slotImages, sessionId);
    
    onProgress?.({ stage: 'uploading', progress: 40, message: 'Images uploaded' });
    
    // Stage 4: Build layer payload and call Templated.io
    onProgress?.({ stage: 'rendering', progress: 50, message: 'Rendering...' });
    
    const layerPayload: Record<string, Record<string, unknown>> = {};
    
    // Add slot images
    for (const [slotId, publicUrl] of Object.entries(publicUrls)) {
      layerPayload[slotId] = { image_url: publicUrl };
    }
    
    // Handle watermark visibility
    if (hideWatermark) {
      layerPayload['watermark'] = { hide: true };
    }
    
    // Add theme color overrides (future feature)
    if (themeOverrides) {
      for (const [layerId, overrides] of Object.entries(themeOverrides)) {
        if (!layerPayload[layerId]) {
          layerPayload[layerId] = {};
        }
        if (overrides.color) {
          layerPayload[layerId].color = overrides.color;
        }
        if (overrides.text) {
          layerPayload[layerId].text = overrides.text;
        }
      }
    }
    
    const response = await fetch(TEMPLATED_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template: templateId,
        format: 'jpeg',
        layers: layerPayload,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Templated.io API error:', errorText);
      throw new Error(`Templated.io render failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const renderUrl = result.render_url;
    
    if (!renderUrl) {
      throw new Error('No render URL returned from Templated.io');
    }
    
    onProgress?.({ stage: 'rendering', progress: 70, message: 'Render complete' });
    
    // Stage 5: Download and cache result
    onProgress?.({ stage: 'downloading', progress: 75, message: 'Downloading result...' });
    
    const localPath = await downloadAndCacheDraftRender(draftId, renderUrl, themeId);
    
    onProgress?.({ stage: 'caching', progress: 90, message: 'Saving to cache...' });
    
    // Stage 6: Cleanup temp files
    await cleanupSession(sessionId);
    
    onProgress?.({ stage: 'complete', progress: 100, message: 'Complete!' });
    
    return {
      success: true,
      localPath,
      renderUrl,
      fromCache: false,
    };
    
  } catch (error) {
    console.error('Render failed:', error);
    onProgress?.({ 
      stage: 'error', 
      progress: 0, 
      message: error instanceof Error ? error.message : 'Render failed' 
    });
    
    return {
      success: false,
      fromCache: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Draft-Specific Render Functions
// ============================================

/**
 * Render a draft with its stored slot images
 * Automatically reads slot images from local storage
 */
export async function renderDraft(
  draftId: string,
  templateId: string,
  slotIds: string[],
  themeId: string = 'default',
  onProgress?: RenderProgressCallback,
  hideWatermark: boolean = false
): Promise<RenderResult> {
  // Build slot images map from local storage paths
  const slotImages: Record<string, string> = {};
  
  for (const slotId of slotIds) {
    const localPath = getDraftSlotImagePath(draftId, slotId);
    const exists = await fileExists(localPath);
    
    if (exists) {
      slotImages[slotId] = localPath;
    } else {
      console.warn(`Slot image not found: ${slotId}`);
    }
  }
  
  if (Object.keys(slotImages).length === 0) {
    return {
      success: false,
      fromCache: false,
      error: 'No slot images found for draft',
    };
  }
  
  return renderTemplate({
    draftId,
    templateId,
    slotImages,
    themeId,
    hideWatermark,
  }, onProgress);
}

/**
 * Invalidate cache and re-render a draft
 * Use when user changes a slot image
 */
export async function reRenderDraft(
  draftId: string,
  templateId: string,
  slotIds: string[],
  themeId: string = 'default',
  onProgress?: RenderProgressCallback,
  hideWatermark: boolean = false
): Promise<RenderResult> {
  // Invalidate existing cache
  await invalidateDraftCache(draftId);
  
  // Re-render
  return renderDraft(draftId, templateId, slotIds, themeId, onProgress, hideWatermark);
}

// ============================================
// Render Status Checking
// ============================================

/**
 * Check if a render is cached for a draft/theme combination
 */
export async function isRenderCached(
  draftId: string,
  themeId: string = 'default'
): Promise<boolean> {
  const result = await lookupDraftCache(draftId, themeId);
  return result.hit;
}

/**
 * Get cached render path if available
 */
export async function getCachedRenderPath(
  draftId: string,
  themeId: string = 'default'
): Promise<string | null> {
  const result = await lookupDraftCache(draftId, themeId);
  return result.hit ? result.localPath || null : null;
}

// ============================================
// Batch Operations
// ============================================

/**
 * Pre-render all theme variants for a draft
 * Useful for pre-caching common themes
 */
export async function preRenderThemes(
  draftId: string,
  templateId: string,
  slotIds: string[],
  themeIds: string[],
  onProgress?: (themeId: string, progress: RenderProgress) => void,
  hideWatermark: boolean = false
): Promise<Record<string, RenderResult>> {
  const results: Record<string, RenderResult> = {};
  
  for (const themeId of themeIds) {
    const result = await renderDraft(
      draftId,
      templateId,
      slotIds,
      themeId,
      (progress) => onProgress?.(themeId, progress),
      hideWatermark
    );
    results[themeId] = result;
  }
  
  return results;
}

// ============================================
// Legacy Compatibility
// ============================================

/**
 * Legacy render function for backwards compatibility
 * Maps old CapturedImages format to new format
 * 
 * @deprecated Use renderTemplate or renderDraft instead
 */
export async function legacyRenderTemplate(
  templatedId: string,
  capturedImages: Record<string, { uri: string } | null>,
  hideWatermark: boolean = false
): Promise<{ renderUrl: string }> {
  // Convert to simple URI map
  const slotImages: Record<string, string> = {};
  for (const [layerId, media] of Object.entries(capturedImages)) {
    if (media?.uri) {
      slotImages[layerId] = media.uri;
    }
  }
  
  // Use a temporary draft ID for non-draft renders
  const tempDraftId = `temp_${Date.now()}`;
  
  const result = await renderTemplate({
    draftId: tempDraftId,
    templateId: templatedId,
    slotImages,
    hideWatermark,
  });
  
  if (!result.success || !result.localPath) {
    throw new Error(result.error || 'Render failed');
  }
  
  // Return the local path as the "URL" for legacy compatibility
  return { renderUrl: result.localPath };
}
