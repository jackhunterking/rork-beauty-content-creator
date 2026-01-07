import Constants from 'expo-constants';
import { 
  uploadMultipleTempImages, 
  cleanupSession, 
  generateSessionId 
} from './tempUploadService';
import {
  lookupDraftCache,
  downloadAndCacheDraftRender,
  invalidateDraftCache,
} from './renderCacheService';
import { getDraftSlotImagePath, fileExists } from './localStorageService';

/**
 * Render Service (Refactored)
 * 
 * Handles Templated.io rendering with smart caching:
 * 1. Check cache first - return immediately if hit
 * 2. Upload slot images to temp storage
 * 3. Call Templated.io API
 * 4. Download and cache result
 * 5. Cleanup temp files
 * 
 * Key principle: WYSIWYG - preview IS the final output
 */

// Templated.io API configuration
const TEMPLATED_API_URL = 'https://api.templated.io/v2/renders';

// Get API key from environment
const getTemplatedApiKey = (): string => {
  const apiKey = Constants.expoConfig?.extra?.templatedApiKey || 
                 process.env.EXPO_PUBLIC_TEMPLATED_API_KEY ||
                 '';
  
  if (!apiKey) {
    console.warn('Templated.io API key not configured');
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

export interface RenderOptions {
  draftId: string;
  templateId: string;       // Templated.io template ID
  slotImages: Record<string, string>;  // slotId -> local URI
  themeId?: string;
  themeOverrides?: Record<string, { color?: string; text?: string }>;  // Future: color customization
}

export interface RenderProgress {
  stage: 'checking_cache' | 'uploading' | 'rendering' | 'downloading' | 'caching' | 'complete' | 'error';
  progress?: number;  // 0-100
  message?: string;
}

export type RenderProgressCallback = (progress: RenderProgress) => void;

// ============================================
// Main Render Function
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
  const { draftId, templateId, slotImages, themeId = 'default', themeOverrides } = options;
  
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
    
    const layerPayload: Record<string, Record<string, string>> = {};
    
    // Add slot images
    for (const [slotId, publicUrl] of Object.entries(publicUrls)) {
      layerPayload[slotId] = { image_url: publicUrl };
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
  onProgress?: RenderProgressCallback
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
  onProgress?: RenderProgressCallback
): Promise<RenderResult> {
  // Invalidate existing cache
  await invalidateDraftCache(draftId);
  
  // Re-render
  return renderDraft(draftId, templateId, slotIds, themeId, onProgress);
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
  onProgress?: (themeId: string, progress: RenderProgress) => void
): Promise<Record<string, RenderResult>> {
  const results: Record<string, RenderResult> = {};
  
  for (const themeId of themeIds) {
    const result = await renderDraft(
      draftId,
      templateId,
      slotIds,
      themeId,
      (progress) => onProgress?.(themeId, progress)
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
  capturedImages: Record<string, { uri: string } | null>
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
  });
  
  if (!result.success || !result.localPath) {
    throw new Error(result.error || 'Render failed');
  }
  
  // Return the local path as the "URL" for legacy compatibility
  return { renderUrl: result.localPath };
}
